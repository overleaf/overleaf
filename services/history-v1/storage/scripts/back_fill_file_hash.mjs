// @ts-check
import Events from 'node:events'
import fs from 'node:fs'
import Path from 'node:path'
import { performance } from 'node:perf_hooks'
import Stream from 'node:stream'
import { setTimeout } from 'node:timers/promises'
import { ObjectId } from 'mongodb'
import pLimit from 'p-limit'
import logger from '@overleaf/logger'
import {
  batchedUpdate,
  objectIdFromInput,
  renderObjectId,
} from '@overleaf/mongo-utils/batchedUpdate.js'
import OError from '@overleaf/o-error'
import { NotFoundError } from '@overleaf/object-persistor/src/Errors.js'
import {
  BlobStore,
  GLOBAL_BLOBS,
  loadGlobalBlobs,
  getProjectBlobsBatch,
  getStringLengthOfFile,
  makeBlobForFile,
} from '../lib/blob_store/index.js'
import { db } from '../lib/mongodb.js'
import commandLineArgs from 'command-line-args'
import readline from 'node:readline'

// Silence warning.
Events.setMaxListeners(20)

// Enable caching for ObjectId.toString()
ObjectId.cacheHexString = true

/**
 * @typedef {import("overleaf-editor-core").Blob} Blob
 * @typedef {import("perf_hooks").EventLoopUtilization} EventLoopUtilization
 * @typedef {import("mongodb").Collection} Collection
 * @typedef {import("mongodb").Collection<Project>} ProjectsCollection
 * @typedef {import("mongodb").Collection<{project:Project}>} DeletedProjectsCollection
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

/**
 * Start and end for range.
 * @type {Date}
 */
const PUBLIC_LAUNCH_DATE = new Date('2012-01-01T00:00:00Z')
const DEFAULT_BATCH_RANGE_START_DATE = PUBLIC_LAUNCH_DATE
const DEFAULT_BATCH_RANGE_END_DATE = new Date()

function usesDefaultBatchRange() {
  return (
    BATCH_RANGE_START ===
      objectIdFromInput(
        DEFAULT_BATCH_RANGE_START_DATE.toISOString()
      ).toString() &&
    BATCH_RANGE_END ===
      objectIdFromInput(DEFAULT_BATCH_RANGE_END_DATE.toISOString()).toString()
  )
}

/**
 * @return {{PROJECT_IDS_FROM: string, PROCESS_HASHED_FILES: boolean, LOGGING_IDENTIFIER: string, BATCH_RANGE_START: string, BATCH_RANGE_END: string, PROCESS_NON_DELETED_PROJECTS: boolean, PROCESS_DELETED_PROJECTS: boolean, PROCESS_BLOBS: boolean, DRY_RUN: boolean, OUTPUT_FILE: string, DISPLAY_REPORT: boolean, CONCURRENCY: number, CONCURRENT_BATCHES: number, RETRIES: number, RETRY_DELAY_MS: number, RETRY_FILESTORE_404: boolean, BUFFER_DIR_PREFIX: string, STREAM_HIGH_WATER_MARK: number, LOGGING_INTERVAL: number, SLEEP_BEFORE_EXIT: number }}
 */
function parseArgs() {
  const DEFAULT_OUTPUT_FILE = `/var/log/overleaf/file-migration-${new Date()
    .toISOString()
    .replace(/[:.]/g, '_')}.log`

  const args = commandLineArgs([
    { name: 'help', alias: 'h', type: Boolean },
    { name: 'all', alias: 'a', type: Boolean },
    { name: 'projects', type: Boolean },
    { name: 'deleted-projects', type: Boolean },
    { name: 'skip-hashed-files', type: Boolean },
    { name: 'skip-existing-blobs', type: Boolean },
    { name: 'from-file', type: String, defaultValue: '' },
    { name: 'concurrency', type: Number, defaultValue: 10 },
    { name: 'concurrent-batches', type: Number, defaultValue: 1 },
    { name: 'stream-high-water-mark', type: Number, defaultValue: 1024 * 1024 },
    { name: 'retries', type: Number, defaultValue: 10 },
    { name: 'retry-delay-ms', type: Number, defaultValue: 100 },
    { name: 'retry-filestore-404', type: Boolean },
    { name: 'dry-run', alias: 'n', type: Boolean },
    {
      name: 'output',
      alias: 'o',
      type: String,
      defaultValue: DEFAULT_OUTPUT_FILE,
    },
    { name: 'report', type: Boolean },
    {
      name: 'BATCH_RANGE_START',
      type: String,
      defaultValue: PUBLIC_LAUNCH_DATE.toISOString(),
    },
    {
      name: 'BATCH_RANGE_END',
      type: String,
      defaultValue: new Date().toISOString(),
    },
    { name: 'logging-id', type: String, defaultValue: '' },
    { name: 'logging-interval-ms', type: Number, defaultValue: 60_000 },
    {
      name: 'buffer-dir-prefix',
      type: String,
      defaultValue: '/tmp/back_fill_file_hash-',
    },
    { name: 'sleep-before-exit-ms', type: Number, defaultValue: 1_000 },
  ])

  // If no arguments are provided, display a usage message
  if (process.argv.length <= 2) {
    console.error(
      'Usage: node back_fill_file_hash.mjs --all | --projects | --deleted-projects'
    )
    process.exit(1)
  }

  // If --help is provided, display the help message
  if (args.help) {
    console.log(`Usage: node back_fill_file_hash.mjs [options]

Project selection options:
  --all, -a                  Process all projects, including deleted ones
  --projects                 Process projects (excluding deleted ones)
  --deleted-projects         Process deleted projects
  --from-file <file>         Process selected projects ids from file

File selection options:
  --skip-hashed-files        Skip processing files that already have a hash
  --skip-existing-blobs      Skip processing files already in the blob store

Logging options:
  --output <file>, -o <file> Output log to the specified file
                             (default: file-migration-<timestamp>.log)
  --logging-id <id>          Identifier for logging
                             (default: BATCH_RANGE_START)
  --logging-interval-ms <ms> Interval for logging progres stats
                             (default: 60000, 1min)

Batch range options:
  --BATCH_RANGE_START <date> Start date for processing
                             (default: ${args.BATCH_RANGE_START})
  --BATCH_RANGE_END <date>   End date for processing
                             (default: ${args.BATCH_RANGE_END})

Concurrency:
  --concurrency <n>          Number of files to process concurrently
                             (default: 10)
  --concurrent-batches <n>   Number of project batches to process concurrently
                             (default: 1)
  --stream-high-water-mark n In-Memory buffering threshold
                             (default: 1MiB)

Retries:
  --retries <n>              Number of times to retry processing a file
                             (default: 10)
  --retry-delay-ms <ms>      How long to wait before processing a file again
                             (default: 100, 100ms)
  --retry-filestore-404      Retry downloading a file when receiving a 404
                             (default: false)

Other options:
  --report                   Display a report of the current status
  --dry-run, -n              Perform a dry run without making changes
  --help, -h                 Show this help message
  --buffer-dir-prefix <p>    Folder/prefix for buffering files on disk
                             (default: ${args['buffer-dir-prefix']})
  --sleep-before-exit-ms <n> Defer exiting from the script
                             (default: 1000, 1s)

Typical usage:

  node back_fill_file_hash.mjs --all

is equivalent to

  node back_fill_file_hash.mjs --projects --deleted-projects
`)
    process.exit(0)
  }

  // Require at least one of --projects, --deleted-projects and --all or --report
  if (
    !args.projects &&
    !args['deleted-projects'] &&
    !args.all &&
    !args.report
  ) {
    console.error(
      'Must specify at least one of --projects and --deleted-projects, --all or --report'
    )
    process.exit(1)
  }

  // Forbid --all with --projects or --deleted-projects
  if (args.all && (args.projects || args['deleted-projects'])) {
    console.error('Cannot use --all with --projects or --deleted-projects')
    process.exit(1)
  }

  // Forbid --all, --projects, --deleted-projects with --report
  if (args.report && (args.all || args.projects || args['deleted-projects'])) {
    console.error(
      'Cannot use --report with --all, --projects or --deleted-projects'
    )
    process.exit(1)
  }

  // The --all option processes all projects, including deleted ones
  // and checks existing hashed files are present in the blob store.
  if (args.all) {
    args.projects = true
    args['deleted-projects'] = true
  }

  const BATCH_RANGE_START = objectIdFromInput(args.BATCH_RANGE_START).toString()
  const BATCH_RANGE_END = objectIdFromInput(args.BATCH_RANGE_END).toString()
  return {
    PROCESS_NON_DELETED_PROJECTS: args.projects,
    PROCESS_DELETED_PROJECTS: args['deleted-projects'],
    PROCESS_HASHED_FILES: !args['skip-hashed-files'],
    PROCESS_BLOBS: !args['skip-existing-blobs'],
    DRY_RUN: args['dry-run'],
    OUTPUT_FILE: args.report ? '-' : args.output,
    BATCH_RANGE_START,
    BATCH_RANGE_END,
    LOGGING_IDENTIFIER: args['logging-id'] || BATCH_RANGE_START,
    LOGGING_INTERVAL: args['logging-interval-ms'],
    PROJECT_IDS_FROM: args['from-file'],
    DISPLAY_REPORT: args.report,
    CONCURRENCY: args.concurrency,
    CONCURRENT_BATCHES: args['concurrent-batches'],
    STREAM_HIGH_WATER_MARK: args['stream-high-water-mark'],
    RETRIES: args.retries,
    RETRY_DELAY_MS: args['retry-delay-ms'],
    RETRY_FILESTORE_404: args['retry-filestore-404'],
    BUFFER_DIR_PREFIX: args['buffer-dir-prefix'],
    SLEEP_BEFORE_EXIT: args['sleep-before-exit-ms'],
  }
}

const {
  PROCESS_NON_DELETED_PROJECTS,
  PROCESS_DELETED_PROJECTS,
  PROCESS_BLOBS,
  PROCESS_HASHED_FILES,
  DRY_RUN,
  OUTPUT_FILE,
  BATCH_RANGE_START,
  BATCH_RANGE_END,
  LOGGING_IDENTIFIER,
  PROJECT_IDS_FROM,
  DISPLAY_REPORT,
  CONCURRENCY,
  CONCURRENT_BATCHES,
  RETRIES,
  RETRY_DELAY_MS,
  RETRY_FILESTORE_404,
  BUFFER_DIR_PREFIX,
  STREAM_HIGH_WATER_MARK,
  LOGGING_INTERVAL,
  SLEEP_BEFORE_EXIT,
} = parseArgs()

// We need to handle the start and end differently as ids of deleted projects are created at time of deletion.
if (process.env.BATCH_RANGE_START || process.env.BATCH_RANGE_END) {
  throw new Error('use --BATCH_RANGE_START and --BATCH_RANGE_END')
}

const BUFFER_DIR = fs.mkdtempSync(BUFFER_DIR_PREFIX)

// Log output to a file
if (OUTPUT_FILE !== '-') {
  console.warn(`Writing logs into ${OUTPUT_FILE}`)
}
logger.initialize('file-migration', {
  streams: [
    {
      stream:
        OUTPUT_FILE === '-'
          ? process.stdout
          : fs.createWriteStream(OUTPUT_FILE, { flags: 'a' }),
    },
  ],
})

let lastElapsedTime = 0
async function displayProgress(options = {}) {
  if (OUTPUT_FILE === '-') {
    return // skip progress tracking when logging to stdout
  }
  if (options.completedAll) {
    process.stdout.write('\n')
    return
  }
  const elapsedTime = Math.floor((performance.now() - processStart) / 1000)
  if (lastElapsedTime === elapsedTime && !options.completedBatch) {
    // Avoid spamming the console with the same progress message
    return
  }
  lastElapsedTime = elapsedTime
  readline.clearLine(process.stdout, 0)
  readline.cursorTo(process.stdout, 0)
  process.stdout.write(
    `Processed ${STATS.projects} projects, elapsed time ${elapsedTime}s`
  )
}

/**
 * Display the stats for the projects or deletedProjects collections.
 *
 * @param {number} N - Number of samples to take from the collection.
 * @param {string} name - Name of the collection being sampled.
 * @param {Collection} collection - MongoDB collection to query.
 * @param {Object} query - MongoDB query to filter documents.
 * @param {Object} projection - MongoDB projection to select fields.
 * @param {number} collectionCount - Total number of documents in the collection.
 * @returns {Promise<void>} Resolves when stats have been displayed.
 */
async function getStatsForCollection(
  N,
  name,
  collection,
  query,
  projection,
  collectionCount
) {
  const stats = {
    projectCount: 0,
    projectsWithAllHashes: 0,
    fileCount: 0,
    fileWithHashCount: 0,
    fileMissingInHistoryCount: 0,
  }
  // Pick a random sample of projects and estimate the number of files without hashes
  const result = await collection
    .aggregate([
      { $sample: { size: N } },
      { $match: query },
      {
        $project: projection,
      },
    ])
    .toArray()

  for (const project of result) {
    const fileTree = JSON.stringify(project, [
      'project',
      'rootFolder',
      'folders',
      'fileRefs',
      'hash',
      '_id',
    ])
    // count the number of files without a hash, these are uniquely identified
    // by entries with {"_id":"...."} since we have filtered the file tree
    const filesWithoutHash = fileTree.match(/\{"_id":"[0-9a-f]{24}"\}/g) || []
    // count the number of files with a hash, these are uniquely identified
    // by the number of "hash" strings due to the filtering
    const filesWithHash = fileTree.match(/"hash":"[0-9a-f]{40}"/g) || []
    stats.fileCount += filesWithoutHash.length + filesWithHash.length
    stats.fileWithHashCount += filesWithHash.length
    stats.projectCount++
    stats.projectsWithAllHashes += filesWithoutHash.length === 0 ? 1 : 0
    const projectId = project._id.toString()
    const { blobs: perProjectBlobs } = await getProjectBlobsBatch([projectId])
    const blobs = new Set(
      (perProjectBlobs.get(projectId) || []).map(b => b.getHash())
    )
    const uniqueHashes = new Set(filesWithHash.map(m => m.slice(8, 48)))
    for (const hash of uniqueHashes) {
      if (blobs.has(hash) || GLOBAL_BLOBS.has(hash)) continue
      stats.fileMissingInHistoryCount++
    }
  }
  console.log(`Sampled stats for ${name}:`)
  const fractionSampled = stats.projectCount / collectionCount
  const percentageSampled = (fractionSampled * 100).toFixed(0)
  const fractionConverted = stats.projectsWithAllHashes / stats.projectCount
  const fractionToBackFill = 1 - fractionConverted
  const percentageToBackFill = (fractionToBackFill * 100).toFixed(0)
  const fractionMissing = stats.fileMissingInHistoryCount / stats.fileCount
  const percentageMissing = (fractionMissing * 100).toFixed(0)
  console.log(
    `- Sampled ${name}: ${stats.projectCount} (${percentageSampled}% of all ${name})`
  )
  console.log(
    `- Sampled ${name} with all hashes present: ${stats.projectsWithAllHashes}`
  )
  console.log(
    `- Percentage of ${name} that need back-filling hashes: ${percentageToBackFill}% (estimated)`
  )
  console.log(
    `- Sampled ${name} have ${stats.fileCount} files that need to be checked against the full project history system.`
  )
  console.log(
    `- Sampled ${name} have ${stats.fileMissingInHistoryCount} files that need to be uploaded to the full project history system (estimating ${percentageMissing}% of all files).`
  )
}

/**
 * Displays a report of the current status of projects and deleted projects,
 * including counts and estimated progress based on a sample.
 */
async function displayReport() {
  const projectsCountResult = await projectsCollection.estimatedDocumentCount()
  const deletedProjectsCountResult =
    await deletedProjectsCollection.estimatedDocumentCount()
  const sampleSize = 1000
  console.log('Current status:')
  console.log(`- Total number of projects: ${projectsCountResult}`)
  console.log(
    `- Total number of deleted projects: ${deletedProjectsCountResult}`
  )
  console.log(`Sampling ${sampleSize} projects to estimate progress...`)
  await getStatsForCollection(
    sampleSize,
    'projects',
    projectsCollection,
    { rootFolder: { $exists: true } },
    { rootFolder: 1 },
    projectsCountResult
  )
  await getStatsForCollection(
    sampleSize,
    'deleted projects',
    deletedProjectsCollection,
    { 'project.rootFolder': { $exists: true } },
    { 'project.rootFolder': 1 },
    deletedProjectsCountResult
  )
}

// Filestore endpoint location (configured by /etc/overleaf/env.sh)
const FILESTORE_HOST = process.env.FILESTORE_HOST || '127.0.0.1'
const FILESTORE_PORT = process.env.FILESTORE_PORT || '3009'

async function fetchFromFilestore(projectId, fileId) {
  const url = `http://${FILESTORE_HOST}:${FILESTORE_PORT}/project/${projectId}/file/${fileId}`
  const response = await fetch(url)
  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError('file not found in filestore', {
        status: response.status,
      })
    }
    const body = await response.text()
    throw new OError('fetchFromFilestore failed', {
      projectId,
      fileId,
      status: response.status,
      body,
    })
  }
  if (!response.body) {
    throw new OError('fetchFromFilestore response has no body', {
      projectId,
      fileId,
      status: response.status,
    })
  }
  return response.body
}

const projectsCollection = db.collection('projects')
/** @type {ProjectsCollection} */
const typedProjectsCollection = db.collection('projects')
const deletedProjectsCollection = db.collection('deletedProjects')
/** @type {DeletedProjectsCollection} */
const typedDeletedProjectsCollection = db.collection('deletedProjects')

const concurrencyLimit = pLimit(CONCURRENCY)

/**
 * @template T
 * @template V
 * @param {Array<T>} array
 * @param {(arg: T) => Promise<V>} fn
 * @return {Promise<Array<Awaited<V>>>}
 */
async function processConcurrently(array, fn) {
  return await Promise.all(array.map(x => concurrencyLimit(() => fn(x))))
}

const STATS = {
  projects: 0,
  blobs: 0,
  filesWithHash: 0,
  filesWithoutHash: 0,
  filesDuplicated: 0,
  filesRetries: 0,
  filesFailed: 0,
  fileTreeUpdated: 0,
  badFileTrees: 0,
  globalBlobsCount: 0,
  globalBlobsEgress: 0,
  projectDeleted: 0,
  projectHardDeleted: 0,
  fileHardDeleted: 0,
  mongoUpdates: 0,
  readFromGCSCount: 0,
  readFromGCSIngress: 0,
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
  const MiB = 1024 * 1024
  return v / MiB / (ms / 1000)
}

/**
 * @param {any} stats
 * @param {number} ms
 * @return {{readFromGCSThroughputMiBPerSecond: number}}
 */
function bandwidthStats(stats, ms) {
  return {
    readFromGCSThroughputMiBPerSecond: toMiBPerSecond(
      stats.readFromGCSIngress,
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

/**
 * @param {boolean} isLast
 */
function printStats(isLast = false) {
  const now = performance.now()
  const nextEventLoopStats = performance.eventLoopUtilization()
  const logLine = {
    time: new Date(),
    LOGGING_IDENTIFIER,
    ...STATS,
    ...bandwidthStats(STATS, now - processStart),
    eventLoop: nextEventLoopStats,
    diff: computeDiff(nextEventLoopStats, now),
    deferredBatches: Array.from(deferredBatches.keys()),
  }
  if (isLast && OUTPUT_FILE === '-') {
    console.warn(JSON.stringify(logLine))
  } else {
    logger.info(logLine, 'file-migration stats')
  }
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
 * @return {Promise<string|undefined>}
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
    if (!DRY_RUN) {
      await fs.promises.rm(filePath, { force: true })
    }
  }
}

/**
 * @param {QueueEntry} entry
 * @param {string} filePath
 * @return {Promise<string|undefined>}
 */
async function processFile(entry, filePath) {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      return await processFileOnce(entry, filePath)
    } catch (err) {
      if (gracefulShutdownInitiated) throw err
      if (err instanceof NotFoundError) {
        if (!RETRY_FILESTORE_404) {
          throw err // disable retries for not found in filestore bucket case
        }
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
      const jitter = Math.random() * RETRY_DELAY_MS
      await setTimeout(RETRY_DELAY_MS + jitter)
    }
  }
  return await processFileOnce(entry, filePath)
}

/**
 * @param {QueueEntry} entry
 * @param {string} filePath
 * @return {Promise<string|undefined>}
 */
async function processFileOnce(entry, filePath) {
  const {
    ctx: { projectId, historyId },
    fileId,
  } = entry
  if (entry.hash && entry.ctx.hasCompletedBlob(entry.hash)) {
    // We can enter this case for two identical files in the same project,
    // one with hash, the other without. When the one without hash gets
    // processed first, we can skip downloading the other one we already
    // know the hash of.
    return entry.hash
  }
  if (DRY_RUN) {
    return // skip processing in dry-run mode by returning undefined
  }
  const blobStore = new BlobStore(historyId)
  STATS.readFromGCSCount++
  // make a fetch request to filestore itself
  const src = await fetchFromFilestore(projectId, fileId)
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
  if (entry.hash && hash !== entry.hash) {
    throw new OError('hash mismatch', { entry, hash })
  }

  if (GLOBAL_BLOBS.has(hash)) {
    STATS.globalBlobsCount++
    STATS.globalBlobsEgress += estimateBlobSize(blob)
    return hash
  }
  if (entry.ctx.hasCompletedBlob(hash)) {
    return hash
  }
  entry.ctx.recordPendingBlob(hash)

  try {
    await uploadBlobToGCS(blobStore, entry, blob, hash, filePath)
    entry.ctx.recordCompletedBlob(hash) // mark upload as completed
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
  if (entry.ctx.getCachedHistoryBlob(hash)) {
    return // fast-path using hint from pre-fetched blobs
  }
  if (!PROCESS_BLOBS) {
    // round trip to postgres/mongo when not pre-fetched
    const blob = await blobStore.getBlob(hash)
    if (blob) {
      entry.ctx.recordHistoryBlob(blob)
      return
    }
  }
  // blob missing in history-v1, create in GCS and persist in postgres/mongo
  STATS.writeToGCSCount++
  STATS.writeToGCSEgress += blob.getByteLength()
  await blobStore.putBlob(filePath, blob)
  entry.ctx.recordHistoryBlob(blob)
}

/**
 * @param {Array<QueueEntry>} files
 * @return {Promise<void>}
 */
async function processFiles(files) {
  await processConcurrently(
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

/** @type {Map<string, Promise>} */
const deferredBatches = new Map()

async function waitForDeferredQueues() {
  // Wait for ALL pending batches to finish, especially wait for their mongo
  // writes to finish to avoid extra work when resuming the batch.
  const all = await Promise.allSettled(deferredBatches.values())
  displayProgress({ completedAll: true })
  // Now that all batches finished, we can throw if needed.
  for (const res of all) {
    if (res.status === 'rejected') {
      throw res.reason
    }
  }
}

/**
 * @param {Array<Project>} batch
 * @param {string} prefix
 */
async function queueNextBatch(batch, prefix = 'rootFolder.0') {
  if (gracefulShutdownInitiated) {
    throw new Error('graceful shutdown: aborting batch processing')
  }

  // Read ids now, the batch will get trimmed by processBatch shortly.
  const start = renderObjectId(batch[0]._id)
  const end = renderObjectId(batch[batch.length - 1]._id)
  const deferred = processBatch(batch, prefix)
    .then(() => {
      logger.info({ end }, 'actually completed batch')
      displayProgress({ completedBatch: true })
    })

    .catch(err => {
      logger.error({ err, start, end }, 'fatal error processing batch')
      throw err
    })
    .finally(() => {
      deferredBatches.delete(end)
    })
  deferredBatches.set(end, deferred)

  if (deferredBatches.size >= CONCURRENT_BATCHES) {
    // Wait for any of the deferred batches to finish before fetching the next.
    // We should never have more than CONCURRENT_BATCHES batches in memory.
    await Promise.race(deferredBatches.values())
  }
}

/**
 * @param {Array<Project>} batch
 * @param {string} prefix
 * @return {Promise<void>}
 */
async function processBatch(batch, prefix = 'rootFolder.0') {
  const { nBlobs, blobs } = await collectProjectBlobs(batch)
  const files = Array.from(findFileInBatch(batch, prefix, blobs))
  STATS.projects += batch.length
  STATS.blobs += nBlobs

  // GC
  batch.length = 0
  blobs.clear()

  // The files are currently ordered by project-id.
  // Order them by file-id ASC then hash ASC to
  // increase the hit rate on the "already processed
  // hash for project" checks.
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
  await processConcurrently(
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
  await queueNextBatch(
    batch.map(d => d.project),
    'project.rootFolder.0'
  )
}

/**
 * @param {QueueEntry} entry
 * @return {Promise<boolean>}
 */
async function tryUpdateFileRefInMongo(entry) {
  if (DRY_RUN) {
    return true // skip mongo updates in dry-run mode
  }
  if (entry.path.startsWith('project.')) {
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
async function tryUpdateFileRefInMongoInDeletedProject(entry) {
  if (DRY_RUN) {
    return true // skip mongo updates in dry-run mode
  }
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
 * @param {boolean} isInputLoop
 * @return Generator<QueueEntry>
 */
function* findFiles(ctx, folder, path, isInputLoop = false) {
  if (!folder || typeof folder !== 'object') {
    ctx.fileTreeBroken = true
    logger.warn({ projectId: ctx.projectId, path }, 'bad file-tree, bad folder')
    return
  }
  if (!Array.isArray(folder.folders)) {
    folder.folders = []
    ctx.fileTreeBroken = true
    logger.warn(
      { projectId: ctx.projectId, path: `${path}.folders` },
      'bad file-tree, bad folders'
    )
  }
  let i = 0
  for (const child of folder.folders) {
    const idx = i++
    yield* findFiles(ctx, child, `${path}.folders.${idx}`, isInputLoop)
  }
  if (!Array.isArray(folder.fileRefs)) {
    folder.fileRefs = []
    ctx.fileTreeBroken = true
    logger.warn(
      { projectId: ctx.projectId, path: `${path}.fileRefs` },
      'bad file-tree, bad fileRefs'
    )
  }
  i = 0
  for (const fileRef of folder.fileRefs) {
    const idx = i++
    const fileRefPath = `${path}.fileRefs.${idx}`
    if (!fileRef._id || !(fileRef._id instanceof ObjectId)) {
      ctx.fileTreeBroken = true
      logger.warn(
        { projectId: ctx.projectId, path: fileRefPath },
        'bad file-tree, bad fileRef id'
      )
      continue
    }
    const fileId = fileRef._id.toString()
    if (PROCESS_HASHED_FILES && fileRef.hash) {
      if (ctx.canSkipProcessingHashedFile(fileRef.hash)) continue
      if (isInputLoop) {
        ctx.remainingQueueEntries++
        STATS.filesWithHash++
      }
      yield {
        ctx,
        cacheKey: fileRef.hash,
        fileId,
        path: MONGO_PATH_SKIP_WRITE_HASH_TO_FILE_TREE,
        hash: fileRef.hash,
      }
    }
    if (!fileRef.hash) {
      if (isInputLoop) {
        ctx.remainingQueueEntries++
        STATS.filesWithoutHash++
      }
      yield {
        ctx,
        cacheKey: fileId,
        fileId,
        path: fileRefPath,
      }
    }
  }
}

/**
 * @param {Array<Project>} projects
 * @param {string} prefix
 * @param {Map<string,Array<Blob>>} blobs
 * @return Generator<QueueEntry>
 */
function* findFileInBatch(projects, prefix, blobs) {
  for (const project of projects) {
    const projectIdS = project._id.toString()
    const historyIdS = project.overleaf.history.id.toString()
    const projectBlobs = blobs.get(historyIdS) || []
    const ctx = new ProjectContext(project._id, historyIdS, projectBlobs)
    try {
      yield* findFiles(ctx, project.rootFolder?.[0], prefix, true)
    } catch (err) {
      logger.error(
        { err, projectId: projectIdS },
        'bad file-tree, processing error'
      )
    } finally {
      if (ctx.fileTreeBroken) STATS.badFileTrees++
    }
  }
}

/**
 * @param {Array<Project>} batch
 * @return {Promise<{nBlobs: number, blobs: Map<string, Array<Blob>>}>}
 */
async function collectProjectBlobs(batch) {
  if (!PROCESS_BLOBS) return { nBlobs: 0, blobs: new Map() }
  return await getProjectBlobsBatch(batch.map(p => p.overleaf.history.id))
}

const BATCH_FILE_UPDATES = 100

const MONGO_PATH_SKIP_WRITE_HASH_TO_FILE_TREE = 'skip-write-to-file-tree'

class ProjectContext {
  /** @type {Map<string, Blob>} */
  #historyBlobs

  /** @type {number} */
  remainingQueueEntries = 0

  /** @type {boolean} */
  fileTreeBroken = false

  /**
   * @param {ObjectId} projectId
   * @param {string} historyId
   * @param {Array<Blob>} blobs
   */
  constructor(projectId, historyId, blobs) {
    this.projectId = projectId
    this.historyId = historyId
    this.#historyBlobs = new Map(blobs.map(b => [b.getHash(), b]))
  }

  /**
   * @param {string} hash
   * @return {Blob | undefined}
   */
  getCachedHistoryBlob(hash) {
    return this.#historyBlobs.get(hash)
  }

  /**
   * @param {Blob} blob
   */
  recordHistoryBlob(blob) {
    this.#historyBlobs.set(blob.getHash(), blob)
  }

  /**
   * @param {string} hash
   * @return {boolean}
   */
  canSkipProcessingHashedFile(hash) {
    if (this.#historyBlobs.has(hash)) return true // This file will be processed as blob.
    if (GLOBAL_BLOBS.has(hash)) return true // global blob
    return false
  }

  async flushMongoQueuesIfNeeded() {
    if (this.remainingQueueEntries === 0) {
      await this.flushMongoQueues()
    }

    if (this.#pendingFileWrites.length > BATCH_FILE_UPDATES) {
      await this.#storeFileHashes()
    }
  }

  async flushMongoQueues() {
    await this.#storeFileHashes()
  }

  /** @type {Set<string>} */
  #pendingBlobs = new Set()
  /** @type {Set<string>} */
  #completedBlobs = new Set()

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
  recordCompletedBlob(hash) {
    this.#completedBlobs.add(hash)
    this.#pendingBlobs.delete(hash)
  }

  /**
   * @param {string} hash
   * @return {boolean}
   */
  hasCompletedBlob(hash) {
    return this.#pendingBlobs.has(hash) || this.#completedBlobs.has(hash)
  }

  /** @type {Array<QueueEntry>} */
  #pendingFileWrites = []

  /**
   * @param {QueueEntry} entry
   */
  queueFileForWritingHash(entry) {
    if (entry.path === MONGO_PATH_SKIP_WRITE_HASH_TO_FILE_TREE) return
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
    if (DRY_RUN) return [] // skip mongo updates in dry-run mode
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
      if (entry.path.startsWith('project.')) {
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

  /** @type {Map<string, Promise<string|undefined>>} */
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
    try {
      const hash = await this.#pendingFiles.get(entry.cacheKey)
      if (!hash) {
        if (DRY_RUN) {
          return // hash is undefined in dry-run mode
        } else {
          throw new Error('undefined hash outside dry-run mode')
        }
      } else {
        entry.hash = hash
      }
    } finally {
      this.remainingQueueEntries--
    }
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

async function processProjectsFromFile() {
  const rl = readline.createInterface({
    input: fs.createReadStream(PROJECT_IDS_FROM),
  })
  for await (const projectId of rl) {
    if (!projectId) continue // skip over trailing new line
    let project = await typedProjectsCollection.findOne(
      { _id: new ObjectId(projectId) },
      { projection: { rootFolder: 1, _id: 1, 'overleaf.history.id': 1 } }
    )
    let prefix = 'rootFolder.0'
    if (!project) {
      const deletedProject = await typedDeletedProjectsCollection.findOne(
        { 'deleterData.deletedProjectId': new ObjectId(projectId) },
        {
          projection: {
            'project.rootFolder': 1,
            'project._id': 1,
            'project.overleaf.history.id': 1,
          },
        }
      )
      if (!deletedProject?.project) {
        logger.warn({ projectId }, 'project hard-deleted')
        continue
      }
      project = deletedProject.project
      prefix = 'project.rootFolder.0'
    }
    if (!project?.overleaf?.history?.id) {
      logger.warn({ projectId }, 'project has no history id')
      continue
    }
    try {
      await queueNextBatch([project], prefix)
    } catch (err) {
      gracefulShutdownInitiated = true
      await waitForDeferredQueues()
      throw err
    }
  }
  await waitForDeferredQueues()
  console.warn('Done updating projects from input file')
}

async function processNonDeletedProjects() {
  try {
    await batchedUpdate(
      projectsCollection,
      { 'overleaf.history.id': { $exists: true } },
      queueNextBatch,
      { rootFolder: 1, _id: 1, 'overleaf.history.id': 1 },
      {},
      {
        BATCH_RANGE_START,
        BATCH_RANGE_END,
        trackProgress: async message => {},
      }
    )
  } catch (err) {
    gracefulShutdownInitiated = true
    throw err
  } finally {
    await waitForDeferredQueues()
  }
  console.warn('Done updating live projects')
}

async function processDeletedProjects() {
  try {
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
      },
      {},
      { trackProgress: async message => {} }
    )
  } catch (err) {
    gracefulShutdownInitiated = true
    throw err
  } finally {
    await waitForDeferredQueues()
  }
  console.warn('Done updating deleted projects')
}

async function main() {
  console.log('Starting project file backup...')
  await loadGlobalBlobs()
  console.log('Loaded global blobs:', GLOBAL_BLOBS.size)
  if (PROJECT_IDS_FROM) {
    console.log(
      `Processing projects from file: ${PROJECT_IDS_FROM}, this may take a while...`
    )
    await processProjectsFromFile()
  } else {
    if (PROCESS_NON_DELETED_PROJECTS) {
      console.log('Processing non-deleted projects...')
      await processNonDeletedProjects()
    }
    if (PROCESS_DELETED_PROJECTS) {
      console.log('Processing deleted projects...')
      await processDeletedProjects()
    }
  }
  console.warn('Done.')
}

async function cleanupBufferDir() {
  try {
    // Perform non-recursive removal of the BUFFER_DIR. Individual files
    // should get removed in parallel as part of batch processing.
    await fs.promises.rmdir(BUFFER_DIR)
  } catch (err) {
    console.error(`cleanup of BUFFER_DIR=${BUFFER_DIR} failed`, err)
  }
}

if (DISPLAY_REPORT) {
  await cleanupBufferDir()
  console.warn('Displaying report...')
  await displayReport()
  process.exit(0)
}

try {
  try {
    await main()
  } finally {
    printStats(true)
    await cleanupBufferDir()
  }

  let code = 0
  if (STATS.filesFailed > 0) {
    console.warn(
      `Some files could not be processed, see logs in ${OUTPUT_FILE} and try again`
    )
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
  console.warn('-'.repeat(79))
  if (code === 0) {
    const allProcessed =
      !DRY_RUN &&
      PROCESS_NON_DELETED_PROJECTS &&
      PROCESS_DELETED_PROJECTS &&
      PROCESS_HASHED_FILES &&
      !PROJECT_IDS_FROM &&
      usesDefaultBatchRange()
    if (allProcessed) {
      await db
        .collection('migrations')
        .updateOne(
          { name: '20250519101128_binary_files_migration' },
          { $set: { migratedAt: new Date(DEFAULT_BATCH_RANGE_END_DATE) } },
          { upsert: true }
        )
      console.warn('The binary files migration succeeded.')
      console.warn(
        'You can now proceed to OVERLEAF_FILESTORE_MIGRATION_LEVEL=2.'
      )
    } else {
      console.warn(
        'The binary files migration succeeded on a subset of files (at least one of --dry-run, --skip-hashed-files, --from-file, --BATCH_RANGE_START or --BATCH_RANGE_END is set and --all is not set).'
      )
      console.warn(
        'Once you are done with all the partial runs, you need to run the migration again on all projects/files to ensure that all files are migrated into the full project history system.'
      )
      console.warn('The full run will unlock the upgrade to Server Pro 6.0.')
    }
  } else {
    console.warn('The binary files migration failed, see above.')
    console.warn(
      'Please review the failures and check the docs on remediating the failures.'
    )
    console.warn(
      'Docs: https://docs.overleaf.com/on-premises/release-notes/release-notes-5.x.x/binary-files-migration#troubleshooting'
    )
    console.warn(
      'In case there is not solution available, please reach out to support as detailed in the docs.'
    )
  }
  console.warn('-'.repeat(79))
  await setTimeout(SLEEP_BEFORE_EXIT)
  process.exit(code)
} catch (err) {
  console.error(err)
  await setTimeout(SLEEP_BEFORE_EXIT)
  process.exit(1)
}
