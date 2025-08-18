import fs from 'node:fs'
import Crypto from 'node:crypto'
import Stream from 'node:stream'
import { setTimeout } from 'node:timers/promises'
import { promisify } from 'node:util'
import { ObjectId, Binary } from 'mongodb'
import { db, globalBlobs } from '../../../../storage/lib/mongodb.js'
import cleanup from './support/cleanup.js'
import testProjects from '../api/support/test_projects.js'
import { execFile } from 'node:child_process'
import chai, { expect } from 'chai'
import chaiExclude from 'chai-exclude'
import { WritableBuffer } from '@overleaf/stream-utils'
import {
  backupPersistor,
  projectBlobsBucket,
} from '../../../../storage/lib/backupPersistor.mjs'
import {
  BlobStore,
  makeProjectKey,
} from '../../../../storage/lib/blob_store/index.js'

import { mockFilestore } from './support/MockFilestore.mjs'

chai.use(chaiExclude)
const TIMEOUT = 20 * 1_000

const projectsCollection = db.collection('projects')
const deletedProjectsCollection = db.collection('deletedProjects')

/**
 * @param {ObjectId} objectId
 * @return {string}
 */
function gitBlobHash(objectId) {
  return gitBlobHashBuffer(Buffer.from(objectId.toString()))
}

/**
 * @param {Buffer} buf
 * @return {string}
 */
function gitBlobHashBuffer(buf) {
  const sha = Crypto.createHash('sha1')
  sha.update(`blob ${buf.byteLength}\x00`)
  sha.update(buf)
  return sha.digest('hex')
}

/**
 * @param {string} gitBlobHash
 * @return {Binary}
 */
function binaryForGitBlobHash(gitBlobHash) {
  return new Binary(Buffer.from(gitBlobHash, 'hex'))
}

function objectIdFromTime(timestamp) {
  return ObjectId.createFromTime(new Date(timestamp).getTime() / 1000)
}

const PRINT_IDS_AND_HASHES_FOR_DEBUGGING = false

describe('back_fill_file_hash script', function () {
  this.timeout(TIMEOUT)

  const projectId0 = objectIdFromTime('2017-01-01T00:00:00Z')
  const projectId1 = objectIdFromTime('2017-01-01T00:01:00Z')
  const projectId2 = objectIdFromTime('2017-01-01T00:02:00Z')
  const projectId3 = objectIdFromTime('2024-01-01T00:03:00Z')
  const projectIdDeleted0 = objectIdFromTime('2017-01-01T00:04:00Z')
  const projectIdDeleted1 = objectIdFromTime('2024-01-01T00:05:00Z')
  const projectIdNoHistory = objectIdFromTime('2017-01-01T00:06:00Z')
  const projectIdNoHistoryDeleted = objectIdFromTime('2017-01-01T00:07:00Z')
  const projectIdHardDeleted = objectIdFromTime('2017-01-01T00:08:00Z')
  const projectIdNoOverleaf = objectIdFromTime('2017-01-01T00:09:00Z')
  const projectIdNoOverleafDeleted = objectIdFromTime('2017-01-01T00:10:00Z')
  const projectIdBadFileTree0 = objectIdFromTime('2024-01-01T00:11:00Z')
  const projectIdBadFileTree1 = objectIdFromTime('2024-01-01T00:12:00Z')
  const projectIdBadFileTree2 = objectIdFromTime('2024-01-01T00:13:00Z')
  const projectIdBadFileTree3 = objectIdFromTime('2024-01-01T00:14:00Z')
  const historyId0 = 42 // stored as number is mongo
  const historyId1 = projectId1.toString()
  const historyId2 = projectId2.toString()
  const historyId3 = projectId3.toString()
  const historyIdDeleted0 = projectIdDeleted0.toString()
  const historyIdDeleted1 = projectIdDeleted1.toString()
  const historyIdBadFileTree0 = projectIdBadFileTree0.toString()
  const historyIdBadFileTree1 = projectIdBadFileTree1.toString()
  const historyIdBadFileTree2 = projectIdBadFileTree2.toString()
  const historyIdBadFileTree3 = projectIdBadFileTree3.toString()
  const fileId0 = objectIdFromTime('2017-02-01T00:00:00Z')
  const fileId1 = objectIdFromTime('2017-02-01T00:01:00Z')
  const fileId2 = objectIdFromTime('2017-02-01T00:02:00Z')
  const fileId3 = objectIdFromTime('2017-02-01T00:03:00Z')
  const fileId4 = objectIdFromTime('2017-02-01T00:04:00Z')
  const fileId5 = objectIdFromTime('2024-02-01T00:05:00Z')
  const fileId6 = objectIdFromTime('2017-02-01T00:06:00Z')
  const fileId7 = objectIdFromTime('2017-02-01T00:07:00Z')
  const fileId8 = objectIdFromTime('2017-02-01T00:08:00Z')
  const fileId9 = objectIdFromTime('2017-02-01T00:09:00Z')
  const fileId10 = objectIdFromTime('2017-02-01T00:10:00Z')
  const fileId11 = objectIdFromTime('2017-02-01T00:11:00Z')
  const contentTextBlob0 = Buffer.from('Hello 0')
  const hashTextBlob0 = gitBlobHashBuffer(contentTextBlob0)
  const contentTextBlob1 = Buffer.from('Hello 1')
  const hashTextBlob1 = gitBlobHashBuffer(contentTextBlob1)
  const contentTextBlob2 = Buffer.from('Hello 2')
  const hashTextBlob2 = gitBlobHashBuffer(contentTextBlob2)
  const contentTextBlob3 = Buffer.from('Hello 3')
  const hashTextBlob3 = gitBlobHashBuffer(contentTextBlob3)
  const deleteProjectsRecordId0 = new ObjectId()
  const deleteProjectsRecordId1 = new ObjectId()
  const deleteProjectsRecordId2 = new ObjectId()
  const deleteProjectsRecordId3 = new ObjectId()
  const deleteProjectsRecordId4 = new ObjectId()
  const twoByteUTF8Symbol = 'ö'
  const contentFile7 = Buffer.alloc(4_000_000, twoByteUTF8Symbol)
  const hashFile7 = gitBlobHashBuffer(contentFile7)
  const potentiallyWrittenBlobs = [
    { projectId: projectId0, historyId: historyId0, fileId: fileId0 },
    // { historyId: projectId0, fileId: fileId6 }, // global blob
    {
      projectId: projectId0,
      historyId: historyId0,
      fileId: fileId7,
      hash: hashFile7,
      content: contentFile7,
    },
    {
      projectId: projectId0,
      historyId: historyId0,
      hash: hashTextBlob0,
      content: contentTextBlob0,
    },
    {
      projectId: projectId1,
      historyId: historyId1,
      hash: hashTextBlob1,
      content: contentTextBlob1,
    },
    {
      projectId: projectId2,
      historyId: historyId2,
      hash: hashTextBlob2,
      content: contentTextBlob2,
    },
    { projectId: projectId1, historyId: historyId1, fileId: fileId1 },
    {
      projectId: projectId2,
      historyId: historyId2,
      fileId: fileId2,
      hasHash: true,
    },
    { projectId: projectId3, historyId: historyId3, fileId: fileId3 },
    // fileId10 is dupe of fileId3, without a hash
    {
      projectId: projectId3,
      historyId: historyId3,
      fileId: fileId10,
      content: Buffer.from(fileId3.toString()),
      hash: gitBlobHash(fileId3),
    },
    // fileId11 is dupe of fileId3, but with a hash
    {
      projectId: projectId3,
      historyId: historyId3,
      fileId: fileId11,
      content: Buffer.from(fileId3.toString()),
      hash: gitBlobHash(fileId3),
      hasHash: true,
    },
    {
      projectId: projectIdDeleted0,
      historyId: historyIdDeleted0,
      fileId: fileId4,
    },
    {
      projectId: projectIdDeleted1,
      historyId: historyIdDeleted1,
      fileId: fileId5,
      hasHash: true,
    },
    {
      projectId: projectIdBadFileTree0,
      historyId: historyIdBadFileTree0,
      hash: hashTextBlob3,
      content: contentTextBlob3,
    },
    {
      projectId: projectIdBadFileTree3,
      historyId: historyIdBadFileTree3,
      fileId: fileId9,
    },
  ]
  if (PRINT_IDS_AND_HASHES_FOR_DEBUGGING) {
    const fileIds = {
      fileId0,
      fileId1,
      fileId2,
      fileId3,
      fileId4,
      fileId5,
      fileId6,
    }
    console.log({
      projectId0,
      projectId1,
      projectId2,
      projectId3,
      projectIdDeleted0,
      projectIdDeleted1,
      historyId0,
      historyId1,
      historyId2,
      historyId3,
      historyIdDeleted0,
      historyIdDeleted1,
      ...fileIds,
    })
    for (const [name, v] of Object.entries(fileIds)) {
      console.log(
        name,
        gitBlobHash(v),
        Array.from(binaryForGitBlobHash(gitBlobHash(v)).value())
      )
    }
  }

  async function populateMongo() {
    await globalBlobs.insertMany([
      { _id: gitBlobHash(fileId6), byteLength: 24, stringLength: 24 },
      { _id: gitBlobHash(fileId8), byteLength: 24, stringLength: 24 },
    ])
    await projectsCollection.insertMany([
      {
        _id: projectId0,
        rootFolder: [
          {
            fileRefs: [
              { _id: fileId8, hash: gitBlobHash(fileId8) },
              { _id: fileId0 },
              { _id: fileId6 },
              { _id: fileId7 },
            ],
            folders: [{ fileRefs: [], folders: [] }],
          },
        ],
        overleaf: { history: { id: historyId0 } },
      },
      {
        _id: projectId1,
        rootFolder: [
          {
            fileRefs: [{ _id: fileId1 }],
            folders: [
              {
                fileRefs: [],
                folders: [{ fileRefs: [{ _id: fileId1 }], folders: [] }],
              },
            ],
          },
        ],
        overleaf: { history: { id: historyId1 } },
      },
      {
        _id: projectId2,
        rootFolder: [
          {
            fileRefs: [],
            folders: [
              {
                fileRefs: [],
                folders: [
                  {
                    fileRefs: [{ _id: fileId2, hash: gitBlobHash(fileId2) }],
                    folders: [],
                  },
                ],
              },
            ],
          },
        ],
        overleaf: { history: { id: historyId2 } },
      },
      {
        _id: projectId3,
        rootFolder: [
          {
            fileRefs: [],
            folders: [
              {
                fileRefs: [],
                folders: [
                  {
                    fileRefs: [
                      { _id: fileId3 },
                      { _id: fileId10 },
                      { _id: fileId11, hash: gitBlobHash(fileId3) },
                    ],
                    folders: [],
                  },
                ],
              },
            ],
          },
        ],
        overleaf: { history: { id: historyId3 } },
      },
      {
        _id: projectIdNoHistory,
        rootFolder: [{ fileRefs: [], folders: [] }],
        overleaf: { history: { conversionFailed: true } },
      },
      {
        _id: projectIdNoOverleaf,
        rootFolder: [{ fileRefs: [], folders: [] }],
      },
      {
        _id: projectIdBadFileTree0,
        overleaf: { history: { id: historyIdBadFileTree0 } },
      },
      {
        _id: projectIdBadFileTree1,
        rootFolder: [],
        overleaf: { history: { id: historyIdBadFileTree1 } },
      },
      {
        _id: projectIdBadFileTree2,
        rootFolder: [{ fileRefs: [{ _id: null }] }],
        overleaf: { history: { id: historyIdBadFileTree2 } },
      },
      {
        _id: projectIdBadFileTree3,
        rootFolder: [
          {
            folders: [null, { folders: {}, fileRefs: 13 }],
            fileRefs: [{ _id: fileId9 }],
          },
        ],
        overleaf: { history: { id: historyIdBadFileTree3 } },
      },
    ])
    await deletedProjectsCollection.insertMany([
      {
        _id: deleteProjectsRecordId0,
        project: {
          _id: projectIdDeleted0,
          rootFolder: [
            {
              fileRefs: [],
              folders: [
                {
                  fileRefs: [],
                  folders: [{ fileRefs: [{ _id: fileId4 }], folders: [] }],
                },
              ],
            },
          ],
          overleaf: { history: { id: historyIdDeleted0 } },
        },
        deleterData: {
          deletedProjectId: projectIdDeleted0,
        },
      },
      {
        _id: deleteProjectsRecordId1,
        project: {
          _id: projectIdDeleted1,
          rootFolder: [
            {
              fileRefs: [],
              folders: [
                {
                  fileRefs: [],
                  folders: [
                    {
                      fileRefs: [{ _id: fileId5, hash: gitBlobHash(fileId5) }],
                      folders: [],
                    },
                  ],
                },
              ],
            },
          ],
          overleaf: { history: { id: historyIdDeleted1 } },
        },
        deleterData: {
          deletedProjectId: projectIdDeleted1,
        },
      },
      {
        _id: deleteProjectsRecordId2,
        project: {
          _id: projectIdNoHistoryDeleted,
          rootFolder: [{ fileRefs: [], folders: [] }],
          overleaf: { history: { conversionFailed: true } },
        },
        deleterData: {
          deletedProjectId: projectIdNoHistoryDeleted,
        },
      },
      {
        _id: deleteProjectsRecordId3,
        deleterData: { deletedProjectId: projectIdHardDeleted },
      },
      {
        _id: deleteProjectsRecordId4,
        project: {
          _id: projectIdNoOverleafDeleted,
          rootFolder: [{ fileRefs: [], folders: [] }],
        },
        deleterData: {
          deletedProjectId: projectIdNoOverleafDeleted,
        },
      },
    ])
  }

  async function populateHistoryV1() {
    await Promise.all([
      testProjects.createEmptyProject(historyId0.toString()),
      testProjects.createEmptyProject(historyId1),
      testProjects.createEmptyProject(historyId2),
      testProjects.createEmptyProject(historyId3),
      testProjects.createEmptyProject(historyIdDeleted0),
      testProjects.createEmptyProject(historyIdDeleted1),
      testProjects.createEmptyProject(historyIdBadFileTree0),
      testProjects.createEmptyProject(historyIdBadFileTree1),
      testProjects.createEmptyProject(historyIdBadFileTree2),
      testProjects.createEmptyProject(historyIdBadFileTree3),
    ])

    const blobStore0 = new BlobStore(historyId0.toString())
    await blobStore0.putString(contentTextBlob0.toString())
    const blobStore1 = new BlobStore(historyId1.toString())
    await blobStore1.putString(contentTextBlob1.toString())
    const blobStore2 = new BlobStore(historyId2.toString())
    await blobStore2.putString(contentTextBlob2.toString())
    const blobStoreBadFileTree = new BlobStore(historyIdBadFileTree0.toString())
    await blobStoreBadFileTree.putString(contentTextBlob3.toString())
  }

  async function populateFilestore() {
    await mockFilestore.addFile(projectId0, fileId0, fileId0.toString())
    await mockFilestore.addFile(projectId0, fileId6, fileId6.toString())
    await mockFilestore.addFile(projectId0, fileId7, contentFile7)
    await mockFilestore.addFile(projectId1, fileId1, fileId1.toString())
    await mockFilestore.addFile(projectId2, fileId2, fileId2.toString())
    await mockFilestore.addFile(projectId3, fileId3, fileId3.toString())
    await mockFilestore.addFile(
      projectId3,
      fileId10,
      // fileId10 is dupe of fileId3
      fileId3.toString()
    )
    await mockFilestore.addFile(
      projectId3,
      fileId11,
      // fileId11 is dupe of fileId3
      fileId3.toString()
    )
    await mockFilestore.addFile(projectIdDeleted0, fileId4, fileId4.toString())
    await mockFilestore.addFile(projectIdDeleted1, fileId5, fileId5.toString())
    await mockFilestore.addFile(
      projectIdBadFileTree3,
      fileId9,
      fileId9.toString()
    )
  }

  async function prepareEnvironment() {
    await cleanup.everything()
    await mockFilestore.start()
    await populateMongo()
    await populateHistoryV1()
    await populateFilestore()
  }

  /**
   * @param {Array<string>} args
   * @return {Promise<{result: { stdout: string, stderr: string, status: number }, stats: any}>}
   */
  async function rawRunScript(args = []) {
    let result
    try {
      result = await promisify(execFile)(
        process.argv0,
        [
          'storage/scripts/back_fill_file_hash.mjs',
          '--sleep-before-exit-ms=1',
          ...args,
        ],
        {
          encoding: 'utf-8',
          timeout: TIMEOUT - 500,
          env: {
            ...process.env,
            AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE: '1',
            LOG_LEVEL: 'warn', // Override LOG_LEVEL of acceptance tests
          },
        }
      )
      result.status = 0
    } catch (err) {
      const { stdout, stderr, code } = err
      if (typeof code !== 'number') {
        console.log(err)
      }
      result = { stdout, stderr, status: code }
    }
    // Ensure no tmp folder is left behind.
    expect((await fs.promises.readdir('/tmp')).join(';')).to.not.match(
      /back_fill_file_hash/
    )
    return result
  }

  /**
   * @param {Array<string>} args
   * @param {boolean} shouldHaveWritten
   * @return {Promise<{result, stats: any, migrationCreated: boolean}>}
   */
  async function tryRunScript(args = [], shouldHaveWritten) {
    const result = await rawRunScript([
      '--output=-',
      '--projects',
      '--deleted-projects',
      ...args,
    ])
    const extraStatsKeys = ['eventLoop', 'readFromGCSThroughputMiBPerSecond']
    const stats = JSON.parse(
      result.stderr
        .split('\n')
        .filter(l => l.includes('LOGGING_IDENTIFIER'))
        .pop()
    )
    expect(Object.keys(stats.diff).sort()).to.deep.equal(
      [...extraStatsKeys, ...Object.keys(STATS_ALL)].sort()
    )
    delete stats.diff
    expect(new Date(stats.time).toISOString()).to.equal(stats.time)
    delete stats.time
    if (shouldHaveWritten) {
      expect(stats.readFromGCSThroughputMiBPerSecond).to.be.greaterThan(0)
    }
    for (const key of extraStatsKeys) {
      delete stats[key]
    }
    delete stats.LOGGING_IDENTIFIER
    expect(stats.deferredBatches).to.have.length(
      0,
      'should not have any remaining deferred batches'
    )
    delete stats.deferredBatches
    const migrationCreated = !!(await db
      .collection('migrations')
      .findOne({ name: '20250519101128_binary_files_migration' }))
    return { stats, result, migrationCreated }
  }

  /**
   * @param {Array<string>} args
   * @param {boolean} shouldHaveWritten
   * @return {Promise<{result, stats: any}>}
   */
  async function runScript(args = [], shouldHaveWritten = true) {
    const { stats, result, migrationCreated } = await tryRunScript(
      args,
      shouldHaveWritten
    )
    if (result.status !== 0) {
      console.log(result)
      expect(result).to.have.property('status', 0)
    }
    return { stats, result, migrationCreated }
  }

  /**
   * @param {boolean} processHashedFiles
   */
  function commonAssertions(processHashedFiles = false) {
    const writtenBlobs = potentiallyWrittenBlobs.filter(({ hasHash }) => {
      if (processHashedFiles) return true // all files processed
      return !hasHash // only files without hash processed
    })
    it('should update mongo', async function () {
      expect(await projectsCollection.find({}).toArray())
        .excludingEvery([
          'currentEndTimestamp',
          'currentEndVersion',
          'updatedAt',
          'backup',
        ])
        .to.deep.equal([
          {
            _id: projectId0,
            rootFolder: [
              {
                fileRefs: [
                  { _id: fileId8, hash: gitBlobHash(fileId8) },
                  { _id: fileId0, hash: gitBlobHash(fileId0) },
                  { _id: fileId6, hash: gitBlobHash(fileId6) },
                  { _id: fileId7, hash: hashFile7 },
                ],
                folders: [{ fileRefs: [], folders: [] }],
              },
            ],
            overleaf: { history: { id: historyId0 } },
          },
          {
            _id: projectId1,
            rootFolder: [
              {
                fileRefs: [{ _id: fileId1, hash: gitBlobHash(fileId1) }],
                folders: [
                  {
                    fileRefs: [],
                    folders: [
                      {
                        fileRefs: [
                          { _id: fileId1, hash: gitBlobHash(fileId1) },
                        ],
                        folders: [],
                      },
                    ],
                  },
                ],
              },
            ],
            overleaf: { history: { id: historyId1 } },
          },
          {
            _id: projectId2,
            rootFolder: [
              {
                fileRefs: [],
                folders: [
                  {
                    fileRefs: [],
                    folders: [
                      {
                        fileRefs: [
                          { _id: fileId2, hash: gitBlobHash(fileId2) },
                        ],
                        folders: [],
                      },
                    ],
                  },
                ],
              },
            ],
            overleaf: { history: { id: historyId2 } },
          },
          {
            _id: projectId3,
            rootFolder: [
              {
                fileRefs: [],
                folders: [
                  {
                    fileRefs: [],
                    folders: [
                      {
                        fileRefs: [
                          { _id: fileId3, hash: gitBlobHash(fileId3) },
                          { _id: fileId10, hash: gitBlobHash(fileId3) },
                          { _id: fileId11, hash: gitBlobHash(fileId3) },
                        ],
                        folders: [],
                      },
                    ],
                  },
                ],
              },
            ],
            overleaf: { history: { id: historyId3 } },
          },
          {
            _id: projectIdNoHistory,
            rootFolder: [{ fileRefs: [], folders: [] }],
            overleaf: { history: { conversionFailed: true } },
          },
          {
            _id: projectIdNoOverleaf,
            rootFolder: [{ fileRefs: [], folders: [] }],
          },
          {
            _id: projectIdBadFileTree0,
            overleaf: { history: { id: historyIdBadFileTree0 } },
          },
          {
            _id: projectIdBadFileTree1,
            rootFolder: [],
            overleaf: { history: { id: historyIdBadFileTree1 } },
          },
          {
            _id: projectIdBadFileTree2,
            rootFolder: [{ fileRefs: [{ _id: null }] }],
            overleaf: { history: { id: historyIdBadFileTree2 } },
          },
          {
            _id: projectIdBadFileTree3,
            rootFolder: [
              {
                folders: [null, { folders: {}, fileRefs: 13 }],
                fileRefs: [{ _id: fileId9, hash: gitBlobHash(fileId9) }],
              },
            ],
            overleaf: { history: { id: historyIdBadFileTree3 } },
          },
        ])
      expect(await deletedProjectsCollection.find({}).toArray()).to.deep.equal([
        {
          _id: deleteProjectsRecordId0,
          project: {
            _id: projectIdDeleted0,
            rootFolder: [
              {
                fileRefs: [],
                folders: [
                  {
                    fileRefs: [],
                    folders: [
                      {
                        fileRefs: [
                          { _id: fileId4, hash: gitBlobHash(fileId4) },
                        ],
                        folders: [],
                      },
                    ],
                  },
                ],
              },
            ],
            overleaf: { history: { id: historyIdDeleted0 } },
          },
          deleterData: {
            deletedProjectId: projectIdDeleted0,
          },
        },
        {
          _id: deleteProjectsRecordId1,
          project: {
            _id: projectIdDeleted1,
            rootFolder: [
              {
                fileRefs: [],
                folders: [
                  {
                    fileRefs: [],
                    folders: [
                      {
                        fileRefs: [
                          { _id: fileId5, hash: gitBlobHash(fileId5) },
                        ],
                        folders: [],
                      },
                    ],
                  },
                ],
              },
            ],
            overleaf: { history: { id: historyIdDeleted1 } },
          },
          deleterData: {
            deletedProjectId: projectIdDeleted1,
          },
        },
        {
          _id: deleteProjectsRecordId2,
          project: {
            _id: projectIdNoHistoryDeleted,
            rootFolder: [{ fileRefs: [], folders: [] }],
            overleaf: { history: { conversionFailed: true } },
          },
          deleterData: {
            deletedProjectId: projectIdNoHistoryDeleted,
          },
        },
        {
          _id: deleteProjectsRecordId3,
          deleterData: { deletedProjectId: projectIdHardDeleted },
        },
        {
          _id: deleteProjectsRecordId4,
          project: {
            _id: projectIdNoOverleafDeleted,
            rootFolder: [{ fileRefs: [], folders: [] }],
          },
          deleterData: {
            deletedProjectId: projectIdNoOverleafDeleted,
          },
        },
      ])
    })
    it('should have written the back filled files to history v1', async function () {
      for (const { historyId, hash, fileId, content } of writtenBlobs) {
        const blobStore = new BlobStore(historyId.toString())
        if (content) {
          const s = await blobStore.getStream(hash)
          const buf = new WritableBuffer()
          await Stream.promises.pipeline(s, buf)
          expect(buf.getContents()).to.deep.equal(content)
          continue
        }
        const id = await blobStore.getString(
          hash || gitBlobHash(fileId.toString())
        )
        expect(id).to.equal(fileId.toString())
        // double check we are not comparing 'undefined' or '[object Object]' above
        expect(id).to.match(/^[a-f0-9]{24}$/)
      }
    })
    // Technically, we should move the below test into its own environment to ensure it does not impact any assertions.
    // Practically, this is slow and moving it to the end of the tests gets us there most of the way.
    it('should process nothing on re-run', async function () {
      const rerun = await runScript(
        !processHashedFiles ? ['--skip-hashed-files'] : [],
        false
      )
      expect(rerun.stats).deep.equal(statsForRerun(processHashedFiles))
    })
  }

  function expectNotFoundError(result, msg) {
    expect(result.stdout).to.include(msg)
    const log = JSON.parse(
      result.stdout.split('\n').find(l => l.includes(`"${msg}"`))
    )
    expect(log).to.contain({
      projectId: projectId0.toString(),
      fileId: fileId0.toString(),
      path: 'rootFolder.0.fileRefs.1',
      msg,
    })
    expect(log.err).to.contain({
      name: 'NotFoundError',
    })
  }

  const STATS_ALL_ZERO = {
    projects: 0,
    blobs: 0,
    filesWithHash: 0,
    filesWithoutHash: 0,
    filesDuplicated: 0,
    filesRetries: 0,
    filesFailed: 0,
    globalBlobsCount: 0,
    globalBlobsEgress: 0,
    fileTreeUpdated: 0,
    projectDeleted: 0,
    projectHardDeleted: 0,
    fileHardDeleted: 0,
    badFileTrees: 0,
    mongoUpdates: 0,
    readFromGCSCount: 0,
    readFromGCSIngress: 0,
    writeToGCSCount: 0,
    writeToGCSEgress: 0,
  }
  const STATS_UP_TO_PROJECT1 = {
    projects: 2,
    blobs: 2,
    filesWithHash: 0,
    filesWithoutHash: 5,
    filesDuplicated: 1,
    filesRetries: 0,
    filesFailed: 0,
    globalBlobsCount: 1,
    globalBlobsEgress: 30,
    fileTreeUpdated: 0,
    projectDeleted: 0,
    projectHardDeleted: 0,
    fileHardDeleted: 0,
    badFileTrees: 0,
    mongoUpdates: 2, // 4-2 blobs written to backedUpBlobs collection
    readFromGCSCount: 4,
    readFromGCSIngress: 4000072,
    writeToGCSCount: 3,
    writeToGCSEgress: 4000048,
  }
  const STATS_UP_FROM_PROJECT1_ONWARD = {
    projects: 8,
    blobs: 2,
    filesWithHash: 0,
    filesWithoutHash: 4,
    filesDuplicated: 0,
    filesRetries: 0,
    filesFailed: 0,
    globalBlobsCount: 0,
    globalBlobsEgress: 0,
    fileTreeUpdated: 0,
    projectDeleted: 0,
    projectHardDeleted: 0,
    fileHardDeleted: 0,
    badFileTrees: 4,
    mongoUpdates: 3, // previously 5 blobs written to backedUpBlobs collection
    readFromGCSCount: 4,
    readFromGCSIngress: 96,
    writeToGCSCount: 3,
    writeToGCSEgress: 72,
  }
  const STATS_FILES_HASHED_EXTRA = {
    ...STATS_ALL_ZERO,
    filesWithHash: 2,
    mongoUpdates: 0, // previously 2 blobs written to backedUpBlobs collection
    readFromGCSCount: 2,
    readFromGCSIngress: 48,
    writeToGCSCount: 2,
    writeToGCSEgress: 48,
  }

  function sumStats(a, b) {
    return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v + b[k]]))
  }

  const STATS_ALL = sumStats(
    STATS_UP_TO_PROJECT1,
    STATS_UP_FROM_PROJECT1_ONWARD
  )

  function statsForRerun(processHashedFiles = true) {
    let stats = {
      ...STATS_ALL_ZERO,
      // We still need to iterate over all the projects and blobs.
      projects: 10,
      blobs: 10,

      badFileTrees: 4,
    }
    if (processHashedFiles) {
      stats = sumStats(stats, {
        ...STATS_ALL_ZERO,
        blobs: 2,
      })
    }
    return stats
  }

  describe('error cases', function () {
    beforeEach('prepare environment', prepareEnvironment)

    it('should gracefully handle fatal errors', async function () {
      mockFilestore.deleteObject(projectId0, fileId0)
      const t0 = Date.now()
      const { stats, result } = await tryRunScript([
        '--skip-hashed-files',
        '--retries=10',
        '--retry-delay-ms=1000',
      ])
      const t1 = Date.now()
      expectNotFoundError(result, 'failed to process file')
      expect(result.status).to.equal(1)
      expect(stats).to.deep.equal(
        sumStats(STATS_ALL, {
          ...STATS_ALL_ZERO,
          filesFailed: 1,
          readFromGCSIngress: -24,
          writeToGCSCount: -1,
          writeToGCSEgress: -24,
        })
      )
      // should not retry 404
      expect(result.stdout).to.not.include(
        'failed to process file, trying again'
      )
      expect(t1 - t0).to.be.below(10_000)
      expect(result.stderr).to.include(
        'The binary files migration failed, see above.'
      )
    })

    it('should retry on error', async function () {
      mockFilestore.deleteObject(projectId0, fileId0)
      const restoreFileAfter5s = async () => {
        await setTimeout(5_000)
        mockFilestore.addFile(projectId0, fileId0, fileId0.toString())
      }
      // use Promise.allSettled to ensure the above sendStream call finishes before this test completes
      const [
        {
          value: { stats, result },
        },
      ] = await Promise.allSettled([
        tryRunScript([
          '--skip-hashed-files',
          '--retries=60',
          '--retry-delay-ms=1000',
          '--retry-filestore-404',
        ]),
        restoreFileAfter5s(),
      ])
      expectNotFoundError(result, 'failed to process file, trying again')
      expect(result.status).to.equal(0)
      expect({ ...stats, filesRetries: 0, readFromGCSCount: 0 }).to.deep.equal({
        ...STATS_ALL,
        filesRetries: 0,
        readFromGCSCount: 0,
      })
      expect(stats.filesRetries).to.be.greaterThan(0, 'should have retried')
      expect(stats.readFromGCSCount).to.be.greaterThan(
        STATS_ALL.readFromGCSCount,
        'should have read more times from GCS compared to normal operations'
      )
    })
  })

  describe('full run CONCURRENCY=1', function () {
    let output
    before('prepare environment', prepareEnvironment)
    before('run script', async function () {
      output = await runScript(['--skip-hashed-files', '--concurrency=1'])
    })

    /**
     * @param {ObjectId} projectId
     * @param {string} msg
     * @param {string} path
     */
    function expectBadFileTreeMessage(projectId, msg, path) {
      const line = output.result.stdout
        .split('\n')
        .find(l => l.includes(msg) && l.includes(projectId.toString()))
      expect(line).to.exist
      expect(JSON.parse(line)).to.include({
        projectId: projectId.toString(),
        msg,
        path,
      })
    }

    it('should print stats', function () {
      expect(output.stats).deep.equal(STATS_ALL)
    })
    it('should print a warning message', () => {
      expect(output.result.stderr).to.include(
        'The binary files migration succeeded on a subset of files'
      )
    })
    it('should not create the migration', () => {
      expect(output.migrationCreated).to.equal(false)
    })
    it('should have logged the bad file-tree', function () {
      expectBadFileTreeMessage(
        projectIdBadFileTree0,
        'bad file-tree, bad folder',
        'rootFolder.0'
      )
      expectBadFileTreeMessage(
        projectIdBadFileTree1,
        'bad file-tree, bad folder',
        'rootFolder.0'
      )
      expectBadFileTreeMessage(
        projectIdBadFileTree1,
        'bad file-tree, bad folder',
        'rootFolder.0'
      )
      expectBadFileTreeMessage(
        projectIdBadFileTree2,
        'bad file-tree, bad fileRef id',
        'rootFolder.0.fileRefs.0'
      )
      expectBadFileTreeMessage(
        projectIdBadFileTree3,
        'bad file-tree, bad folder',
        'rootFolder.0.folders.0'
      )
      expectBadFileTreeMessage(
        projectIdBadFileTree3,
        'bad file-tree, bad folders',
        'rootFolder.0.folders.1.folders'
      )
      expectBadFileTreeMessage(
        projectIdBadFileTree3,
        'bad file-tree, bad fileRefs',
        'rootFolder.0.folders.1.fileRefs'
      )
    })
    commonAssertions()
  })

  describe('when processing hashed files later', function () {
    let output1, output2
    before('prepare environment', prepareEnvironment)
    before('run script without hashed files', async function () {
      output1 = await runScript(['--skip-hashed-files'])
    })
    before('run script with hashed files', async function () {
      output2 = await runScript([])
    })
    it('should print stats for the first run without hashed files', function () {
      expect(output1.stats).deep.equal(STATS_ALL)
    })
    it('should print stats for the hashed files run', function () {
      expect(output2.stats).deep.equal({
        ...STATS_FILES_HASHED_EXTRA,
        projects: 10,
        blobs: 10,
        badFileTrees: 4,
      })
    })
    it('should print a success message', () => {
      expect(output2.result.stderr).to.include(
        'The binary files migration succeeded.'
      )
    })
    it('should create the migration', () => {
      expect(output2.migrationCreated).to.equal(true)
    })
    commonAssertions(true)
  })
  describe('report mode', function () {
    let output
    before('prepare environment', prepareEnvironment)
    before('run script', async function () {
      output = await rawRunScript(['--report'])
    })
    it('should print the report', () => {
      expect(output.status).to.equal(0)
      expect(output.stdout).to.equal(`\
Current status:
- Total number of projects: 10
- Total number of deleted projects: 5
Sampling 1000 projects to estimate progress...
Sampled stats for projects:
- Sampled projects: 9 (90% of all projects)
- Sampled projects with all hashes present: 5
- Percentage of projects that need back-filling hashes: 44% (estimated)
- Sampled projects have 11 files that need to be checked against the full project history system.
- Sampled projects have 3 files that need to be uploaded to the full project history system (estimating 27% of all files).
Sampled stats for deleted projects:
- Sampled deleted projects: 4 (80% of all deleted projects)
- Sampled deleted projects with all hashes present: 3
- Percentage of deleted projects that need back-filling hashes: 25% (estimated)
- Sampled deleted projects have 2 files that need to be checked against the full project history system.
- Sampled deleted projects have 1 files that need to be uploaded to the full project history system (estimating 50% of all files).
`)
    })
  })

  describe('full run in dry-run mode', function () {
    let output
    let projectRecordsBefore
    let deletedProjectRecordsBefore
    before('prepare environment', prepareEnvironment)
    before(async function () {
      projectRecordsBefore = await projectsCollection.find({}).toArray()
      deletedProjectRecordsBefore = await deletedProjectsCollection
        .find({})
        .toArray()
    })
    before('run script', async function () {
      output = await runScript(['--dry-run', '--concurrency=1'], false)
    })

    it('should print stats for dry-run mode', function () {
      // Compute the stats for running the script without dry-run mode.
      const originalStats = sumStats(STATS_ALL, {
        ...STATS_FILES_HASHED_EXTRA,
        readFromGCSCount: 30,
        readFromGCSIngress: 72,
        mongoUpdates: 0,
        filesWithHash: 3,
      })
      // For a dry-run mode, we expect the stats to be zero except for the
      // count of projects, blobs, bad file trees, duplicated files
      // and files with/without hash.  All the other stats such as mongoUpdates
      // and writeToGCSCount, etc should be zero.
      const expectedDryRunStats = {
        ...STATS_ALL_ZERO,
        projects: originalStats.projects,
        blobs: originalStats.blobs,
        badFileTrees: originalStats.badFileTrees,
        filesDuplicated: originalStats.filesDuplicated,
        filesWithHash: originalStats.filesWithHash,
        filesWithoutHash: originalStats.filesWithoutHash,
      }
      expect(output.stats).deep.equal(expectedDryRunStats)
    })
    it('should not update mongo', async function () {
      expect(await projectsCollection.find({}).toArray()).to.deep.equal(
        projectRecordsBefore
      )
      expect(await deletedProjectsCollection.find({}).toArray()).to.deep.equal(
        deletedProjectRecordsBefore
      )
    })
  })

  describe('full run CONCURRENCY=10', function () {
    let output
    before('prepare environment', prepareEnvironment)
    before('run script', async function () {
      output = await runScript(['--skip-hashed-files', '--concurrency=10'])
    })
    it('should print stats', function () {
      expect(output.stats).deep.equal(STATS_ALL)
    })
    commonAssertions()
  })

  describe('full run STREAM_HIGH_WATER_MARK=64kiB', function () {
    let output
    before('prepare environment', prepareEnvironment)
    before('run script', async function () {
      output = await runScript([
        '--skip-hashed-files',
        `--stream-high-water-mark=${64 * 1024}`,
      ])
    })
    it('should print stats', function () {
      expect(output.stats).deep.equal(STATS_ALL)
    })
    commonAssertions()
  })

  describe('when processing hashed files', function () {
    let output
    before('prepare environment', prepareEnvironment)
    before('run script', async function () {
      output = await runScript([])
    })
    it('should print stats', function () {
      expect(output.stats).deep.equal(
        sumStats(STATS_ALL, {
          ...STATS_FILES_HASHED_EXTRA,
          readFromGCSCount: 3,
          readFromGCSIngress: 72,
          mongoUpdates: 0,
          filesWithHash: 3,
        })
      )
    })
    commonAssertions(true)
  })

  describe('with something in the bucket already', function () {
    before('prepare environment', prepareEnvironment)
    before('create a file in s3', async function () {
      const buf = Buffer.from(fileId0.toString())
      await backupPersistor.sendStream(
        projectBlobsBucket,
        makeProjectKey(historyId0, gitBlobHash(fileId0)),
        Stream.Readable.from([buf]),
        { contentLength: buf.byteLength }
      )
    })
    let output
    before('run script', async function () {
      output = await runScript(['--skip-hashed-files', '--concurrency=1'])
    })

    it('should print stats', function () {
      expect(output.stats).deep.equal(
        sumStats(STATS_ALL, {
          ...STATS_ALL_ZERO,
        })
      )
    })
    commonAssertions()
  })

  describe('split run CONCURRENCY=1', function () {
    // part0: project0+project1, part1: project2 onwards
    const edge = projectId1.toString()
    let outputPart0, outputPart1
    before('prepare environment', prepareEnvironment)
    before('run script on part 0', async function () {
      outputPart0 = await runScript([
        '--skip-hashed-files',
        `--BATCH_RANGE_END=${edge}`,
        '--concurrency=1',
      ])
    })
    before('run script on part 1', async function () {
      outputPart1 = await runScript([
        '--skip-hashed-files',
        `--BATCH_RANGE_START=${edge}`,
        '--concurrency=1',
      ])
    })

    it('should print stats for part 0', function () {
      expect(outputPart0.stats).to.deep.equal(STATS_UP_TO_PROJECT1)
    })
    it('should print stats for part 1', function () {
      expect(outputPart1.stats).to.deep.equal(STATS_UP_FROM_PROJECT1_ONWARD)
    })
    it('should warn about split run', () => {
      expect(outputPart0.result.stderr).to.include(
        'The binary files migration succeeded on a subset of files'
      )
      expect(outputPart1.result.stderr).to.include(
        'The binary files migration succeeded on a subset of files'
      )
    })
    commonAssertions()

    describe('with a full run afterwards', () => {
      let output
      before('run script', async function () {
        output = await runScript([])
      })
      it('should print stats', function () {
        expect(output.stats).to.deep.equal(
          sumStats(statsForRerun(false), STATS_FILES_HASHED_EXTRA)
        )
      })
      it('should create the migration', () => {
        expect(output.migrationCreated).to.equal(true)
      })
    })
  })

  describe('projectIds from file', function () {
    const path0 = '/tmp/project-ids-0.txt'
    const path1 = '/tmp/project-ids-1.txt'
    before('prepare environment', prepareEnvironment)
    before('create project-ids.txt files', async function () {
      await fs.promises.writeFile(
        path0,
        [projectId0, projectId1].map(id => id.toString()).join('\n')
      )
      await fs.promises.writeFile(
        path1,
        [
          projectId2,
          projectId3,
          projectIdDeleted0,
          projectIdDeleted1,
          projectIdNoHistory,
          projectIdNoHistoryDeleted,
          projectIdHardDeleted,
          projectIdNoOverleaf,
          projectIdNoOverleafDeleted,
          projectIdBadFileTree0,
          projectIdBadFileTree1,
          projectIdBadFileTree2,
          projectIdBadFileTree3,
        ]
          .map(id => id.toString())
          .join('\n')
      )
    })

    let outputPart0, outputPart1
    before('run script on part 0', async function () {
      outputPart0 = await runScript([
        '--skip-hashed-files',
        `--from-file=${path0}`,
      ])
    })
    before('run script on part 1', async function () {
      outputPart1 = await runScript([
        '--skip-hashed-files',
        `--from-file=${path1}`,
      ])
    })

    /**
     * @param {string} msg
     * @param {ObjectId} projectId
     */
    function expectLogEntry(msg, projectId) {
      expect(outputPart1.result.stdout).to.include(msg)
      const log = JSON.parse(
        outputPart1.result.stdout
          .split('\n')
          .find(l => l.includes(`"${msg}"`) && l.includes(projectId.toString()))
      )
      expect(log).to.contain({
        projectId: projectId.toString(),
        msg,
      })
    }
    it('should flag the hard-deleted project', function () {
      expectLogEntry('project hard-deleted', projectIdHardDeleted)
    })
    it('should flag the projects without history id', function () {
      expectLogEntry('project has no history id', projectIdNoOverleaf)
      expectLogEntry('project has no history id', projectIdNoOverleafDeleted)
      expectLogEntry('project has no history id', projectIdNoHistory)
      expectLogEntry('project has no history id', projectIdNoHistoryDeleted)
    })
    it('should print stats', function () {
      expect(outputPart0.stats).to.deep.equal(STATS_UP_TO_PROJECT1)
      expect(outputPart1.stats).to.deep.equal(STATS_UP_FROM_PROJECT1_ONWARD)
    })
    it('should not create the migration ', () => {
      expect(outputPart0.migrationCreated).to.equal(false)
      expect(outputPart1.migrationCreated).to.equal(false)
    })
    commonAssertions()
  })
})
