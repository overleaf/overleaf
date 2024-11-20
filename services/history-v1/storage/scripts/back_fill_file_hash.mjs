// @ts-check
import Crypto from 'node:crypto'
import Events from 'node:events'
import fs from 'node:fs'
import Path from 'node:path'
import { performance } from 'node:perf_hooks'
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
  getProjectBlobsBatch,
  getStringLengthOfFile,
  makeBlobForFile,
  makeProjectKey,
} from '../lib/blob_store/index.js'
import { backedUpBlobs as backedUpBlobsCollection, db } from '../lib/mongodb.js'
import filestorePersistor from '../lib/persistor.js'

// Silence warning.
Events.setMaxListeners(20)

// Enable caching for ObjectId.toString()
ObjectId.cacheHexString = true

/**
 * @typedef {import("overleaf-editor-core").Blob} Blob
 * @typedef {import("perf_hooks").EventLoopUtilization} EventLoopUtilization
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
 * @property {{history: {id: (number|string)}}} overleaf
 */

/**
 * @typedef {Object} QueueEntry
 * @property {ProjectContext} ctx
 * @property {string} cacheKey
 * @property {string} [fileId]
 * @property {string} path
 * @property {string} [hash]
 * @property {Blob} [blob]
 */

const COLLECT_BLOBS = process.argv.includes('blobs')

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
// https://nodejs.org/api/stream.html#streamgetdefaulthighwatermarkobjectmode
const STREAM_HIGH_WATER_MARK = parseInt(
  process.env.STREAM_HIGH_WATER_MARK || (64 * 1024).toString(),
  10
)
const LOGGING_INTERVAL = parseInt(process.env.LOGGING_INTERVAL || '60000', 10)

const projectsCollection = db.collection('projects')
const deletedProjectsCollection = db.collection('deletedProjects')
const deletedFilesCollection = db.collection('deletedFiles')

const STATS = {
  projects: 0,
  blobs: 0,
  backedUpBlobs: 0,
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
  readFromGCSCount: 0,
  readFromGCSIngress: 0,
  writeToAWSCount: 0,
  writeToAWSEgress: 0,
  writeToGCSCount: 0,
  writeToGCSEgress: 0,
}

const processStart = performance.now()
let lastLogTS = processStart
let lastLog = Object.assign({}, STATS)
let lastEventLoopStats = performance.eventLoopUtilization()

/**
 * @param {number} v
 * @param {number} ms
 */
function toMiBPerSecond(v, ms) {
  const ONE_MiB = 1024 * 1024
  return v / ONE_MiB / (ms / 1000)
}

/**
 * @param {any} stats
 * @param {number} ms
 * @return {{writeToAWSThroughputMiBPerSecond: number, readFromGCSThroughputMiBPerSecond: number}}
 */
function bandwidthStats(stats, ms) {
  return {
    readFromGCSThroughputMiBPerSecond: toMiBPerSecond(
      stats.readFromGCSIngress,
      ms
    ),
    writeToAWSThroughputMiBPerSecond: toMiBPerSecond(
      stats.writeToAWSEgress,
      ms
    ),
  }
}

/**
 * @param {EventLoopUtilization} nextEventLoopStats
 * @param {number} now
 * @return {Object}
 */
function computeDiff(nextEventLoopStats, now) {
  const ms = now - lastLogTS
  lastLogTS = now
  const diff = {
    eventLoop: performance.eventLoopUtilization(
      nextEventLoopStats,
      lastEventLoopStats
    ),
  }
  for (const [name, v] of Object.entries(STATS)) {
    diff[name] = v - lastLog[name]
  }
  return Object.assign(diff, bandwidthStats(diff, ms))
}

function printStats() {
  const now = performance.now()
  const nextEventLoopStats = performance.eventLoopUtilization()
  console.log(
    JSON.stringify({
      time: new Date(),
      ...STATS,
      ...bandwidthStats(STATS, now - processStart),
      eventLoop: nextEventLoopStats,
      diff: computeDiff(nextEventLoopStats, now),
    })
  )
  lastEventLoopStats = nextEventLoopStats
  lastLog = Object.assign({}, STATS)
}

setInterval(printStats, LOGGING_INTERVAL)

let gracefulShutdownInitiated = false

process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

function handleSignal() {
  gracefulShutdownInitiated = true
  console.warn('graceful shutdown initiated, draining queue')
}

/**
 * @param {QueueEntry} entry
 * @return {Promise<string>}
 */
async function processFileWithCleanup(entry) {
  const {
    ctx: { projectId },
    cacheKey,
  } = entry
  const filePath = Path.join(BUFFER_DIR, projectId.toString() + cacheKey)
  try {
    return await processFile(entry, filePath)
  } finally {
    await Promise.all([
      fs.promises.rm(filePath, { force: true }),
      fs.promises.rm(filePath + GZ_SUFFIX, { force: true }),
    ])
  }
}

/**
 * @param {QueueEntry} entry
 * @param {string} filePath
 * @return {Promise<string>}
 */
async function processFile(entry, filePath) {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      return await processFileOnce(entry, filePath)
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
        hash,
        path,
      } = entry
      logger.warn(
        { err, projectId, fileId, hash, path, attempt },
        'failed to process file, trying again'
      )
      await setTimeout(RETRY_DELAY_MS)
    }
  }
  return await processFileOnce(entry, filePath)
}

/**
 * @param {QueueEntry} entry
 * @param {string} filePath
 * @return {Promise<string>}
 */
async function processFileOnce(entry, filePath) {
  const {
    ctx: { projectId, historyId },
    fileId,
  } = entry
  const blobStore = new BlobStore(historyId)
  if (entry.blob) {
    const { blob } = entry
    const hash = blob.getHash()
    if (entry.ctx.hasBackedUpBlob(hash)) {
      STATS.deduplicatedWriteToAWSLocalCount++
      STATS.deduplicatedWriteToAWSLocalEgress += estimateBlobSize(blob)
      return hash
    }
    entry.ctx.recordPendingBlob(hash)
    STATS.readFromGCSCount++
    const src = await blobStore.getStream(hash)
    const dst = fs.createWriteStream(filePath, {
      highWaterMark: STREAM_HIGH_WATER_MARK,
    })
    try {
      await Stream.promises.pipeline(src, dst)
    } finally {
      STATS.readFromGCSIngress += dst.bytesWritten
    }
    await uploadBlobToAWS(entry, blob, filePath)
    return hash
  }

  STATS.readFromGCSCount++
  const src = await filestorePersistor.getObjectStream(
    USER_FILES_BUCKET_NAME,
    `${projectId}/${fileId}`
  )
  const dst = fs.createWriteStream(filePath, {
    highWaterMark: STREAM_HIGH_WATER_MARK,
  })
  try {
    await Stream.promises.pipeline(src, dst)
  } finally {
    STATS.readFromGCSIngress += dst.bytesWritten
  }
  const blob = await makeBlobForFile(filePath)
  blob.setStringLength(
    await getStringLengthOfFile(blob.getByteLength(), filePath)
  )
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

  try {
    await uploadBlobToGCS(blobStore, entry, blob, hash, filePath)
    await uploadBlobToAWS(entry, blob, filePath)
  } catch (err) {
    entry.ctx.recordFailedBlob(hash)
    throw err
  }
  return hash
}

/**
 * @param {BlobStore} blobStore
 * @param {QueueEntry} entry
 * @param {Blob} blob
 * @param {string} hash
 * @param {string} filePath
 * @return {Promise<void>}
 */
async function uploadBlobToGCS(blobStore, entry, blob, hash, filePath) {
  if (entry.ctx.hasHistoryBlob(hash)) {
    return // fast-path using hint from pre-fetched blobs
  }
  if (!COLLECT_BLOBS && (await blobStore.getBlob(hash))) {
    entry.ctx.recordHistoryBlob(hash)
    return // round trip to postgres/mongo when not pre-fetched
  }
  // blob missing in history-v1, create in GCS and persist in postgres/mongo
  STATS.writeToGCSCount++
  STATS.writeToGCSEgress += blob.getByteLength()
  await blobStore.putBlob(filePath, blob)
  entry.ctx.recordHistoryBlob(hash)
}

const GZ_SUFFIX = '.gz'

/**
 * @param {QueueEntry} entry
 * @param {Blob} blob
 * @param {string} filePath
 * @return {Promise<void>}
 */
async function uploadBlobToAWS(entry, blob, filePath) {
  const { historyId } = entry.ctx
  let backupSource
  let contentEncoding
  const md5 = Crypto.createHash('md5')
  let size
  if (blob.getStringLength()) {
    const filePathCompressed = filePath + GZ_SUFFIX
    backupSource = filePathCompressed
    contentEncoding = 'gzip'
    size = 0
    await Stream.promises.pipeline(
      fs.createReadStream(filePath, { highWaterMark: STREAM_HIGH_WATER_MARK }),
      zLib.createGzip(),
      async function* (source) {
        for await (const chunk of source) {
          size += chunk.byteLength
          md5.update(chunk)
          yield chunk
        }
      },
      fs.createWriteStream(filePathCompressed, {
        highWaterMark: STREAM_HIGH_WATER_MARK,
      })
    )
  } else {
    backupSource = filePath
    size = blob.getByteLength()
    await Stream.promises.pipeline(
      fs.createReadStream(filePath, { highWaterMark: STREAM_HIGH_WATER_MARK }),
      md5
    )
  }
  const backendKeyPath = makeProjectKey(historyId, blob.getHash())
  const persistor = await entry.ctx.getCachedPersistor(backendKeyPath)
  try {
    STATS.writeToAWSCount++
    await persistor.sendStream(
      projectBlobsBucket,
      backendKeyPath,
      fs.createReadStream(backupSource, {
        highWaterMark: STREAM_HIGH_WATER_MARK,
      }),
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
      throw err
    }
  }
  entry.ctx.recordBackedUpBlob(blob.getHash())
}

/**
 * @param {Array<QueueEntry>} files
 * @return {Promise<void>}
 */
async function processFiles(files) {
  if (files.length === 0) return // all processed
  await promiseMapWithLimit(
    CONCURRENCY,
    files,
    /**
     * @param {QueueEntry} entry
     * @return {Promise<void>}
     */
    async function (entry) {
      if (gracefulShutdownInitiated) return
      try {
        await entry.ctx.processFile(entry)
      } catch (err) {
        STATS.filesFailed++
        const {
          ctx: { projectId },
          fileId,
          hash,
          path,
        } = entry
        logger.error(
          { err, projectId, fileId, hash, path },
          'failed to process file'
        )
      }
    }
  )
}

/**
 * @param {Array<Project>} batch
 * @param {string} prefix
 * @return {Promise<void>}
 */
async function handleLiveTreeBatch(batch, prefix = 'rootFolder.0') {
  const deletedFiles = await collectDeletedFiles(batch)
  const { nBlobs, blobs } = await collectProjectBlobs(batch)
  const { nBackedUpBlobs, backedUpBlobs } = await collectBackedUpBlobs(batch)
  const files = Array.from(
    findFileInBatch(batch, prefix, deletedFiles, blobs, backedUpBlobs)
  )
  STATS.projects += batch.length
  STATS.blobs += nBlobs
  STATS.backedUpBlobs += nBackedUpBlobs
  STATS.filesWithoutHash += files.length - (nBlobs - nBackedUpBlobs)
  batch.length = 0 // GC
  // The files are currently ordered by project-id.
  // Order them by file-id ASC then blobs ASC to
  // - process files before blobs
  // - avoid head-of-line blocking from many project-files waiting on the generation of the projects DEK (round trip to AWS)
  // - bonus: increase chance of de-duplicating write to AWS
  files.sort(
    /**
     * @param {QueueEntry} a
     * @param {QueueEntry} b
     * @return {number}
     */
    function (a, b) {
      if (a.fileId && b.fileId) return a.fileId > b.fileId ? 1 : -1
      if (a.hash && b.hash) return a.hash > b.hash ? 1 : -1
      if (a.fileId) return -1
      return 1
    }
  )
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
  if (gracefulShutdownInitiated) {
    throw new Error('graceful shutdown: aborting batch processing')
  }
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
        cacheKey: fileRef._id.toString(),
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
 * @param {Map<string,Array<string>>} deletedFiles
 * @param {Map<string,Array<Blob>>} blobs
 * @param {Map<string,Array<string>>} backedUpBlobs
 * @return Generator<QueueEntry>
 */
function* findFileInBatch(
  projects,
  prefix,
  deletedFiles,
  blobs,
  backedUpBlobs
) {
  for (const project of projects) {
    const projectIdS = project._id.toString()
    const historyIdS = project.overleaf.history.id.toString()
    const projectBlobs = blobs.get(historyIdS) || []
    const projectBackedUpBlobs = new Set(backedUpBlobs.get(projectIdS) || [])
    const projectDeletedFiles = deletedFiles.get(projectIdS) || []
    const ctx = new ProjectContext(
      project._id,
      historyIdS,
      projectBlobs,
      projectBackedUpBlobs
    )
    yield* findFiles(ctx, project.rootFolder[0], prefix)
    for (const fileId of projectDeletedFiles) {
      yield { ctx, cacheKey: fileId, fileId, path: '' }
    }
    for (const blob of projectBlobs) {
      if (projectBackedUpBlobs.has(blob.getHash())) continue
      yield {
        ctx,
        cacheKey: blob.getHash(),
        path: 'blob',
        blob,
        hash: blob.getHash(),
      }
    }
  }
}

/**
 * @param {Array<Project>} batch
 * @return {Promise<{nBlobs: number, blobs: Map<string, Array<Blob>>}>}
 */
async function collectProjectBlobs(batch) {
  if (!COLLECT_BLOBS) return { nBlobs: 0, blobs: new Map() }
  return await getProjectBlobsBatch(batch.map(p => p.overleaf.history.id))
}

/**
 * @param {Array<Project>} projects
 * @return {Promise<Map<string, Array<string>>>}
 */
async function collectDeletedFiles(projects) {
  const deletedFiles = new Map()
  if (!process.argv.includes('deletedFiles')) return deletedFiles

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
  for await (const deletedFileRef of cursor) {
    const projectId = deletedFileRef.projectId.toString()
    const fileId = deletedFileRef._id.toString()
    const found = deletedFiles.get(projectId)
    if (found) {
      found.push(fileId)
    } else {
      deletedFiles.set(projectId, [fileId])
    }
  }
  return deletedFiles
}

/**
 * @param {Array<Project>} projects
 * @return {Promise<{nBackedUpBlobs:number,backedUpBlobs:Map<string,Array<string>>}>}
 */
async function collectBackedUpBlobs(projects) {
  let nBackedUpBlobs = 0
  const backedUpBlobs = new Map()
  if (!process.argv.includes('collectBackedUpBlobs')) {
    return { nBackedUpBlobs, backedUpBlobs }
  }
  const cursor = backedUpBlobsCollection.find(
    { _id: { $in: projects.map(p => p._id) } },
    {
      readPreference: READ_PREFERENCE_SECONDARY,
      sort: { _id: 1 },
    }
  )
  for await (const record of cursor) {
    const blobs = record.blobs.map(b => b.toString('hex'))
    backedUpBlobs.set(record._id.toString(), blobs)
    nBackedUpBlobs += blobs.length
  }
  return { nBackedUpBlobs, backedUpBlobs }
}

const BATCH_HASH_WRITES = 1_000
const BATCH_FILE_UPDATES = 100

class ProjectContext {
  /** @type {Promise<CachedPerProjectEncryptedS3Persistor> | null} */
  #cachedPersistorPromise = null

  /** @type {Set<string>} */
  #backedUpBlobs

  /** @type {Set<string>} */
  #historyBlobs

  /**
   * @param {ObjectId} projectId
   * @param {string} historyId
   * @param {Array<Blob>} blobs
   * @param {Set<string>} backedUpBlobs
   */
  constructor(projectId, historyId, blobs, backedUpBlobs) {
    this.projectId = projectId
    this.historyId = historyId
    this.#backedUpBlobs = backedUpBlobs
    this.#historyBlobs = new Set(blobs.map(b => b.getHash()))
  }

  hasHistoryBlob(hash) {
    return this.#historyBlobs.has(hash)
  }
  recordHistoryBlob(hash) {
    this.#historyBlobs.add(hash)
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
    await backedUpBlobsCollection.updateOne(
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
    this.#backedUpBlobs.add(hash)
    this.#completedBlobs.add(hash)
    this.#pendingBlobs.delete(hash)
  }

  /**
   * @param {string} hash
   * @return {boolean}
   */
  hasBackedUpBlob(hash) {
    return (
      this.#pendingBlobs.has(hash) ||
      this.#completedBlobs.has(hash) ||
      this.#backedUpBlobs.has(hash)
    )
  }

  /** @type {Array<QueueEntry>} */
  #pendingFileWrites = []

  /**
   * @param {QueueEntry} entry
   */
  queueFileForWritingHash(entry) {
    if (entry.path === 'blob') return
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
    if (this.#pendingFiles.has(entry.cacheKey)) {
      STATS.filesDuplicated++
    } else {
      this.#pendingFiles.set(entry.cacheKey, processFileWithCleanup(entry))
    }
    entry.hash = await this.#pendingFiles.get(entry.cacheKey)
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
