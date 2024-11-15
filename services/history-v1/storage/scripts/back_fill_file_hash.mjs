// @ts-check
import Crypto from 'node:crypto'
import Events from 'node:events'
import fs from 'node:fs'
import Path from 'node:path'
import Stream from 'node:stream'
import zLib from 'node:zlib'
import { setTimeout } from 'node:timers/promises'
import { Binary, ObjectId } from 'mongodb'
import logger from '@overleaf/logger'
import {
  batchedUpdate,
  READ_PREFERENCE_SECONDARY,
} from '@overleaf/mongo-utils/batchedUpdate.js'
import OError from '@overleaf/o-error'
import {
  AlreadyWrittenError,
  NoKEKMatchedError,
  NotFoundError,
} from '@overleaf/object-persistor/src/Errors.js'
import { promiseMapWithLimit } from '@overleaf/promise-utils'
import { backupPersistor, projectBlobsBucket } from '../lib/backupPersistor.mjs'
import {
  BlobStore,
  GLOBAL_BLOBS,
  loadGlobalBlobs,
  makeProjectKey,
} from '../lib/blob_store/index.js'
import { backedUpBlobs, db } from '../lib/mongodb.js'
import filestorePersistor from '../lib/persistor.js'

// Silence warning.
Events.setMaxListeners(20)

// Enable caching for ObjectId.toString()
ObjectId.cacheHexString = true

/**
 * @typedef {import("overleaf-editor-core").Blob} Blob
 * @typedef {import("mongodb").Collection} Collection
 * @typedef {import("@overleaf/object-persistor/src/PerProjectEncryptedS3Persistor").CachedPerProjectEncryptedS3Persistor} CachedPerProjectEncryptedS3Persistor
 */

/**
 * @typedef {Object} FileRef
 * @property {ObjectId} _id
 * @property {string} hash
 */

/**
 * @typedef {Object} Folder
 * @property {Array<Folder>} folders
 * @property {Array<FileRef>} fileRefs
 */

/**
 * @typedef {Object} DeletedFileRef
 * @property {ObjectId} _id
 * @property {ObjectId} projectId
 * @property {string} hash
 */

/**
 * @typedef {Object} Project
 * @property {ObjectId} _id
 * @property {Array<Folder>} rootFolder
 * @property {Array<string>} deletedFileIds
 * @property {{history: {id: string}}} overleaf
 */

/**
 * @typedef {Object} QueueEntry
 * @property {ProjectContext} ctx
 * @property {string} fileId
 * @property {string} path
 * @property {string} [hash]
 */

// Time of closing the ticket for adding hashes: https://github.com/overleaf/internal/issues/464#issuecomment-492668129
const ALL_PROJECTS_HAVE_FILE_HASHES_AFTER = new Date('2019-05-15T14:02:00Z')
const PUBLIC_LAUNCH_DATE = new Date('2012-01-01T00:00:00Z')
const BATCH_RANGE_START =
  process.env.BATCH_RANGE_START ||
  ObjectId.createFromTime(PUBLIC_LAUNCH_DATE.getTime() / 1000).toString()
const BATCH_RANGE_END =
  process.env.BATCH_RANGE_END ||
  ObjectId.createFromTime(
    ALL_PROJECTS_HAVE_FILE_HASHES_AFTER.getTime() / 1000
  ).toString()
// We need to control the start and end as ids of deleted projects are created at time of deletion.
delete process.env.BATCH_RANGE_START
delete process.env.BATCH_RANGE_END

// Concurrency for downloading from GCS and updating hashes in mongo
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '100', 10)
// Retries for processing a given file
const RETRIES = parseInt(process.env.RETRIES || '10', 10)
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS || '100', 10)

const USER_FILES_BUCKET_NAME = process.env.USER_FILES_BUCKET_NAME || ''
if (!USER_FILES_BUCKET_NAME) {
  throw new Error('env var USER_FILES_BUCKET_NAME is missing')
}
const RETRY_FILESTORE_404 = process.env.RETRY_FILESTORE_404 === 'true'
const BUFFER_DIR = fs.mkdtempSync(
  process.env.BUFFER_DIR_PREFIX || '/tmp/back_fill_file_hash-'
)

const projectsCollection = db.collection('projects')
const deletedProjectsCollection = db.collection('deletedProjects')
const deletedFilesCollection = db.collection('deletedFiles')

const STATS = {
  projects: 0,
  filesWithoutHash: 0,
  filesDuplicated: 0,
  filesRetries: 0,
  filesFailed: 0,
  fileTreeUpdated: 0,
  globalBlobsCount: 0,
  globalBlobsEgress: 0,
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

function printStats() {
  console.log(
    JSON.stringify({
      time: new Date(),
      ...STATS,
    })
  )
}

setInterval(printStats, 60_000)

/**
 * @param {QueueEntry} entry
 * @return {Promise<string>}
 */
async function processFile(entry) {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      return await processFileOnce(entry)
    } catch (err) {
      if (err instanceof NotFoundError) {
        const { bucketName } = OError.getFullInfo(err)
        if (bucketName === USER_FILES_BUCKET_NAME && !RETRY_FILESTORE_404) {
          throw err // disable retries for not found in filestore bucket case
        }
      }
      if (err instanceof NoKEKMatchedError) {
        throw err // disable retries when upload to S3 will fail again
      }
      STATS.filesRetries++
      const {
        ctx: { projectId },
        fileId,
        path,
      } = entry
      logger.warn(
        { err, projectId, fileId, path, attempt },
        'failed to process file, trying again'
      )
      await setTimeout(RETRY_DELAY_MS)
    }
  }
  return await processFileOnce(entry)
}

/**
 * @param {QueueEntry} entry
 * @return {Promise<string>}
 */
async function processFileOnce(entry) {
  const { fileId } = entry
  const { projectId, historyId } = entry.ctx
  const filePath = Path.join(
    BUFFER_DIR,
    projectId.toString() + fileId.toString()
  )
  const dst = fs.createWriteStream(filePath)
  const src = await filestorePersistor.getObjectStream(
    USER_FILES_BUCKET_NAME,
    `${projectId}/${fileId}`
  )
  await Stream.promises.pipeline(src, dst)

  const blobStore = new BlobStore(historyId)
  const blob = await blobStore.putFile(filePath)
  const hash = blob.getHash()

  if (GLOBAL_BLOBS.has(hash)) {
    STATS.globalBlobsCount++
    STATS.globalBlobsEgress += estimateBlobSize(blob)
    return hash
  }

  if (entry.ctx.hasBackedUpBlob(hash)) {
    STATS.deduplicatedWriteToAWSLocalCount++
    STATS.deduplicatedWriteToAWSLocalEgress += estimateBlobSize(blob)
    return hash
  }
  entry.ctx.recordPendingBlob(hash)

  let backupSource
  let contentEncoding
  const md5 = Crypto.createHash('md5')
  let size
  if (blob.getStringLength()) {
    const filePathCompressed = filePath + '.gz'
    backupSource = filePathCompressed
    contentEncoding = 'gzip'
    size = 0
    await Stream.promises.pipeline(
      fs.createReadStream(filePath),
      zLib.createGzip(),
      async function* (source) {
        for await (const chunk of source) {
          size += chunk.byteLength
          md5.update(chunk)
          yield chunk
        }
      },
      fs.createWriteStream(filePathCompressed)
    )
  } else {
    backupSource = filePath
    size = blob.getByteLength()
    await Stream.promises.pipeline(fs.createReadStream(filePath), md5)
  }
  const backendKeyPath = makeProjectKey(historyId, blob.getHash())
  const persistor = await entry.ctx.getCachedPersistor(backendKeyPath)
  try {
    STATS.writeToAWSCount++
    await persistor.sendStream(
      projectBlobsBucket,
      backendKeyPath,
      fs.createReadStream(backupSource),
      {
        contentEncoding,
        contentType: 'application/octet-stream',
        contentLength: size,
        sourceMd5: md5.digest('hex'),
        ifNoneMatch: '*', // de-duplicate write (we pay for the request, but avoid egress)
      }
    )
    STATS.writeToAWSEgress += size
  } catch (err) {
    if (err instanceof AlreadyWrittenError) {
      STATS.deduplicatedWriteToAWSRemoteCount++
      STATS.deduplicatedWriteToAWSRemoteEgress += size
    } else {
      STATS.writeToAWSEgress += size
      entry.ctx.recordFailedBlob(hash)
      throw err
    }
  }
  entry.ctx.recordBackedUpBlob(hash)
  return hash
}

/**
 * @param {Array<QueueEntry>} files
 * @return {Promise<void>}
 */
async function processFiles(files) {
  if (files.length === 0) return // all processed
  await fs.promises.mkdir(BUFFER_DIR, { recursive: true })
  try {
    await promiseMapWithLimit(
      CONCURRENCY,
      files,
      /**
       * @param {QueueEntry} entry
       * @return {Promise<void>}
       */
      async function (entry) {
        try {
          await entry.ctx.processFile(entry)
        } catch (err) {
          STATS.filesFailed++
          const {
            ctx: { projectId },
            fileId,
            path,
          } = entry
          logger.error(
            { err, projectId, fileId, path },
            'failed to process file'
          )
        }
      }
    )
  } finally {
    await fs.promises.rm(BUFFER_DIR, { recursive: true, force: true })
  }
}

/**
 * @param {Array<Project>} batch
 * @param {string} prefix
 * @return {Promise<void>}
 */
async function handleLiveTreeBatch(batch, prefix = 'rootFolder.0') {
  if (process.argv.includes('deletedFiles')) {
    await collectDeletedFiles(batch)
  }
  const files = Array.from(findFileInBatch(batch, prefix))
  STATS.projects += batch.length
  STATS.filesWithoutHash += files.length
  batch.length = 0 // GC
  // The files are currently ordered by project-id.
  // Order them by file-id to
  // - avoid head-of-line blocking from many project-files waiting on the generation of the projects DEK (round trip to AWS)
  // - bonus: increase chance of de-duplicating write to AWS
  files.sort((a, b) => (a.fileId > b.fileId ? 1 : -1))
  await processFiles(files)
  await promiseMapWithLimit(
    CONCURRENCY,
    files,
    /**
     * @param {QueueEntry} entry
     * @return {Promise<void>}
     */
    async function (entry) {
      await entry.ctx.flushMongoQueues()
    }
  )
}

/**
 * @param {Array<{project: Project}>} batch
 * @return {Promise<void>}
 */
async function handleDeletedFileTreeBatch(batch) {
  await handleLiveTreeBatch(
    batch.map(d => d.project),
    'project.rootFolder.0'
  )
}

/**
 * @param {QueueEntry} entry
 * @return {Promise<boolean>}
 */
async function tryUpdateFileRefInMongo(entry) {
  if (entry.path === '') {
    return await tryUpdateDeletedFileRefInMongo(entry)
  } else if (entry.path.startsWith('project.')) {
    return await tryUpdateFileRefInMongoInDeletedProject(entry)
  }

  STATS.mongoUpdates++
  const result = await projectsCollection.updateOne(
    {
      _id: entry.ctx.projectId,
      [`${entry.path}._id`]: new ObjectId(entry.fileId),
    },
    {
      $set: { [`${entry.path}.hash`]: entry.hash },
    }
  )
  return result.matchedCount === 1
}

/**
 * @param {QueueEntry} entry
 * @return {Promise<boolean>}
 */
async function tryUpdateDeletedFileRefInMongo(entry) {
  STATS.mongoUpdates++
  const result = await deletedFilesCollection.updateOne(
    {
      _id: new ObjectId(entry.fileId),
      projectId: entry.ctx.projectId,
    },
    { $set: { hash: entry.hash } }
  )
  return result.matchedCount === 1
}

/**
 * @param {QueueEntry} entry
 * @return {Promise<boolean>}
 */
async function tryUpdateFileRefInMongoInDeletedProject(entry) {
  STATS.mongoUpdates++
  const result = await deletedProjectsCollection.updateOne(
    {
      'deleterData.deletedProjectId': entry.ctx.projectId,
      [`${entry.path}._id`]: new ObjectId(entry.fileId),
    },
    {
      $set: { [`${entry.path}.hash`]: entry.hash },
    }
  )
  return result.matchedCount === 1
}

const RETRY_UPDATE_HASH = 100

/**
 * @param {QueueEntry} entry
 * @return {Promise<void>}
 */
async function updateFileRefInMongo(entry) {
  if (await tryUpdateFileRefInMongo(entry)) return

  const { fileId } = entry
  const { projectId } = entry.ctx
  for (let i = 0; i < RETRY_UPDATE_HASH; i++) {
    let prefix = 'rootFolder.0'
    let p = await projectsCollection.findOne(
      { _id: projectId },
      { projection: { rootFolder: 1 } }
    )
    if (!p) {
      STATS.projectDeleted++
      prefix = 'project.rootFolder.0'
      const deletedProject = await deletedProjectsCollection.findOne(
        {
          'deleterData.deletedProjectId': projectId,
          project: { $exists: true },
        },
        { projection: { 'project.rootFolder': 1 } }
      )
      p = deletedProject?.project
      if (!p) {
        STATS.projectHardDeleted++
        console.warn(
          'bug: project hard-deleted while processing',
          projectId,
          fileId
        )
        return
      }
    }
    let found = false
    for (const e of findFiles(entry.ctx, p.rootFolder[0], prefix)) {
      found = e.fileId === fileId
      if (!found) continue
      if (await tryUpdateFileRefInMongo(e)) return
      break
    }
    if (!found) {
      if (await tryUpdateDeletedFileRefInMongo(entry)) return
      STATS.fileHardDeleted++
      console.warn('bug: file hard-deleted while processing', projectId, fileId)
      return
    }

    STATS.fileTreeUpdated++
  }
  throw new OError(
    'file-tree updated repeatedly while trying to add hash',
    entry
  )
}

/**
 * @param {ProjectContext} ctx
 * @param {Folder} folder
 * @param {string} path
 * @return Generator<QueueEntry>
 */
function* findFiles(ctx, folder, path) {
  let i = 0
  for (const child of folder.folders) {
    yield* findFiles(ctx, child, `${path}.folders.${i}`)
    i++
  }
  i = 0
  for (const fileRef of folder.fileRefs) {
    if (!fileRef.hash) {
      yield {
        ctx,
        fileId: fileRef._id.toString(),
        path: `${path}.fileRefs.${i}`,
      }
    }
    i++
  }
}

/**
 * @param {Array<Project>} projects
 * @param {string} prefix
 */
function* findFileInBatch(projects, prefix) {
  for (const project of projects) {
    const ctx = new ProjectContext(project)
    yield* findFiles(ctx, project.rootFolder[0], prefix)
    for (const fileId of project.deletedFileIds || []) {
      yield { ctx, fileId, path: '' }
    }
  }
}

/**
 * @param {Array<Project>} projects
 * @return {Promise<void>}
 */
async function collectDeletedFiles(projects) {
  const cursor = deletedFilesCollection.find(
    {
      projectId: { $in: projects.map(p => p._id) },
      hash: { $exists: false },
    },
    {
      projection: { _id: 1, projectId: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
      sort: { projectId: 1 },
    }
  )
  const processed = projects.slice()
  for await (const deletedFileRef of cursor) {
    const idx = processed.findIndex(
      p => p._id.toString() === deletedFileRef.projectId.toString()
    )
    if (idx === -1) {
      throw new Error(
        `bug: order of deletedFiles mongo records does not match batch of projects (${deletedFileRef.projectId} out of order)`
      )
    }
    processed.splice(0, idx)
    const project = processed[0]
    project.deletedFileIds = project.deletedFileIds || []
    project.deletedFileIds.push(deletedFileRef._id.toString())
  }
}

const BATCH_HASH_WRITES = 1_000
const BATCH_FILE_UPDATES = 100

class ProjectContext {
  /** @type {Promise<CachedPerProjectEncryptedS3Persistor> | null} */
  #cachedPersistorPromise = null

  /**
   * @param {Project} project
   */
  constructor(project) {
    this.projectId = project._id
    this.historyId = project.overleaf.history.id.toString()
  }

  /**
   * @param {string} key
   * @return {Promise<CachedPerProjectEncryptedS3Persistor>}
   */
  getCachedPersistor(key) {
    if (!this.#cachedPersistorPromise) {
      // Fetch DEK once, but only if needed -- upon the first use
      this.#cachedPersistorPromise = this.#getCachedPersistorWithRetries(key)
    }
    return this.#cachedPersistorPromise
  }

  /**
   * @param {string} key
   * @return {Promise<CachedPerProjectEncryptedS3Persistor>}
   */
  async #getCachedPersistorWithRetries(key) {
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      try {
        return await backupPersistor.forProject(projectBlobsBucket, key)
      } catch (err) {
        if (err instanceof NoKEKMatchedError) {
          throw err
        } else {
          logger.warn(
            { err, projectId: this.projectId, attempt },
            'failed to get DEK, trying again'
          )
          await setTimeout(RETRY_DELAY_MS)
        }
      }
    }
    return await backupPersistor.forProject(projectBlobsBucket, key)
  }

  async flushMongoQueuesIfNeeded() {
    if (this.#completedBlobs.size > BATCH_HASH_WRITES) {
      await this.#storeBackedUpBlobs()
    }
    if (this.#pendingFileWrites.length > BATCH_FILE_UPDATES) {
      await this.#storeFileHashes()
    }
  }

  async flushMongoQueues() {
    await this.#storeBackedUpBlobs()
    await this.#storeFileHashes()
  }

  /** @type {Set<string>} */
  #pendingBlobs = new Set()
  /** @type {Set<string>} */
  #completedBlobs = new Set()

  async #storeBackedUpBlobs() {
    if (this.#completedBlobs.size === 0) return
    const blobs = Array.from(this.#completedBlobs).map(
      hash => new Binary(Buffer.from(hash, 'hex'))
    )
    this.#completedBlobs.clear()
    STATS.mongoUpdates++
    await backedUpBlobs.updateOne(
      { _id: this.projectId },
      { $addToSet: { blobs: { $each: blobs } } },
      { upsert: true }
    )
  }

  /**
   * @param {string} hash
   */
  recordPendingBlob(hash) {
    this.#pendingBlobs.add(hash)
  }

  /**
   * @param {string} hash
   */
  recordFailedBlob(hash) {
    this.#pendingBlobs.delete(hash)
  }

  /**
   * @param {string} hash
   */
  recordBackedUpBlob(hash) {
    this.#completedBlobs.add(hash)
    this.#pendingBlobs.delete(hash)
  }

  /**
   * @param {string} hash
   * @return {boolean}
   */
  hasBackedUpBlob(hash) {
    return this.#pendingBlobs.has(hash) || this.#completedBlobs.has(hash)
  }

  /** @type {Array<QueueEntry>} */
  #pendingFileWrites = []

  /**
   * @param {QueueEntry} entry
   */
  queueFileForWritingHash(entry) {
    this.#pendingFileWrites.push(entry)
  }

  /**
   * @param {Collection} collection
   * @param {Array<QueueEntry>} entries
   * @param {Object} query
   * @return {Promise<Array<QueueEntry>>}
   */
  async #tryBatchHashWrites(collection, entries, query) {
    if (entries.length === 0) return []
    const update = {}
    for (const entry of entries) {
      query[`${entry.path}._id`] = new ObjectId(entry.fileId)
      update[`${entry.path}.hash`] = entry.hash
    }
    STATS.mongoUpdates++
    const result = await collection.updateOne(query, { $set: update })
    if (result.matchedCount === 1) {
      return [] // all updated
    }
    return entries
  }

  async #storeFileHashes() {
    if (this.#pendingFileWrites.length === 0) return
    const individualUpdates = []
    const projectEntries = []
    const deletedProjectEntries = []
    for (const entry of this.#pendingFileWrites) {
      if (entry.path === '') {
        individualUpdates.push(entry)
      } else if (entry.path.startsWith('project.')) {
        deletedProjectEntries.push(entry)
      } else {
        projectEntries.push(entry)
      }
    }
    this.#pendingFileWrites.length = 0

    // Try to process them together, otherwise fallback to individual updates and retries.
    individualUpdates.push(
      ...(await this.#tryBatchHashWrites(projectsCollection, projectEntries, {
        _id: this.projectId,
      }))
    )
    individualUpdates.push(
      ...(await this.#tryBatchHashWrites(
        deletedProjectsCollection,
        deletedProjectEntries,
        { 'deleterData.deletedProjectId': this.projectId }
      ))
    )
    for (const entry of individualUpdates) {
      await updateFileRefInMongo(entry)
    }
  }

  /** @type {Map<string, Promise<string>>} */
  #pendingFiles = new Map()

  /**
   * @param {QueueEntry} entry
   */
  async processFile(entry) {
    if (this.#pendingFiles.has(entry.fileId)) {
      STATS.filesDuplicated++
    } else {
      this.#pendingFiles.set(entry.fileId, processFile(entry))
    }
    entry.hash = await this.#pendingFiles.get(entry.fileId)
    this.queueFileForWritingHash(entry)
    await this.flushMongoQueuesIfNeeded()
  }
}

/**
 * @param {Blob} blob
 * @return {number}
 */
function estimateBlobSize(blob) {
  let size = blob.getByteLength()
  if (blob.getStringLength()) {
    // approximation for gzip (25 bytes gzip overhead and 20% compression ratio)
    size = 25 + Math.ceil(size * 0.2)
  }
  return size
}

async function updateLiveFileTrees() {
  await batchedUpdate(
    projectsCollection,
    { 'overleaf.history.id': { $exists: true } },
    handleLiveTreeBatch,
    { rootFolder: 1, _id: 1, 'overleaf.history.id': 1 },
    {},
    {
      BATCH_RANGE_START,
      BATCH_RANGE_END,
    }
  )
  console.warn('Done updating live projects')
}

async function updateDeletedFileTrees() {
  await batchedUpdate(
    deletedProjectsCollection,
    {
      'deleterData.deletedProjectId': {
        $gt: new ObjectId(BATCH_RANGE_START),
        $lte: new ObjectId(BATCH_RANGE_END),
      },
      'project.overleaf.history.id': { $exists: true },
    },
    handleDeletedFileTreeBatch,
    {
      'project.rootFolder': 1,
      'project._id': 1,
      'project.overleaf.history.id': 1,
    }
  )
  console.warn('Done updating deleted projects')
}

async function main() {
  await loadGlobalBlobs()
  if (process.argv.includes('live')) {
    await updateLiveFileTrees()
  }
  if (process.argv.includes('deleted')) {
    await updateDeletedFileTrees()
  }
  console.warn('Done.')
}

try {
  try {
    await main()
  } finally {
    printStats()
  }

  let code = 0
  if (STATS.filesFailed > 0) {
    console.warn('Some files could not be processed, see logs and try again')
    code++
  }
  if (STATS.fileHardDeleted > 0) {
    console.warn(
      'Some hashes could not be updated as the files were hard-deleted, this should not happen'
    )
    code++
  }
  if (STATS.projectHardDeleted > 0) {
    console.warn(
      'Some hashes could not be updated as the project was hard-deleted, this should not happen'
    )
    code++
  }
  process.exit(code)
} catch (err) {
  console.error(err)
  process.exit(1)
}
