import Crypto from 'node:crypto'
import Stream from 'node:stream'
import { setTimeout } from 'node:timers/promises'
import { promisify } from 'node:util'
import { ObjectId, Binary } from 'mongodb'
import {
  db,
  backedUpBlobs,
  globalBlobs,
} from '../../../../storage/lib/mongodb.js'
import cleanup from './support/cleanup.js'
import testProjects from '../api/support/test_projects.js'
import { execFile } from 'node:child_process'
import { expect } from 'chai'
import config from 'config'
import ObjectPersistor from '@overleaf/object-persistor'
import { WritableBuffer } from '@overleaf/stream-utils'
import {
  backupPersistor,
  projectBlobsBucket,
} from '../../../../storage/lib/backupPersistor.mjs'
import projectKey from '../../../../storage/lib/project_key.js'
import {
  BlobStore,
  makeProjectKey,
} from '../../../../storage/lib/blob_store/index.js'

const TIMEOUT = 20 * 1_000

const { deksBucket } = config.get('backupStore')
const { tieringStorageClass } = config.get('backupPersistor')

const projectsCollection = db.collection('projects')
const deletedProjectsCollection = db.collection('deletedProjects')
const deletedFilesCollection = db.collection('deletedFiles')

const FILESTORE_PERSISTOR = ObjectPersistor({
  backend: 'gcs',
  gcs: {
    endpoint: {
      apiEndpoint: process.env.GCS_API_ENDPOINT,
      projectId: process.env.GCS_PROJECT_ID,
    },
  },
})

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

async function listS3Bucket(bucket, wantStorageClass) {
  const client = backupPersistor._getClientForBucket(bucket)
  const response = await client.listObjectsV2({ Bucket: bucket }).promise()

  for (const object of response.Contents || []) {
    expect(object).to.have.property('StorageClass', wantStorageClass)
  }

  return (response.Contents || []).map(item => item.Key || '')
}

function objectIdFromTime(timestamp) {
  return ObjectId.createFromTime(new Date(timestamp).getTime() / 1000)
}

const PRINT_IDS_AND_HASHES_FOR_DEBUGGING = false

describe('back_fill_file_hash script', function () {
  this.timeout(TIMEOUT)
  const USER_FILES_BUCKET_NAME = 'fake-user-files-gcs'

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
  const historyId0 = 42 // stored as number is mongo
  const historyId1 = projectId1.toString()
  const historyId2 = projectId2.toString()
  const historyId3 = projectId3.toString()
  const historyIdDeleted0 = projectIdDeleted0.toString()
  const historyIdDeleted1 = projectIdDeleted1.toString()
  const fileId0 = objectIdFromTime('2017-02-01T00:00:00Z')
  const fileId1 = objectIdFromTime('2017-02-01T00:01:00Z')
  const fileId2 = objectIdFromTime('2017-02-01T00:02:00Z')
  const fileId3 = objectIdFromTime('2017-02-01T00:03:00Z')
  const fileId4 = objectIdFromTime('2017-02-01T00:04:00Z')
  const fileId5 = objectIdFromTime('2024-02-01T00:05:00Z')
  const fileId6 = objectIdFromTime('2017-02-01T00:06:00Z')
  const fileId7 = objectIdFromTime('2017-02-01T00:07:00Z')
  const fileIdDeleted1 = objectIdFromTime('2017-02-01T00:07:00Z')
  const fileIdDeleted2 = objectIdFromTime('2017-02-01T00:08:00Z')
  const fileIdDeleted3 = objectIdFromTime('2017-02-01T00:09:00Z')
  const fileIdDeleted4 = objectIdFromTime('2024-02-01T00:10:00Z')
  const fileIdDeleted5 = objectIdFromTime('2024-02-01T00:11:00Z')
  const deleteProjectsRecordId0 = new ObjectId()
  const deleteProjectsRecordId1 = new ObjectId()
  const deleteProjectsRecordId2 = new ObjectId()
  const deleteProjectsRecordId3 = new ObjectId()
  const deleteProjectsRecordId4 = new ObjectId()
  const contentFile7 = Buffer.alloc(11_000_000)
  const hashFile7 = gitBlobHashBuffer(contentFile7)
  const writtenBlobs = [
    { projectId: projectId0, historyId: historyId0, fileId: fileId0 },
    // { historyId: projectId0, fileId: fileId6 }, // global blob
    {
      projectId: projectId0,
      historyId: historyId0,
      fileId: fileId7,
      hash: hashFile7,
    },
    { projectId: projectId0, historyId: historyId0, fileId: fileIdDeleted5 },
    { projectId: projectId1, historyId: historyId1, fileId: fileId1 },
    { projectId: projectId1, historyId: historyId1, fileId: fileIdDeleted1 },
    // { historyId: historyId2, fileId: fileId2 }, // already has hash
    // { historyId: historyId3, fileId: fileId3 }, // too new
    {
      projectId: projectIdDeleted0,
      historyId: historyIdDeleted0,
      fileId: fileId4,
    },
    {
      projectId: projectIdDeleted0,
      historyId: historyIdDeleted0,
      fileId: fileIdDeleted2,
    },
    // { historyId: historyIdDeleted0, fileId:fileIdDeleted3 }, // fileIdDeleted3 is dupe of fileIdDeleted2
    // { historyId: historyIdDeleted0, fileId: fileIdDeleted4 }, // already has hash
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
      fileIdDeleted1,
      fileIdDeleted2,
      fileIdDeleted3,
      fileIdDeleted4,
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
      console.log(name, gitBlobHash(v))
    }
  }

  beforeEach(cleanup.everything)
  beforeEach('cleanup s3 buckets', async function () {
    await backupPersistor.deleteDirectory(deksBucket, '')
    await backupPersistor.deleteDirectory(projectBlobsBucket, '')
    expect(await listS3Bucket(deksBucket)).to.have.length(0)
    expect(await listS3Bucket(projectBlobsBucket)).to.have.length(0)
  })

  beforeEach('populate mongo', async function () {
    await globalBlobs.insertMany([
      { _id: gitBlobHash(fileId6), byteLength: 24, stringLength: 24 },
    ])
    await projectsCollection.insertMany([
      {
        _id: projectId0,
        rootFolder: [
          {
            fileRefs: [{ _id: fileId0 }, { _id: fileId6 }, { _id: fileId7 }],
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
                    fileRefs: [{ _id: fileId3, hash: gitBlobHash(fileId3) }],
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
    await deletedFilesCollection.insertMany([
      { _id: fileIdDeleted1, projectId: projectId1 },
      { _id: fileIdDeleted2, projectId: projectIdDeleted0 },
      { _id: fileIdDeleted3, projectId: projectIdDeleted0 },
      {
        _id: fileIdDeleted4,
        projectId: projectIdDeleted0,
        hash: gitBlobHash(fileIdDeleted4),
      },
      { _id: fileIdDeleted5, projectId: projectId0 },
    ])

    await testProjects.createEmptyProject(historyId0.toString())
    await testProjects.createEmptyProject(historyId1)
    await testProjects.createEmptyProject(historyId2)
    await testProjects.createEmptyProject(historyId3)
    await testProjects.createEmptyProject(historyIdDeleted0)
    await testProjects.createEmptyProject(historyIdDeleted1)
  })

  beforeEach('populate filestore', async function () {
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectId0}/${fileId0}`,
      Stream.Readable.from([fileId0.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectId0}/${fileId6}`,
      Stream.Readable.from([fileId6.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectId0}/${fileId7}`,
      Stream.Readable.from([contentFile7])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectId0}/${fileIdDeleted5}`,
      Stream.Readable.from([fileIdDeleted5.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectId1}/${fileId1}`,
      Stream.Readable.from([fileId1.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectId2}/${fileId2}`,
      Stream.Readable.from([fileId2.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectId3}/${fileId3}`,
      Stream.Readable.from([fileId3.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectIdDeleted0}/${fileId4}`,
      Stream.Readable.from([fileId4.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectIdDeleted1}/${fileId5}`,
      Stream.Readable.from([fileId5.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectId1}/${fileIdDeleted1}`,
      Stream.Readable.from([fileIdDeleted1.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectIdDeleted0}/${fileIdDeleted2}`,
      Stream.Readable.from([fileIdDeleted2.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectIdDeleted0}/${fileIdDeleted3}`,
      // same content as 2, deduplicate
      Stream.Readable.from([fileIdDeleted2.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectIdDeleted0}/${fileIdDeleted4}`,
      Stream.Readable.from([fileIdDeleted4.toString()])
    )
  })

  async function tryRunScript(env = {}) {
    let result
    try {
      result = await promisify(execFile)(
        process.argv0,
        [
          'storage/scripts/back_fill_file_hash.mjs',
          'live',
          'deleted',
          'deletedFiles',
        ],
        {
          encoding: 'utf-8',
          timeout: TIMEOUT - 500,
          env: {
            ...process.env,
            USER_FILES_BUCKET_NAME,
            ...env,
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
    const stats = JSON.parse(result.stdout.trimEnd().split('\n').pop())
    expect(new Date(stats.time).toISOString()).to.equal(stats.time)
    delete stats.time
    return { stats, result }
  }

  async function runScript(env = {}) {
    const { stats, result } = await tryRunScript(env)
    if (result.status !== 0) {
      console.log(result)
      expect(result).to.have.property('status', 0)
    }
    return { stats, result }
  }

  function commonAssertions() {
    it('should update mongo', async function () {
      expect(await projectsCollection.find({}).toArray()).to.deep.equal([
        {
          _id: projectId0,
          rootFolder: [
            {
              fileRefs: [
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
                      fileRefs: [{ _id: fileId1, hash: gitBlobHash(fileId1) }],
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
                      fileRefs: [{ _id: fileId3, hash: gitBlobHash(fileId3) }],
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
      expect(await deletedFilesCollection.find({}).toArray()).to.deep.equal([
        {
          _id: fileIdDeleted1,
          projectId: projectId1,
          hash: gitBlobHash(fileIdDeleted1),
        },
        {
          _id: fileIdDeleted2,
          projectId: projectIdDeleted0,
          hash: gitBlobHash(fileIdDeleted2),
        },
        {
          _id: fileIdDeleted3,
          projectId: projectIdDeleted0,
          // uses the same content as fileIdDeleted2
          hash: gitBlobHash(fileIdDeleted2),
        },
        {
          _id: fileIdDeleted4,
          projectId: projectIdDeleted0,
          hash: gitBlobHash(fileIdDeleted4),
        },
        {
          _id: fileIdDeleted5,
          projectId: projectId0,
          hash: gitBlobHash(fileIdDeleted5),
        },
      ])
      expect(
        (await backedUpBlobs.find({}, { sort: { _id: 1 } }).toArray()).map(
          entry => {
            // blobs are pushed unordered into mongo. Sort the list for consistency.
            entry.blobs.sort()
            return entry
          }
        )
      ).to.deep.equal([
        {
          _id: projectId0,
          blobs: [
            binaryForGitBlobHash(gitBlobHash(fileId0)),
            binaryForGitBlobHash(hashFile7),
            binaryForGitBlobHash(gitBlobHash(fileIdDeleted5)),
          ].sort(),
        },
        {
          _id: projectId1,
          blobs: [
            binaryForGitBlobHash(gitBlobHash(fileId1)),
            binaryForGitBlobHash(gitBlobHash(fileIdDeleted1)),
          ].sort(),
        },
        {
          _id: projectIdDeleted0,
          blobs: [
            binaryForGitBlobHash(gitBlobHash(fileId4)),
            binaryForGitBlobHash(gitBlobHash(fileIdDeleted2)),
          ].sort(),
        },
      ])
    })
    it('should process nothing on re-run', async function () {
      const rerun = await runScript()
      expect(rerun.stats).deep.equal({
        ...STATS_ALL_ZERO,
        // We still need to iterate over all the projects.
        projects: 4,
      })
    })
    it('should have backed up all the files', async function () {
      expect(tieringStorageClass).to.exist
      const blobs = await listS3Bucket(projectBlobsBucket, tieringStorageClass)
      expect(blobs.sort()).to.deep.equal(
        writtenBlobs
          .map(({ historyId, fileId, hash }) =>
            makeProjectKey(historyId, hash || gitBlobHash(fileId))
          )
          .sort()
      )
      for (let { historyId, fileId, hash } of writtenBlobs) {
        hash = hash || gitBlobHash(fileId.toString())
        const s = await backupPersistor.getObjectStream(
          projectBlobsBucket,
          makeProjectKey(historyId, hash),
          { autoGunzip: true }
        )
        const buf = new WritableBuffer()
        await Stream.promises.pipeline(s, buf)
        expect(gitBlobHashBuffer(buf.getContents())).to.equal(hash)
        if (fileId !== fileId7) {
          const id = buf.getContents().toString('utf-8')
          expect(id).to.equal(fileId.toString())
          // double check we are not comparing 'undefined' or '[object Object]' above
          expect(id).to.match(/^[a-f0-9]{24}$/)
        }
      }
      const deks = await listS3Bucket(deksBucket, 'STANDARD')
      expect(deks.sort()).to.deep.equal(
        Array.from(
          new Set(
            writtenBlobs.map(
              ({ historyId }) => projectKey.format(historyId) + '/dek'
            )
          )
        ).sort()
      )
    })
    it('should have written the back filled files to history v1', async function () {
      for (const { historyId, fileId } of writtenBlobs) {
        const blobStore = new BlobStore(historyId.toString())
        if (fileId === fileId7) {
          const s = await blobStore.getStream(hashFile7)
          const buf = new WritableBuffer()
          await Stream.promises.pipeline(s, buf)
          expect(buf.getContents()).to.deep.equal(contentFile7)
          continue
        }
        const id = await blobStore.getString(gitBlobHash(fileId.toString()))
        expect(id).to.equal(fileId.toString())
        // double check we are not comparing 'undefined' or '[object Object]' above
        expect(id).to.match(/^[a-f0-9]{24}$/)
      }
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
      path: 'rootFolder.0.fileRefs.0',
      msg,
    })
    expect(log.err).to.contain({
      name: 'NotFoundError',
    })
  }

  const STATS_ALL_ZERO = {
    projects: 0,
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
    mongoUpdates: 0,
    deduplicatedWriteToAWSLocalCount: 0,
    deduplicatedWriteToAWSLocalEgress: 0,
    deduplicatedWriteToAWSRemoteCount: 0,
    deduplicatedWriteToAWSRemoteEgress: 0,
    writeToAWSCount: 0,
    writeToAWSEgress: 0,
  }
  const STATS_UP_TO_PROJECT1 = {
    projects: 2,
    filesWithoutHash: 7,
    filesDuplicated: 1,
    filesRetries: 0,
    filesFailed: 0,
    globalBlobsCount: 1,
    globalBlobsEgress: 30,
    fileTreeUpdated: 0,
    projectDeleted: 0,
    projectHardDeleted: 0,
    fileHardDeleted: 0,
    mongoUpdates: 6,
    deduplicatedWriteToAWSLocalCount: 0,
    deduplicatedWriteToAWSLocalEgress: 0,
    deduplicatedWriteToAWSRemoteCount: 0,
    deduplicatedWriteToAWSRemoteEgress: 0,
    writeToAWSCount: 5,
    writeToAWSEgress: 11000118,
  }
  const STATS_UP_FROM_PROJECT1_ONWARD = {
    projects: 2,
    filesWithoutHash: 3,
    filesDuplicated: 0,
    filesRetries: 0,
    filesFailed: 0,
    globalBlobsCount: 0,
    globalBlobsEgress: 0,
    fileTreeUpdated: 0,
    projectDeleted: 0,
    projectHardDeleted: 0,
    fileHardDeleted: 0,
    mongoUpdates: 4,
    deduplicatedWriteToAWSLocalCount: 1,
    deduplicatedWriteToAWSLocalEgress: 30,
    deduplicatedWriteToAWSRemoteCount: 0,
    deduplicatedWriteToAWSRemoteEgress: 0,
    writeToAWSCount: 2,
    writeToAWSEgress: 58,
  }

  function sumStats(a, b) {
    return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v + b[k]]))
  }

  const STATS_ALL = sumStats(
    STATS_UP_TO_PROJECT1,
    STATS_UP_FROM_PROJECT1_ONWARD
  )

  it('should gracefully handle fatal errors', async function () {
    await FILESTORE_PERSISTOR.deleteObject(
      USER_FILES_BUCKET_NAME,
      `${projectId0}/${fileId0}`
    )
    const t0 = Date.now()
    const { stats, result } = await tryRunScript({
      RETRIES: '10',
      RETRY_DELAY_MS: '1000',
    })
    const t1 = Date.now()
    expectNotFoundError(result, 'failed to process file')
    expect(result.status).to.equal(1)
    expect(stats).to.deep.equal(
      sumStats(STATS_ALL, {
        ...STATS_ALL_ZERO,
        filesFailed: 1,
        writeToAWSCount: -1,
        writeToAWSEgress: -28,
      })
    )
    // should not retry 404
    expect(result.stdout).to.not.include('failed to process file, trying again')
    expect(t1 - t0).to.be.below(10_000)
  })

  it('should retry on error', async function () {
    await FILESTORE_PERSISTOR.deleteObject(
      USER_FILES_BUCKET_NAME,
      `${projectId0}/${fileId0}`
    )
    const restoreFileAfter5s = async () => {
      await setTimeout(5_000)
      await FILESTORE_PERSISTOR.sendStream(
        USER_FILES_BUCKET_NAME,
        `${projectId0}/${fileId0}`,
        Stream.Readable.from([fileId0.toString()])
      )
    }
    // use Promise.allSettled to ensure the above sendStream call finishes before this test completes
    const [
      {
        value: { stats, result },
      },
    ] = await Promise.allSettled([
      tryRunScript({
        RETRY_DELAY_MS: '100',
        RETRIES: '60',
        RETRY_FILESTORE_404: 'true', // 404s are the easiest to simulate in tests
      }),
      restoreFileAfter5s(),
    ])
    expectNotFoundError(result, 'failed to process file, trying again')
    expect(result.status).to.equal(0)
    expect({ ...stats, filesRetries: 0 }).to.deep.equal(STATS_ALL)
    expect(stats.filesRetries).to.be.greaterThan(0)
  })

  describe('full run CONCURRENCY=1', function () {
    let output
    beforeEach('run script', async function () {
      output = await runScript({
        CONCURRENCY: '1',
      })
    })

    it('should print stats', function () {
      expect(output.stats).deep.equal(STATS_ALL)
    })
    commonAssertions()
  })

  describe('full run CONCURRENCY=10', function () {
    let output
    beforeEach('run script', async function () {
      output = await runScript({
        CONCURRENCY: '10',
      })
    })
    it('should print stats', function () {
      expect(output.stats).deep.equal(STATS_ALL)
    })
    commonAssertions()
  })

  describe('with something in the bucket already', function () {
    beforeEach('create a file in s3', async function () {
      const buf = Buffer.from(fileId0.toString())
      await backupPersistor.sendStream(
        projectBlobsBucket,
        makeProjectKey(historyId0, gitBlobHash(fileId0)),
        Stream.Readable.from([buf]),
        { contentLength: buf.byteLength }
      )
    })
    let output
    beforeEach('run script', async function () {
      output = await runScript({
        CONCURRENCY: '1',
      })
    })

    it('should print stats', function () {
      expect(output.stats).deep.equal(
        sumStats(STATS_ALL, {
          ...STATS_ALL_ZERO,
          // one remote deduplicate
          deduplicatedWriteToAWSRemoteCount: 1,
          deduplicatedWriteToAWSRemoteEgress: 28,
          writeToAWSEgress: -28, // subtract skipped egress
        })
      )
    })
    commonAssertions()
  })

  describe('split run CONCURRENCY=1', function () {
    // part0: project0+project1, part1: project2 onwards
    const edge = projectId1.toString()
    let outputPart0, outputPart1
    beforeEach('run script on part 0', async function () {
      outputPart0 = await runScript({
        CONCURRENCY: '1',
        BATCH_RANGE_END: edge,
      })
    })
    beforeEach('run script on part 1', async function () {
      outputPart1 = await runScript({
        CONCURRENCY: '1',
        BATCH_RANGE_START: edge,
      })
    })

    it('should print stats', function () {
      expect(outputPart0.stats).to.deep.equal(STATS_UP_TO_PROJECT1)
      expect(outputPart1.stats).to.deep.equal(STATS_UP_FROM_PROJECT1_ONWARD)
    })
    commonAssertions()
  })
})
