import fs from 'node:fs'
import Crypto from 'node:crypto'
import Stream from 'node:stream'
import { promisify } from 'node:util'
import { Binary, ObjectId } from 'mongodb'
import { Blob } from 'overleaf-editor-core'
import { backedUpBlobs, blobs, db } from '../../../../storage/lib/mongodb.js'
import cleanup from './support/cleanup.js'
import testProjects from '../api/support/test_projects.js'
import { execFile } from 'node:child_process'
import chai, { expect } from 'chai'
import chaiExclude from 'chai-exclude'
import config from 'config'
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
import ObjectPersistor from '@overleaf/object-persistor'

chai.use(chaiExclude)

const TIMEOUT = 20 * 1_000

const { deksBucket } = config.get('backupStore')
const { tieringStorageClass } = config.get('backupPersistor')

const projectsCollection = db.collection('projects')
const deletedProjectsCollection = db.collection('deletedProjects')

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

describe('back_fill_file_hash_fix_up script', function () {
  this.timeout(TIMEOUT)
  const USER_FILES_BUCKET_NAME = 'fake-user-files-gcs'

  const projectId0 = objectIdFromTime('2017-01-01T00:00:00Z')
  const projectIdDeleted0 = objectIdFromTime('2017-01-01T00:04:00Z')
  const historyId0 = 42 // stored as number is mongo
  const historyIdDeleted0 = projectIdDeleted0.toString()
  const fileIdWithDifferentHashFound = objectIdFromTime('2017-02-01T00:00:00Z')
  const fileIdInGoodState = objectIdFromTime('2017-02-01T00:01:00Z')
  const fileIdBlobExistsInGCS0 = objectIdFromTime('2017-02-01T00:02:00Z')
  const fileIdWithDifferentHashNotFound0 = objectIdFromTime(
    '2017-02-01T00:03:00Z'
  )
  const fileIdWithDifferentHashNotFound1 = objectIdFromTime(
    '2017-02-01T00:04:00Z'
  )
  const fileIdBlobExistsInGCSCorrupted = objectIdFromTime(
    '2017-02-01T00:05:00Z'
  )
  const fileIdMissing0 = objectIdFromTime('2024-02-01T00:06:00Z')
  const fileIdMissing1 = objectIdFromTime('2017-02-01T00:07:00Z')
  const fileIdWithDifferentHashRestore = objectIdFromTime(
    '2017-02-01T00:08:00Z'
  )
  const fileIdBlobExistsInGCS1 = objectIdFromTime('2017-02-01T00:09:00Z')
  const fileIdRestoreFromFilestore0 = objectIdFromTime('2017-02-01T00:10:00Z')
  const fileIdRestoreFromFilestore1 = objectIdFromTime('2017-02-01T00:11:00Z')
  const fileIdMissing2 = objectIdFromTime('2017-02-01T00:12:00Z')
  const fileIdHashMissing0 = objectIdFromTime('2017-02-01T00:13:00Z')
  const fileIdHashMissing1 = objectIdFromTime('2017-02-01T00:14:00Z')
  const contentCorruptedBlob = 'string that produces another hash'
  const contentDoesNotExistAsBlob = 'does not exist as blob'
  const hashDoesNotExistAsBlob = gitBlobHashBuffer(
    Buffer.from(contentDoesNotExistAsBlob)
  )
  const deleteProjectsRecordId0 = new ObjectId()
  const writtenBlobs = [
    {
      projectId: projectId0,
      historyId: historyId0,
      fileId: fileIdBlobExistsInGCS0,
    },
    {
      projectId: projectId0,
      historyId: historyId0,
      fileId: fileIdBlobExistsInGCS1,
    },
    {
      projectId: projectId0,
      historyId: historyId0,
      fileId: fileIdWithDifferentHashNotFound0,
    },
    {
      projectId: projectId0,
      historyId: historyId0,
      fileId: fileIdRestoreFromFilestore0,
    },
    {
      projectId: projectId0,
      historyId: historyId0,
      fileId: fileIdRestoreFromFilestore1,
    },
    {
      projectId: projectId0,
      historyId: historyId0,
      fileId: fileIdHashMissing0,
    },
    {
      projectId: projectId0,
      historyId: historyId0,
      fileId: fileIdHashMissing1,
    },
    {
      projectId: projectIdDeleted0,
      historyId: historyIdDeleted0,
      fileId: fileIdWithDifferentHashNotFound1,
    },
  ]
  const logs = [
    {
      projectId: projectId0,
      fileId: fileIdWithDifferentHashFound,
      err: { message: 'OError: hash mismatch' },
      hash: gitBlobHash(fileIdMissing0), // does not matter
      entry: {
        ctx: { historyId: historyId0.toString() },
        hash: gitBlobHash(fileIdInGoodState),
      },
      msg: 'failed to process file',
    },
    {
      projectId: projectId0,
      fileId: fileIdWithDifferentHashRestore,
      err: { message: 'OError: hash mismatch' },
      hash: hashDoesNotExistAsBlob,
      entry: {
        ctx: { historyId: historyId0.toString() },
        hash: gitBlobHash(fileIdMissing0), // does not matter
      },
      msg: 'failed to process file',
    },
    {
      projectId: projectId0,
      fileId: fileIdWithDifferentHashNotFound0,
      err: { message: 'OError: hash mismatch' },
      hash: gitBlobHash(fileIdWithDifferentHashNotFound0),
      entry: {
        ctx: { historyId: historyId0.toString() },
        hash: hashDoesNotExistAsBlob,
      },
      msg: 'failed to process file',
    },
    {
      projectId: projectId0,
      fileId: fileIdRestoreFromFilestore0,
      err: { message: 'OError: hash mismatch' },
      hash: gitBlobHash(fileIdRestoreFromFilestore0),
      entry: {
        ctx: { historyId: historyId0.toString() },
        hash: hashDoesNotExistAsBlob,
      },
      msg: 'failed to process file',
    },
    {
      projectId: projectIdDeleted0,
      fileId: fileIdWithDifferentHashNotFound1,
      err: { message: 'OError: hash mismatch' },
      hash: gitBlobHash(fileIdWithDifferentHashNotFound1),
      entry: {
        ctx: { historyId: historyIdDeleted0.toString() },
        hash: hashDoesNotExistAsBlob,
      },
      msg: 'failed to process file',
    },
    {
      projectId: projectId0,
      fileId: fileIdMissing0,
      bucketName: USER_FILES_BUCKET_NAME,
      err: { message: 'NotFoundError' },
      msg: 'failed to process file',
    },
    {
      projectId: projectId0,
      fileId: fileIdMissing2,
      bucketName: USER_FILES_BUCKET_NAME,
      err: { message: 'NotFoundError' },
      msg: 'failed to process file',
    },
    {
      projectId: projectId0,
      fileId: fileIdBlobExistsInGCS0,
      hash: gitBlobHash(fileIdBlobExistsInGCS0),
      err: { message: 'storage.objects.delete' },
      msg: 'failed to process file',
    },
    {
      projectId: projectId0,
      fileId: fileIdBlobExistsInGCSCorrupted,
      hash: gitBlobHash(fileIdBlobExistsInGCSCorrupted),
      err: { message: 'storage.objects.delete' },
      msg: 'failed to process file',
    },
    {
      projectId: projectId0,
      fileId: fileIdBlobExistsInGCS1,
      hash: gitBlobHash(fileIdBlobExistsInGCS1),
      err: { message: 'storage.objects.delete' },
      msg: 'failed to process file',
    },
    {
      projectId: projectId0,
      fileId: fileIdRestoreFromFilestore1,
      err: { message: 'storage.objects.delete' },
      msg: 'failed to process file',
    },
    {
      projectId: projectIdDeleted0,
      fileId: fileIdMissing1,
      bucketName: USER_FILES_BUCKET_NAME,
      err: { message: 'NotFoundError' },
      msg: 'failed to process file',
    },
    {
      err: { message: 'spurious error' },
      msg: 'failed to process file, trying again',
    },
    {
      err: { message: 'some other error' },
      msg: 'failed to process file',
    },
    // from find_malformed_filetrees.mjs
    {
      projectId: projectId0,
      _id: fileIdHashMissing0,
      reason: 'bad file hash',
      msg: 'bad file-tree path',
    },
    {
      projectId: projectId0,
      _id: fileIdHashMissing1,
      reason: 'bad file hash',
      msg: 'bad file-tree path',
    },
  ]
  if (PRINT_IDS_AND_HASHES_FOR_DEBUGGING) {
    const fileIds = {
      fileIdWithDifferentHashFound,
      fileIdInGoodState,
      fileIdBlobExistsInGCS0,
      fileIdBlobExistsInGCS1,
      fileIdWithDifferentHashNotFound0,
      fileIdWithDifferentHashNotFound1,
      fileIdBlobExistsInGCSCorrupted,
      fileIdMissing0,
      fileIdMissing1,
      fileIdMissing2,
      fileIdWithDifferentHashRestore,
      fileIdRestoreFromFilestore0,
      fileIdRestoreFromFilestore1,
      fileIdHashMissing0,
      fileIdHashMissing1,
    }
    console.log({
      projectId0,
      projectIdDeleted0,
      historyId0,
      historyIdDeleted0,
      ...fileIds,
      hashDoesNotExistAsBlob,
    })
    for (const [name, v] of Object.entries(fileIds)) {
      console.log(
        name,
        gitBlobHash(v),
        Array.from(binaryForGitBlobHash(gitBlobHash(v)).value())
      )
    }
  }

  before(cleanup.everything)

  before('populate blobs/GCS', async function () {
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectId0}/${fileIdRestoreFromFilestore0}`,
      Stream.Readable.from([fileIdRestoreFromFilestore0.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectId0}/${fileIdRestoreFromFilestore1}`,
      Stream.Readable.from([fileIdRestoreFromFilestore1.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectId0}/${fileIdHashMissing0}`,
      Stream.Readable.from([fileIdHashMissing0.toString()])
    )
    await FILESTORE_PERSISTOR.sendStream(
      USER_FILES_BUCKET_NAME,
      `${projectId0}/${fileIdHashMissing1}`,
      Stream.Readable.from([fileIdHashMissing1.toString()])
    )
    await new BlobStore(historyId0.toString()).putString(
      fileIdHashMissing1.toString() // partially processed
    )
    await new BlobStore(historyId0.toString()).putString(
      fileIdBlobExistsInGCS0.toString()
    )
    await new BlobStore(historyId0.toString()).putString(
      fileIdBlobExistsInGCS1.toString()
    )
    await new BlobStore(historyId0.toString()).putString(
      fileIdRestoreFromFilestore1.toString()
    )
    const path = '/tmp/test-blob-corrupted'
    try {
      await fs.promises.writeFile(path, contentCorruptedBlob)
      await new BlobStore(historyId0.toString()).putBlob(
        path,
        new Blob(gitBlobHash(fileIdBlobExistsInGCSCorrupted), 42)
      )
    } finally {
      await fs.promises.rm(path, { force: true })
    }
    await cleanup.postgres()
    await cleanup.mongo()
    await Promise.all([
      testProjects.createEmptyProject(historyId0.toString()),
      testProjects.createEmptyProject(historyIdDeleted0),
    ])
    await new BlobStore(historyId0.toString()).putString(
      fileIdWithDifferentHashNotFound0.toString()
    )
    await new BlobStore(historyIdDeleted0.toString()).putString(
      fileIdWithDifferentHashNotFound1.toString()
    )
    await new BlobStore(historyId0.toString()).putString(
      fileIdInGoodState.toString()
    )
  })

  before('populate mongo', async function () {
    await projectsCollection.insertMany([
      {
        _id: projectId0,
        rootFolder: [
          {
            fileRefs: [
              { _id: fileIdMissing0 },
              { _id: fileIdMissing0 }, // bad file-tree, duplicated fileRef.
              { _id: fileIdMissing2 },
              { _id: fileIdHashMissing0 },
              { _id: fileIdHashMissing1 },
              {
                _id: fileIdWithDifferentHashFound,
                hash: gitBlobHash(fileIdInGoodState),
              },
              {
                _id: fileIdWithDifferentHashRestore,
                hash: gitBlobHash(fileIdMissing0),
              },
            ],
            folders: [
              {
                docs: [],
              },
              null,
              {
                fileRefs: [
                  null,
                  {
                    _id: fileIdInGoodState,
                    hash: gitBlobHash(fileIdInGoodState),
                  },
                  {
                    _id: fileIdWithDifferentHashNotFound0,
                    hash: hashDoesNotExistAsBlob,
                  },
                  {
                    _id: fileIdRestoreFromFilestore0,
                    hash: hashDoesNotExistAsBlob,
                  },
                  {
                    _id: fileIdRestoreFromFilestore1,
                  },
                  {
                    _id: fileIdBlobExistsInGCS0,
                    hash: gitBlobHash(fileIdBlobExistsInGCS0),
                  },
                  {
                    _id: fileIdBlobExistsInGCSCorrupted,
                    hash: gitBlobHash(fileIdBlobExistsInGCSCorrupted),
                  },
                  { _id: fileIdBlobExistsInGCS1 },
                ],
                folders: [],
              },
            ],
          },
        ],
        overleaf: { history: { id: historyId0 } },
        version: 0,
      },
    ])
    await deletedProjectsCollection.insertMany([
      {
        _id: deleteProjectsRecordId0,
        project: {
          _id: projectIdDeleted0,
          rootFolder: [
            {
              fileRefs: [
                {
                  _id: fileIdWithDifferentHashNotFound1,
                  hash: hashDoesNotExistAsBlob,
                },
              ],
              folders: [
                {
                  fileRefs: [],
                  folders: [
                    { fileRefs: [{ _id: fileIdMissing1 }], folders: [] },
                  ],
                },
              ],
            },
          ],
          overleaf: { history: { id: historyIdDeleted0 } },
          version: 100,
        },
        deleterData: {
          deletedProjectId: projectIdDeleted0,
        },
      },
    ])
  })

  /**
   * @param {Array<string>} args
   * @param {Record<string, string>} env
   * @return {Promise<{ stdout: string, stderr: string, status: number }>}
   */
  async function tryRunScript(args = [], env = {}) {
    let result
    try {
      result = await promisify(execFile)(
        process.argv0,
        ['storage/scripts/back_fill_file_hash_fix_up.mjs', ...args],
        {
          encoding: 'utf-8',
          timeout: TIMEOUT - 500,
          env: {
            ...process.env,
            USER_FILES_BUCKET_NAME,
            SLEEP_BEFORE_EXIT: '1',
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
    expect((await fs.promises.readdir('/tmp')).join(';')).to.not.match(
      /back_fill_file_hash/
    )
    return result
  }
  async function runScriptWithLogs() {
    const logsPath = '/tmp/test-script-logs'
    let result
    try {
      await fs.promises.writeFile(
        logsPath,
        logs.map(e => JSON.stringify(e)).join('\n')
      )
      result = await tryRunScript([`--logs=${logsPath}`])
    } finally {
      await fs.promises.rm(logsPath, { force: true })
    }
    const stats = JSON.parse(result.stdout.trim().split('\n').pop())
    return {
      result,
      stats,
    }
  }

  let result, stats
  before(async function () {
    ;({ result, stats } = await runScriptWithLogs())
  })
  it('should print stats', function () {
    expect(stats).to.contain({
      processedLines: 16,
      success: 11,
      alreadyProcessed: 0,
      fileDeleted: 0,
      skipped: 0,
      failed: 3,
      unmatched: 1,
    })
  })
  it('should handle re-run on same logs', async function () {
    ;({ stats } = await runScriptWithLogs())
    expect(stats).to.contain({
      processedLines: 16,
      success: 0,
      alreadyProcessed: 8,
      fileDeleted: 3,
      skipped: 0,
      failed: 3,
      unmatched: 1,
    })
  })
  it('should flag the unknown fatal error', function () {
    const unknown = result.stdout
      .split('\n')
      .filter(l => l.includes('unknown fatal error'))
    expect(unknown).to.have.length(1)
    const [line] = unknown
    expect(line).to.exist
    expect(line).to.include('some other error')
  })
  it('should flag the unexpected blob on mismatched hash', function () {
    const line = result.stdout
      .split('\n')
      .find(l => l.includes('found blob with computed filestore object hash'))
    expect(line).to.exist
    expect(line).to.include(projectId0.toString())
    expect(line).to.include(fileIdWithDifferentHashFound.toString())
    expect(line).to.include(gitBlobHash(fileIdInGoodState))
  })
  it('should flag the need to restore', function () {
    const line = result.stdout
      .split('\n')
      .find(l => l.includes('missing blob, need to restore filestore file'))
    expect(line).to.exist
    expect(line).to.include(projectId0.toString())
    expect(line).to.include(fileIdWithDifferentHashRestore.toString())
    expect(line).to.include(hashDoesNotExistAsBlob)
  })
  it('should flag the corrupted blob', function () {
    const line = result.stdout
      .split('\n')
      .find(l => l.includes('blob corrupted'))
    expect(line).to.exist
    expect(line).to.include(projectId0.toString())
    expect(line).to.include(fileIdBlobExistsInGCSCorrupted.toString())
    expect(line).to.include(
      gitBlobHashBuffer(Buffer.from(contentCorruptedBlob))
    )
    expect(line).to.include(gitBlobHash(fileIdBlobExistsInGCSCorrupted))
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
                // Removed
                // { _id: fileIdMissing0 },
                // Removed
                // { _id: fileIdMissing2 },
                // Added hash
                {
                  _id: fileIdHashMissing0,
                  hash: gitBlobHash(fileIdHashMissing0),
                },
                // Added hash
                {
                  _id: fileIdHashMissing1,
                  hash: gitBlobHash(fileIdHashMissing1),
                },
                // No change, should warn about the find.
                {
                  _id: fileIdWithDifferentHashFound,
                  hash: gitBlobHash(fileIdInGoodState),
                },
                // No change, should warn about the need to restore.
                {
                  _id: fileIdWithDifferentHashRestore,
                  hash: gitBlobHash(fileIdMissing0),
                },
              ],
              folders: [
                {
                  docs: [],
                },
                null,
                {
                  fileRefs: [
                    null,
                    // No change
                    {
                      _id: fileIdInGoodState,
                      hash: gitBlobHash(fileIdInGoodState),
                    },
                    // Updated hash
                    {
                      _id: fileIdWithDifferentHashNotFound0,
                      hash: gitBlobHash(fileIdWithDifferentHashNotFound0),
                    },
                    // Updated hash
                    {
                      _id: fileIdRestoreFromFilestore0,
                      hash: gitBlobHash(fileIdRestoreFromFilestore0),
                    },
                    // Added hash
                    {
                      _id: fileIdRestoreFromFilestore1,
                      hash: gitBlobHash(fileIdRestoreFromFilestore1),
                    },
                    // No change, blob created
                    {
                      _id: fileIdBlobExistsInGCS0,
                      hash: gitBlobHash(fileIdBlobExistsInGCS0),
                    },
                    // No change, flagged
                    {
                      _id: fileIdBlobExistsInGCSCorrupted,
                      hash: gitBlobHash(fileIdBlobExistsInGCSCorrupted),
                    },
                    // Added hash
                    {
                      _id: fileIdBlobExistsInGCS1,
                      hash: gitBlobHash(fileIdBlobExistsInGCS1),
                    },
                  ],
                  folders: [],
                },
              ],
            },
          ],
          overleaf: { history: { id: historyId0 } },
          // Incremented when removing file/updating hash
          version: 8,
        },
      ])
    expect(await deletedProjectsCollection.find({}).toArray()).to.deep.equal([
      {
        _id: deleteProjectsRecordId0,
        project: {
          _id: projectIdDeleted0,
          rootFolder: [
            {
              fileRefs: [
                // Updated hash
                {
                  _id: fileIdWithDifferentHashNotFound1,
                  hash: gitBlobHash(fileIdWithDifferentHashNotFound1),
                },
              ],
              folders: [
                {
                  fileRefs: [],
                  folders: [
                    {
                      fileRefs: [
                        // Removed
                        // { _id: fileIdMissing1 },
                      ],
                      folders: [],
                    },
                  ],
                },
              ],
            },
          ],
          overleaf: { history: { id: historyIdDeleted0 } },
          // Incremented when removing file/updating hash
          version: 102,
        },
        deleterData: {
          deletedProjectId: projectIdDeleted0,
        },
      },
    ])
    const writtenBlobsByProject = new Map()
    for (const { projectId, fileId } of writtenBlobs) {
      writtenBlobsByProject.set(
        projectId,
        (writtenBlobsByProject.get(projectId) || []).concat([fileId])
      )
    }
    expect(
      (await backedUpBlobs.find({}, { sort: { _id: 1 } }).toArray()).map(
        entry => {
          // blobs are pushed unordered into mongo. Sort the list for consistency.
          entry.blobs.sort()
          return entry
        }
      )
    ).to.deep.equal(
      Array.from(writtenBlobsByProject.entries()).map(
        ([projectId, fileIds]) => {
          return {
            _id: projectId,
            blobs: fileIds
              .map(fileId => binaryForGitBlobHash(gitBlobHash(fileId)))
              .sort(),
          }
        }
      )
    )
  })
  it('should have backed up all the files', async function () {
    expect(tieringStorageClass).to.exist
    const objects = await listS3Bucket(projectBlobsBucket, tieringStorageClass)
    expect(objects.sort()).to.deep.equal(
      writtenBlobs
        .map(({ historyId, fileId, hash }) =>
          makeProjectKey(historyId, hash || gitBlobHash(fileId))
        )
        .sort()
    )
    for (let { historyId, fileId } of writtenBlobs) {
      const hash = gitBlobHash(fileId.toString())
      const s = await backupPersistor.getObjectStream(
        projectBlobsBucket,
        makeProjectKey(historyId, hash),
        { autoGunzip: true }
      )
      const buf = new WritableBuffer()
      await Stream.promises.pipeline(s, buf)
      expect(gitBlobHashBuffer(buf.getContents())).to.equal(hash)
      const id = buf.getContents().toString('utf-8')
      expect(id).to.equal(fileId.toString())
      // double check we are not comparing 'undefined' or '[object Object]' above
      expect(id).to.match(/^[a-f0-9]{24}$/)
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
      const hash = gitBlobHash(fileId.toString())
      const blob = await blobStore.getBlob(hash)
      expect(blob).to.exist
      expect(blob.getByteLength()).to.equal(24)
      const id = await blobStore.getString(hash)
      expect(id).to.equal(fileId.toString())
      // double check we are not comparing 'undefined' or '[object Object]' above
      expect(id).to.match(/^[a-f0-9]{24}$/)
    }
  })
})
