import config from 'config'
import PQueue from 'p-queue'
import { fetchNothing } from '@overleaf/fetch-utils'
import logger from '@overleaf/logger'
import commandLineArgs from 'command-line-args'
import * as redis from '../lib/redis.js'
import knex from '../lib/knex.js'
import knexReadOnly from '../lib/knex_read_only.js'
import { client } from '../lib/mongodb.js'
import { scanAndProcessDueItems } from '../lib/scan.js'
import persistBuffer from '../lib/persist_buffer.js'
import { claimPersistJob } from '../lib/chunk_store/redis.js'
import { loadGlobalBlobs } from '../lib/blob_store/index.js'
import { EventEmitter } from 'node:events'
import { fileURLToPath } from 'node:url'

// Something is registering 11 listeners, over the limit of 10, which generates
// a lot of warning noise.
EventEmitter.defaultMaxListeners = 11

const rclient = redis.rclientHistory

const optionDefinitions = [
  { name: 'dry-run', alias: 'd', type: Boolean },
  { name: 'queue', type: Boolean },
  { name: 'max-time', type: Number },
  { name: 'min-rate', type: Number, defaultValue: 1 },
]
const options = commandLineArgs(optionDefinitions)
const DRY_RUN = options['dry-run'] || false
const USE_QUEUE = options.queue || false
const MAX_TIME = options['max-time'] || null
const MIN_RATE = options['min-rate']
const HISTORY_V1_URL = `http://${process.env.HISTORY_V1_HOST || 'localhost'}:${process.env.PORT || 3100}`
let isShuttingDown = false

logger.initialize('persist-redis-chunks')

async function persistProjectAction(projectId) {
  const job = await claimPersistJob(projectId)
  // Set limits to force us to persist all of the changes.
  const farFuture = new Date()
  farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
  const limits = {
    maxChanges: 0,
    minChangeTimestamp: farFuture,
    maxChangeTimestamp: farFuture,
    autoResync: true,
  }
  await persistBuffer(projectId, limits)
  if (job && job.close) {
    await job.close()
  }
}

async function requestProjectFlush(projectId) {
  const job = await claimPersistJob(projectId)
  logger.debug({ projectId }, 'sending project flush request')
  const url = `${HISTORY_V1_URL}/api/projects/${projectId}/flush`
  const credentials = Buffer.from(
    `staging:${config.get('basicHttpAuth.password')}`
  ).toString('base64')
  await fetchNothing(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  })
  if (job && job.close) {
    await job.close()
  }
}

async function persistQueuedProjects(queuedProjects) {
  const totalCount = queuedProjects.size
  // Compute the rate at which we need to dispatch requests
  const targetRate = MAX_TIME > 0 ? Math.ceil(totalCount / MAX_TIME) : 0
  // Rate limit to spread the requests over the interval.
  const queue = new PQueue({
    intervalCap: Math.max(MIN_RATE, targetRate),
    interval: 1000, // use a 1 second interval
  })
  logger.info(
    { totalCount, targetRate, minRate: MIN_RATE, maxTime: MAX_TIME },
    'dispatching project flush requests'
  )
  const startTime = Date.now()
  let dispatchedCount = 0
  for (const projectId of queuedProjects) {
    if (isShuttingDown) {
      logger.info('Shutting down, stopping project flush requests')
      queue.clear()
      break
    }
    queue.add(async () => {
      try {
        await requestProjectFlush(projectId)
      } catch (err) {
        logger.error({ err, projectId }, 'error while flushing project')
      }
    })
    dispatchedCount++
    if (dispatchedCount % 1000 === 0) {
      logger.info(
        { count: dispatchedCount },
        'dispatched project flush requests'
      )
    }
    await queue.onEmpty()
  }
  const elapsedTime = Math.floor((Date.now() - startTime) / 1000)
  logger.info(
    { count: totalCount, elapsedTime },
    'dispatched project flush requests'
  )
  await queue.onIdle()
}

async function runPersistChunks() {
  const queuedProjects = new Set()

  async function queueProjectAction(projectId) {
    queuedProjects.add(projectId)
  }

  await loadGlobalBlobs()
  await scanAndProcessDueItems(
    rclient,
    'persistChunks',
    'persist-time',
    USE_QUEUE ? queueProjectAction : persistProjectAction,
    DRY_RUN
  )

  if (USE_QUEUE) {
    if (isShuttingDown) {
      logger.info('Shutting down, skipping queued project persistence')
      return
    }
    logger.info(
      { count: queuedProjects.size },
      'queued projects for persistence'
    )
    await persistQueuedProjects(queuedProjects)
  }
}

async function main() {
  try {
    await runPersistChunks()
  } catch (err) {
    logger.fatal(
      { err, taskName: 'persistChunks' },
      'Unhandled error in runPersistChunks'
    )
    process.exit(1)
  } finally {
    await redis.disconnect()
    await client.close()
    await knex.destroy()
    await knexReadOnly.destroy()
  }
}

function gracefulShutdown() {
  if (isShuttingDown) {
    return
  }
  isShuttingDown = true
  logger.info({ isShuttingDown }, 'received shutdown signal, cleaning up...')
}

// Check if the module is being run directly
const currentScriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] === currentScriptPath) {
  process.on('SIGINT', gracefulShutdown)
  process.on('SIGTERM', gracefulShutdown)
  main()
}

export { runPersistChunks }
