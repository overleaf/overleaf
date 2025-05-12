import Queue from 'bull'
import config from 'config'
import commandLineArgs from 'command-line-args'
import logger from '@overleaf/logger'
import {
  listPendingBackups,
  listUninitializedBackups,
  getBackupStatus,
} from '../lib/backup_store/index.js'

logger.initialize('backup-queue')

// Use the same redis config as backup_worker
const redisOptions = config.get('redis.queue')

// Create a Bull queue named 'backup'
const backupQueue = new Queue('backup', {
  redis: redisOptions,
  defaultJobOptions: {
    removeOnComplete: { age: 60 }, // keep completed jobs for 60 seconds
    removeOnFail: { age: 7 * 24 * 3600, count: 1000 }, // keep failed jobs for 7 days, max 1000
  },
})

// Define command-line options
const optionDefinitions = [
  { name: 'clean', type: Boolean },
  { name: 'status', type: Boolean },
  {
    name: 'add',
    type: String,
    multiple: true,
    description: 'Project IDs or date range in YYYY-MM-DD:YYYY-MM-DD format',
  },
  { name: 'monitor', type: Boolean },
  {
    name: 'queue-pending',
    type: Number,
    description:
      'Find projects with pending changes older than N seconds and add them to the queue',
  },
  {
    name: 'show-pending',
    type: Number,
    description:
      'Show count of pending projects older than N seconds without adding to queue',
  },
  {
    name: 'limit',
    type: Number,
    description: 'Limit the number of jobs to be added',
  },
  {
    name: 'interval',
    type: Number,
    description: 'Time in seconds to spread jobs over (default: 300)',
    defaultValue: 300,
  },
  {
    name: 'backoff-delay',
    type: Number,
    description:
      'Backoff delay in milliseconds for failed jobs (default: 1000)',
    defaultValue: 1000,
  },
  {
    name: 'attempts',
    type: Number,
    description: 'Number of retry attempts for failed jobs (default: 3)',
    defaultValue: 3,
  },
  {
    name: 'warn-threshold',
    type: Number,
    description: 'Warn about any project exceeding this pending age',
    defaultValue: 2 * 3600, // 2 hours
  },
  {
    name: 'verbose',
    alias: 'v',
    type: Boolean,
    description: 'Show detailed information when used with --show-pending',
  },
]

// Parse command line arguments
const options = commandLineArgs(optionDefinitions)
const WARN_THRESHOLD = options['warn-threshold']

// Helper to validate date format
function isValidDateFormat(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
}

// Helper to validate the pending time parameter
function validatePendingTime(option, value) {
  if (typeof value !== 'number' || value <= 0) {
    console.error(
      `Error: --${option} requires a positive numeric TIME argument in seconds`
    )
    console.error(`Example: --${option} 3600`)
    process.exit(1)
  }
  return value
}

// Helper to format the pending time display
function formatPendingTime(timestamp) {
  const now = new Date()
  const diffMs = now - timestamp
  const seconds = Math.floor(diffMs / 1000)
  return `${timestamp.toISOString()} (${seconds} seconds ago)`
}

// Helper to add a job to the queue, checking for duplicates
async function addJobWithCheck(queue, data, options) {
  const jobId = options.jobId

  // Check if the job already exists
  const existingJob = await queue.getJob(jobId)

  if (existingJob) {
    return { job: existingJob, added: false }
  } else {
    const job = await queue.add(data, options)
    return { job, added: true }
  }
}

// Setup queue event listeners
function setupMonitoring() {
  console.log('Starting queue monitoring. Press Ctrl+C to exit.')

  backupQueue.on('global:error', error => {
    logger.info({ error }, 'Queue error')
  })

  backupQueue.on('global:waiting', jobId => {
    logger.info({ jobId }, 'job is waiting')
  })

  backupQueue.on('global:active', jobId => {
    logger.info({ jobId }, 'job is now active')
  })

  backupQueue.on('global:stalled', jobId => {
    logger.info({ jobId }, 'job has stalled')
  })

  backupQueue.on('global:progress', (jobId, progress) => {
    logger.info({ jobId, progress }, 'job progress')
  })

  backupQueue.on('global:completed', (jobId, result) => {
    logger.info({ jobId, result }, 'job completed')
  })

  backupQueue.on('global:failed', (jobId, err) => {
    logger.info({ jobId, err }, 'job failed')
  })

  backupQueue.on('global:paused', () => {
    logger.info({}, 'Queue paused')
  })

  backupQueue.on('global:resumed', () => {
    logger.info({}, 'Queue resumed')
  })

  backupQueue.on('global:cleaned', (jobs, type) => {
    logger.info({ jobsCount: jobs.length, type }, 'Jobs cleaned')
  })

  backupQueue.on('global:drained', () => {
    logger.info({}, 'Queue drained')
  })

  backupQueue.on('global:removed', jobId => {
    logger.info({ jobId }, 'Job removed')
  })
}

async function addDateRangeJob(input) {
  const [startDate, endDate] = input.split(':')
  if (!isValidDateFormat(startDate) || !isValidDateFormat(endDate)) {
    console.error(
      `Invalid date format for "${input}". Use YYYY-MM-DD:YYYY-MM-DD`
    )
    return
  }

  const jobId = `backup-${startDate}-to-${endDate}`
  const { job, added } = await addJobWithCheck(
    backupQueue,
    { startDate, endDate },
    { jobId }
  )

  console.log(
    `${added ? 'Added' : 'Already exists'}: date range backup job: ${startDate} to ${endDate}, job ID: ${job.id}`
  )
}

// Helper to list pending and uninitialized backups
// This function combines the two cursors into a single generator
// to yield projects from both lists
async function* pendingCursor(timeIntervalMs, limit) {
  for await (const project of listPendingBackups(timeIntervalMs, limit)) {
    yield project
  }
  for await (const project of listUninitializedBackups(timeIntervalMs, limit)) {
    yield project
  }
}

// Process pending projects with changes older than the specified seconds
async function processPendingProjects(
  age,
  showOnly,
  limit,
  verbose,
  jobInterval,
  jobOpts = {}
) {
  const timeIntervalMs = age * 1000
  console.log(
    `Finding projects with pending changes older than ${age} seconds${showOnly ? ' (count only)' : ''}`
  )

  let count = 0
  let addedCount = 0
  let existingCount = 0
  // Pass the limit directly to MongoDB query for better performance
  const changeTimes = []
  for await (const project of pendingCursor(timeIntervalMs, limit)) {
    const projectId = project._id.toHexString()
    const pendingAt =
      project.overleaf?.backup?.pendingChangeAt || project._id.getTimestamp()
    if (pendingAt) {
      changeTimes.push(pendingAt)
      const pendingAge = Math.floor((Date.now() - pendingAt.getTime()) / 1000)
      if (pendingAge > WARN_THRESHOLD) {
        try {
          const backupStatus = await getBackupStatus(projectId)
          logger.warn(
            {
              projectId,
              pendingAt,
              pendingAge,
              backupStatus,
              warnThreshold: WARN_THRESHOLD,
            },
            `pending change exceeds rpo warning threshold`
          )
        } catch (err) {
          logger.error(
            { projectId, pendingAt, pendingAge },
            'Error getting backup status'
          )
          throw err
        }
      }
    }
    if (showOnly && verbose) {
      console.log(
        `Project: ${projectId} (pending since: ${formatPendingTime(pendingAt)})`
      )
    } else if (!showOnly) {
      const delay = Math.floor(Math.random() * jobInterval * 1000) // add random delay to avoid all jobs running simultaneously
      const { job, added } = await addJobWithCheck(
        backupQueue,
        { projectId, pendingChangeAt: pendingAt.getTime() },
        { ...jobOpts, delay, jobId: projectId }
      )

      if (added) {
        if (verbose) {
          console.log(
            `Added job for project: ${projectId}, job ID: ${job.id} (pending since: ${formatPendingTime(pendingAt)})`
          )
        }
        addedCount++
      } else {
        if (verbose) {
          console.log(
            `Job already exists for project: ${projectId}, job ID: ${job.id} (pending since: ${formatPendingTime(pendingAt)})`
          )
        }
        existingCount++
      }
    }

    count++
    if (count % 1000 === 0) {
      console.log(
        `Processed ${count} projects`,
        showOnly ? '' : `(${addedCount} added, ${existingCount} existing)`
      )
    }
  }
  // Set oldestChange to undefined if there are no changes
  const oldestChange =
    changeTimes.length > 0
      ? changeTimes.reduce((min, time) => (time < min ? time : min))
      : undefined

  if (showOnly) {
    console.log(
      `Found ${count} projects with pending changes (not added to queue)`
    )
  } else {
    console.log(`Found ${count} projects with pending changes:`)
    console.log(`  ${addedCount} jobs added to queue`)
    console.log(`  ${existingCount} jobs already existed in queue`)
    if (oldestChange) {
      console.log(`  Oldest pending change: ${formatPendingTime(oldestChange)}`)
    }
  }
}

// Main execution block
async function run() {
  const optionCount = [
    options.clean,
    options.status,
    options.add,
    options.monitor,
    options['queue-pending'] !== undefined,
    options['show-pending'] !== undefined,
  ].filter(Boolean).length
  if (optionCount > 1) {
    console.error('Only one option can be specified')
    process.exit(1)
  }

  if (options.clean) {
    const beforeCounts = await backupQueue.getJobCounts()
    console.log('Current queue state:', JSON.stringify(beforeCounts))
    console.log('Cleaning completed and failed jobs...')
    await backupQueue.clean(1, 'completed')
    await backupQueue.clean(1, 'failed')
    const afterCounts = await backupQueue.getJobCounts()
    console.log('Current queue state:', JSON.stringify(afterCounts))
    console.log('Queue cleaned successfully')
  } else if (options.status) {
    const counts = await backupQueue.getJobCounts()
    console.log('Current queue state:', JSON.stringify(counts))
  } else if (options.add) {
    const inputs = Array.isArray(options.add) ? options.add : [options.add]
    for (const input of inputs) {
      if (input.includes(':')) {
        // Handle date range format
        await addDateRangeJob(input)
      } else {
        // Handle project ID format
        const { job, added } = await addJobWithCheck(
          backupQueue,
          { projectId: input },
          { jobId: input }
        )
        console.log(
          `${added ? 'Added' : 'Already exists'}: job for project: ${input}, job ID: ${job.id}`
        )
      }
    }
  } else if (options.monitor) {
    setupMonitoring()
  } else if (options['queue-pending'] !== undefined) {
    const age = validatePendingTime('queue-pending', options['queue-pending'])
    await processPendingProjects(
      age,
      false,
      options.limit,
      options.verbose,
      options.interval,
      {
        attempts: options.attempts,
        backoff: {
          type: 'exponential',
          delay: options['backoff-delay'],
        },
      }
    )
  } else if (options['show-pending'] !== undefined) {
    const age = validatePendingTime('show-pending', options['show-pending'])
    await processPendingProjects(age, true, options.limit, options.verbose)
  } else {
    console.log('Usage:')
    console.log('  --clean               Clean up completed and failed jobs')
    console.log('  --status              Show current job counts')
    console.log('  --add [projectId]     Add a job for the specified projectId')
    console.log(
      '  --add [YYYY-MM-DD:YYYY-MM-DD] Add a job for the specified date range'
    )
    console.log('  --monitor             Monitor queue events')
    console.log(
      '  --queue-pending TIME  Find projects with changes older than TIME seconds and add them to the queue'
    )
    console.log(
      '  --show-pending TIME   Show count of pending projects older than TIME seconds'
    )
    console.log('  --limit N             Limit the number of jobs to be added')
    console.log(
      '  --interval TIME       Time interval in seconds to spread jobs over'
    )
    console.log(
      '  --backoff-delay TIME  Backoff delay in milliseconds for failed jobs (default: 1000)'
    )
    console.log(
      '  --attempts N          Number of retry attempts for failed jobs (default: 3)'
    )
    console.log(
      '  --verbose, -v         Show detailed information when used with --show-pending'
    )
  }
}

// Run and handle errors
run()
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
  .then(result => {
    // Only exit if not in monitor mode
    if (!options.monitor) {
      process.exit(0)
    }
  })
