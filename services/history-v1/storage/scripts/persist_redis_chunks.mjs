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

const optionDefinitions = [{ name: 'dry-run', alias: 'd', type: Boolean }]
const options = commandLineArgs(optionDefinitions)
const DRY_RUN = options['dry-run'] || false

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
  }
  await persistBuffer(projectId, limits)
  if (job && job.close) {
    await job.close()
  }
}

async function runPersistChunks() {
  await loadGlobalBlobs()
  await scanAndProcessDueItems(
    rclient,
    'persistChunks',
    'persist-time',
    persistProjectAction,
    DRY_RUN
  )
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

// Check if the module is being run directly
const currentScriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] === currentScriptPath) {
  main()
}

export { runPersistChunks }
