#!/usr/bin/env node

import Settings from '@overleaf/settings'
import minimist from 'minimist'
import logger from '@overleaf/logger'
import PQueue from 'p-queue'
import * as RedisManager from '../app/js/RedisManager.js'
import * as ErrorRecorder from '../app/js/ErrorRecorder.js'

logger.logger.level('fatal')

function usage() {
  console.log(`
Usage: flush_old.js [options]

Options:
  -b, --batch-size <size>    Number of projects to process in each batch (default: 100)
  -a, --max-age <seconds>    Maximum age of projects to keep (default: 3600)
  -i, --interval <seconds>   Interval to spread the processing over (default: 300)
  -c, --concurrency <number> Number of concurrent jobs (default: 10)
  -u, --buffer <seconds>     Buffer time in seconds to reserve at end (default: 15)
  -n, --dry-run              Show what would be done without making changes
  -h, --help                 Show this help message

Examples:
  # Flush projects older than 24 hours with 5 concurrent jobs
  flush_old.js --batch-size 100 --max-age 86400 -c 5

  # Dry run to see what would be flushed
  flush_old.js --max-age 3600 --dry-run
`)
  process.exit(0)
}

const argv = minimist(process.argv.slice(2), {
  boolean: ['dry-run', 'help'],
  alias: {
    b: 'batch-size',
    a: 'max-age',
    i: 'interval',
    c: 'concurrency',
    n: 'dry-run',
    u: 'buffer',
    h: 'help',
  },
  default: {
    'batch-size': 100,
    'max-age': 3600,
    interval: 300,
    concurrency: 10,
    'dry-run': false,
    buffer: 15,
    help: false,
  },
})

if (argv.help || process.argv.length === 2) {
  usage()
}

const batchSize = parseInt(argv['batch-size'], 10)
const maxAge = argv['max-age'] ? parseInt(argv['max-age'], 10) : null
const interval = parseInt(argv.interval, 10) || 300
const concurrency = parseInt(argv.concurrency, 10) || 10
const bufferTime = parseInt(argv.buffer, 10) || 15
const dryRun = argv['dry-run']

/**
 * Generator function that yields batches of items from an array
 * @param {Array} array - The array to batch
 * @param {number} size - The size of each batch
 * @yields {Array} A batch of items
 */
function* getBatches(array, size) {
  for (let i = 0; i < array.length; i += size) {
    yield array.slice(i, i + size)
  }
}

let flushCount = 0

async function flushProject({ projectId, timestamp }) {
  const url = `${Settings.apis.project_history.url}/project/${projectId}/flush`
  if (dryRun) {
    console.log(`[DRY RUN] would flush project ${projectId}`)
    return
  }
  const response = await fetch(url, {
    method: 'POST',
  })
  flushCount++
  if (flushCount % 100 === 0) {
    console.log('flushed', flushCount, 'projects, up to', timestamp)
  }
  if (!response.ok) {
    throw new Error(`failed to flush project ${projectId}`)
  }
}

const SCRIPT_START_TIME = Date.now() // current time in milliseconds from start of script

function olderThan(maxAge, timestamp) {
  const age = (SCRIPT_START_TIME - timestamp) / 1000
  return age > maxAge
}

async function main() {
  const projectIds = await RedisManager.promises.getProjectIdsWithHistoryOps()
  const failedProjects = await ErrorRecorder.promises.getFailedProjects()
  const failedProjectIds = new Set(failedProjects.map(p => p.project_id))

  const projectIdsToProcess = projectIds.filter(p => !failedProjectIds.has(p))
  console.log('number of projects with history ops', projectIds.length)
  console.log(
    'number of failed projects to exclude',
    projectIds.length - projectIdsToProcess.length
  )
  const collectedProjects = []
  let nullCount = 0
  // iterate over the project ids in batches of doing a redis MGET to retrieve the first op timestamps
  for (const batch of getBatches(projectIdsToProcess, batchSize)) {
    const timestamps = await RedisManager.promises.getFirstOpTimestamps(batch)
    const newProjects = batch
      .map((projectId, idx) => {
        return { projectId, timestamp: timestamps[idx] }
      })
      .filter(({ projectId, timestamp }) => {
        if (!timestamp) {
          nullCount++
          return true // Unknown age
        }
        if (olderThan(maxAge, timestamp)) return true // Older than threshold
        if (Settings.shortHistoryQueues.includes(projectId)) return true // Short queue
        return false // Do not flush
      })
    collectedProjects.push(...newProjects)
  }
  // sort the collected projects by ascending timestamp
  collectedProjects.sort((a, b) => a.timestamp - b.timestamp)

  console.log('number of projects to flush', collectedProjects.length)
  console.log('number with null timestamps', nullCount)

  const elapsedTime = Math.floor((Date.now() - SCRIPT_START_TIME) / 1000)
  console.log('elapsed time', elapsedTime, 'seconds, buffer time', bufferTime)
  const remainingTime = Math.max(interval - elapsedTime - bufferTime, 0)
  console.log('remaining time', remainingTime, 'seconds')

  const jobsPerSecond = Math.max(
    Math.ceil(collectedProjects.length / Math.max(remainingTime, 60)),
    1
  )
  console.log('interval', interval, 'seconds')
  console.log('jobs per second', jobsPerSecond)
  console.log('concurrency', concurrency)

  const queue = new PQueue({
    concurrency,
    interval: 1000,
    intervalCap: jobsPerSecond,
  })

  const taskFns = collectedProjects.map(project => {
    return async () => {
      try {
        await flushProject(project)
        return { status: 'fulfilled', value: project }
      } catch (error) {
        return { status: 'rejected', reason: error, project }
      }
    }
  })

  const results = await queue.addAll(taskFns)

  console.log(
    'finished after',
    Math.floor((Date.now() - SCRIPT_START_TIME) / 1000),
    'seconds'
  )
  // count the number of successful and failed flushes
  const success = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  console.log('completed', { success, failed })
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
