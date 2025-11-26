#!/usr/bin/env node
import minimist from 'minimist'
import PQueue from 'p-queue'
import InactiveProjectManager from '../app/src/Features/InactiveData/InactiveProjectManager.mjs'
import { gracefulShutdown } from '../app/src/infrastructure/GracefulShutdown.mjs'
import logger from '@overleaf/logger'

// Global variables for tracking job and error counts
let jobCount = 0
let succeededCount = 0
let skippedCount = 0
let failedCount = 0
let currentAgeInDays = null
let currentLastOpened = null
let DRY_RUN = false
let gracefulShutdownInitiated = false
const SCRIPT_START_TIME = Date.now()
const MAX_RUNTIME_DEFAULT = null
let MAX_RUNTIME = MAX_RUNTIME_DEFAULT // in milliseconds

// Configure signal handling
process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)
function handleSignal() {
  if (gracefulShutdownInitiated) return
  gracefulShutdownInitiated = true
  logger.warn(
    { gracefulShutdownInitiated },
    'graceful shutdown initiated, draining queue'
  )
}

// Check if max runtime has been exceeded
function hasMaxRuntimeExceeded() {
  if (MAX_RUNTIME === null) return false
  const elapsedTime = Date.now() - SCRIPT_START_TIME
  const hasExceeded = elapsedTime >= MAX_RUNTIME
  if (hasExceeded && !gracefulShutdownInitiated) {
    gracefulShutdownInitiated = true
    logger.warn(
      { elapsedTimeMs: elapsedTime, maxRuntimeMs: MAX_RUNTIME },
      'maximum runtime exceeded, initiating graceful shutdown'
    )
  }
  return hasExceeded
}

// Calculates the age in days since the provided lastOpened date.
function getAgeFromLastOpened(lastOpened) {
  const lastOpenedDate = new Date(lastOpened)
  const now = new Date()
  return Number(((now - lastOpenedDate) / (1000 * 60 * 60 * 24)).toFixed(2))
}

// Deactivates a single project and handles errors
async function deactivateSingleProject(project) {
  const { _id: projectId, lastOpened } = project
  jobCount++

  if (lastOpened) {
    currentLastOpened = lastOpened
    currentAgeInDays = getAgeFromLastOpened(lastOpened)
  }

  // Periodic progress logging
  if (jobCount % 1000 === 0) {
    logger.info(
      { jobCount, failedCount, currentAgeInDays },
      'project deactivation in progress'
    )
  }

  // Debug level detail logging
  logger.debug(
    { projectId, jobCount, failedCount, dryRun: DRY_RUN },
    'attempting to deactivate project'
  )

  // Dry run handling
  if (DRY_RUN) {
    logger.info({ projectId }, '[DRY RUN] would deactivate project')
    succeededCount++
  }

  // Actual deactivation with error handling
  try {
    await InactiveProjectManager.promises.deactivateProject(projectId)
    logger.debug({ projectId }, 'successfully deactivated project')
    succeededCount++
  } catch (error) {
    failedCount++
    logger.error({ projectId, err: error }, 'failed to deactivate project')
  }
}

// Centralized project processing function
async function processProjects(projectCursor, concurrency) {
  const queue = new PQueue({ concurrency })
  for await (const project of projectCursor) {
    if (gracefulShutdownInitiated || hasMaxRuntimeExceeded()) {
      skippedCount++
      break
    }
    await queue.onEmpty()
    logger.debug(
      { queueSize: queue.size, queuePending: queue.pending },
      'queue size before adding new job'
    )
    queue.add(async () => {
      await deactivateSingleProject(project)
    })
  }
  await queue.onIdle()
}

const usage = `
Usage: scripts/deactivate_projects.mjs [options]

Options:
  --limit <number>        Max number of projects to process (default: 10)
  --daysOld <number>      Min age in days for a project to be considered inactive (default: 7)
  --concurrency <number>  Number of deactivations to run in parallel (default: 1)
  --max-time <number>     Maximum runtime in seconds before graceful shutdown (default: no limit)
  --dry-run, -n           Simulate deactivation without making changes (default: false)
  --help                  Display this usage message
`

async function main() {
  const argv = minimist(process.argv.slice(2), {
    string: ['limit', 'daysOld', 'concurrency', 'maxTime'],
    boolean: ['dryRun', 'help'],
    alias: {
      dryRun: ['dry-run', 'n'],
      maxTime: 'max-time',
      help: 'h',
    },
    default: {
      limit: '10',
      daysOld: '7',
      concurrency: '1',
      maxTime: '',
      dryRun: false,
    },
  })

  if (argv.help || process.argv.length <= 2) {
    console.log(usage)
    process.exit(0)
  }

  const limit = parseInt(argv.limit, 10)
  const daysOld = parseInt(argv.daysOld, 10)
  const concurrency = parseInt(argv.concurrency, 10)
  const maxRuntimeInSeconds = parseInt(argv.maxTime, 10)
  DRY_RUN = argv.dryRun
  MAX_RUNTIME = maxRuntimeInSeconds * 1000 // Convert seconds to milliseconds

  if (DRY_RUN) {
    logger.info(
      {},
      'DRY RUN MODE ENABLED: No actual deactivations will be performed'
    )
  }

  logger.info(
    {
      limit,
      daysOld,
      concurrency,
      dryRun: DRY_RUN,
      maxRuntimeSeconds: maxRuntimeInSeconds || 'unlimited',
    },
    'finding inactive projects'
  )

  try {
    // Find projects to deactivate
    const projectCursor = await InactiveProjectManager.findInactiveProjects(
      limit,
      daysOld
    )

    // Process the projects
    await processProjects(projectCursor, concurrency)
  } catch (error) {
    logger.error({ err: error }, 'critical error during script execution')
    process.exitCode = 1
  } finally {
    logger.info(
      {
        jobCount,
        succeededCount,
        failedCount,
        skippedCount,
        currentAgeInDays,
        currentLastOpened,
        elapsedTimeInSeconds: Math.floor(
          (Date.now() - SCRIPT_START_TIME) / 1000
        ),
        maxRuntimeInSeconds: maxRuntimeInSeconds || 'unlimited',
      },
      'project deactivation process completed'
    )
  }
}

main()
  .then(async () => {
    await gracefulShutdown()
  })
  .catch(err => {
    logger.fatal({ err }, 'unhandled error in main execution')
    process.exit(1)
  })
