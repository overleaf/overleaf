// @ts-check
import Events from 'node:events'
import { setTimeout } from 'node:timers/promises'
import readline from 'node:readline'
import fs from 'node:fs'
import minimist from 'minimist'
import { ObjectId } from 'mongodb'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'
import OError from '@overleaf/o-error'
import { promiseMapWithLimit } from '@overleaf/promise-utils'
import { db, mongoClient } from '../app/js/mongodb.js'
import * as HistoryStoreManager from '../app/js/HistoryStoreManager.js'
import * as RedisManager from '../app/js/RedisManager.js'
import * as SyncManager from '../app/js/SyncManager.js'
import * as UpdatesProcessor from '../app/js/UpdatesProcessor.js'
import { NeedFullProjectStructureResyncError } from '../app/js/Errors.js'
import * as ErrorRecorder from '../app/js/ErrorRecorder.js'

// Silence warning.
Events.setMaxListeners(20)

// Enable caching for ObjectId.toString()
ObjectId.cacheHexString = true

const READ_CONCURRENCY = parseInt(process.env.READ_CONCURRENCY || '100', 10)
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY || '10', 10)
const FLUSH_RETRIES = parseInt(process.env.FLUSH_RETRIES || '20', 10)

// Relevant dates:
// - 2024-12-19, start of event-hold removal in filestore bucket -> objects older than 24h are (soft-)deleted.
// - 2024-12-23, copy operation skipped in filestore when cloning project -> objects not created on clone.
// - 2025-01-24, no more filestore reads allowed in project-history -> no more empty files in history for 404s
const FILESTORE_SOFT_DELETE_START = new Date('2024-12-19T00:00:00Z')
const FILESTORE_READ_OFF = new Date('2025-01-24T15:00:00Z')

const argv = minimist(process.argv.slice(2), {
  string: ['logs', 'log-latency'],
})
const LOG_LATENCY = argv['log-latency'] === 'true'

let gracefulShutdownInitiated = false

process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

function handleSignal() {
  gracefulShutdownInitiated = true
  console.warn('graceful shutdown initiated, draining queue')
}

const STATS = {
  processedLines: 0,
  success: 0,
  changed: 0,
  failure: 0,
  skipped: 0,
  checkFailure: 0,
}

function logStats() {
  console.log(
    JSON.stringify({
      time: new Date(),
      gracefulShutdownInitiated,
      ...STATS,
    })
  )
}
const logInterval = setInterval(logStats, 10_000)

/**
 * @typedef {Object} FileRef
 * @property {ObjectId} _id
 * @property {any} linkedFileData
 */

/**
 * @typedef {Object} Folder
 * @property {Array<Folder>} folders
 * @property {Array<FileRef>} fileRefs
 */

/**
 * @typedef {Object} Project
 * @property {ObjectId} _id
 * @property {Date} lastUpdated
 * @property {Array<Folder>} rootFolder
 * @property {{history: {id: (number|string)}}} overleaf
 */

/**
 * @param {Folder} folder
 * @return {boolean}
 */
function checkFileTreeNeedsResync(folder) {
  if (!folder) return false
  if (Array.isArray(folder.fileRefs)) {
    for (const fileRef of folder.fileRefs) {
      if (fileRef.linkedFileData) return true
      if (fileRef._id.getTimestamp() > FILESTORE_SOFT_DELETE_START) return true
    }
  }
  if (Array.isArray(folder.folders)) {
    for (const child of folder.folders) {
      if (checkFileTreeNeedsResync(child)) return true
    }
  }
  return false
}

/**
 * @param {string} projectId
 * @param {string} historyId
 * @return {Promise<Date>}
 */
async function getLastEndTimestamp(projectId, historyId) {
  const raw = await HistoryStoreManager.promises.getMostRecentVersionRaw(
    projectId,
    historyId,
    { readOnly: true }
  )
  if (!raw) throw new Error('bug: history not initialized')
  return raw.endTimestamp
}

/** @type {Record<string, (project: Project) => Promise<boolean>>} */
const conditions = {
  // cheap: in-memory mongo lookup
  'updated after filestore soft-delete': async function (project) {
    return project.lastUpdated > FILESTORE_SOFT_DELETE_START
  },
  // cheap: in-memory mongo lookup
  'file-tree requires re-sync': async function (project) {
    return checkFileTreeNeedsResync(project.rootFolder?.[0])
  },
  // moderate: GET from Redis
  'has pending operations': async function (project) {
    const n = await RedisManager.promises.countUnprocessedUpdates(
      project._id.toString()
    )
    return n > 0
  },
  // expensive: GET from Mongo/Postgres via history-v1 HTTP API call
  'has been flushed after filestore soft-delete': async function (project) {
    // Resyncs started after soft-deleting can trigger 404s and result in empty files.
    const endTimestamp = await getLastEndTimestamp(
      project._id.toString(),
      project.overleaf.history.id.toString()
    )
    return endTimestamp > FILESTORE_SOFT_DELETE_START
  },
}

/**
 * @param {Project} project
 * @return {Promise<{projectId: string, historyId: string} | null>}
 */
async function checkProject(project) {
  if (gracefulShutdownInitiated) return null
  if (project._id.getTimestamp() > FILESTORE_READ_OFF) {
    STATS.skipped++ // Project created after all bugs were fixed.
    return null
  }
  const projectId = project._id.toString()
  const historyId = project.overleaf.history.id.toString()
  for (const [condition, check] of Object.entries(conditions)) {
    try {
      if (await check(project)) return { projectId, historyId }
    } catch (err) {
      logger.err({ projectId, condition, err }, 'failed to check project')
      STATS.checkFailure++
      return null
    }
  }
  STATS.skipped++
  return null
}

/**
 * @param {string} projectId
 * @param {string} historyId
 * @return {Promise<void>}
 */
async function processProject(projectId, historyId) {
  if (gracefulShutdownInitiated) return
  const t0 = performance.now()
  try {
    await tryProcessProject(projectId, historyId)
    const latency = performance.now() - t0
    if (LOG_LATENCY) {
      logger.info({ projectId, historyId, latency }, 'processed project')
    }
    STATS.success++
  } catch (err) {
    logger.err({ err, projectId, historyId }, 'failed to process project')
    STATS.failure++
  }
}

/**
 * @param {string} projectId
 * @return {Promise<void>}
 */
async function flushWithRetries(projectId) {
  for (let attempt = 0; attempt < FLUSH_RETRIES; attempt++) {
    try {
      await UpdatesProcessor.promises.processUpdatesForProject(projectId)
      return
    } catch (err) {
      logger.warn(
        { projectId, err, attempt },
        'failed to flush updates, trying again'
      )
      if (gracefulShutdownInitiated) throw err
    }
  }

  try {
    await UpdatesProcessor.promises.processUpdatesForProject(projectId)
  } catch (err) {
    // @ts-ignore err is Error
    throw new OError('failed to flush updates', {}, err)
  }
}

/**
 * @param {string} projectId
 * @param {string} historyId
 * @return {Promise<void>}
 */
async function tryProcessProject(projectId, historyId) {
  await flushWithRetries(projectId)
  const start = new Date()
  let needsFullSync = false
  try {
    await UpdatesProcessor.promises.startResyncAndProcessUpdatesUnderLock(
      projectId,
      { resyncProjectStructureOnly: true }
    )
  } catch (err) {
    if (err instanceof NeedFullProjectStructureResyncError) {
      needsFullSync = true
    } else {
      throw err
    }
  }
  if (needsFullSync) {
    logger.warn(
      { projectId, historyId },
      'structure only resync not sufficient, doing full soft resync'
    )
    await SyncManager.promises.startResync(projectId, {})
    await UpdatesProcessor.promises.processUpdatesForProject(projectId)
    STATS.changed++
  } else {
    const after = await getLastEndTimestamp(projectId, historyId)
    if (after > start) {
      STATS.changed++
    }
  }
  // Avoid db.projectHistorySyncState from growing for each project we resynced.
  // MongoDB collections cannot shrink on their own. In case of success, purge
  // the db entry created by this script right away.
  await SyncManager.promises.clearResyncStateIfAllAfter(projectId, start)
}

async function processBatch(projects) {
  const projectIds = (
    await promiseMapWithLimit(READ_CONCURRENCY, projects, checkProject)
  ).filter(id => !!id)
  await promiseMapWithLimit(WRITE_CONCURRENCY, projectIds, ids =>
    processProject(ids.projectId, ids.historyId)
  )

  if (gracefulShutdownInitiated) throw new Error('graceful shutdown triggered')
}

async function processProjectsFromLog() {
  const rl = readline.createInterface({
    input: fs.createReadStream(argv.logs),
  })
  for await (const line of rl) {
    if (gracefulShutdownInitiated) break
    STATS.processedLines++
    if (!line.startsWith('{')) continue
    const { projectId, historyId, msg } = JSON.parse(line)
    if (msg !== 'failed to process project') continue
    await processProject(projectId, historyId) // does try/catch with logging
  }
}

async function main() {
  if (argv.logs) {
    await processProjectsFromLog()
    return
  }
  await batchedUpdate(db.projects, {}, processBatch, {
    _id: 1,
    lastUpdated: 1,
    'overleaf.history': 1,
    rootFolder: 1,
  })
}

try {
  try {
    await main()
  } finally {
    clearInterval(logInterval)
    logStats()
    Metrics.close()
    await mongoClient.close()
    // TODO(das7pad): graceful shutdown for redis. Refactor process.exit when done.
  }
  console.log('Done.')
  await setTimeout(1_000)
  if (STATS.failure) {
    process.exit(Math.min(STATS.failure, 99))
  } else {
    process.exit(0)
  }
} catch (err) {
  logger.err({ err }, 'fatal error')
  await setTimeout(1_000)
  process.exit(100)
}
