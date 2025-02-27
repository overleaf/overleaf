import Queue from 'bull'
import config from 'config'
import commandLineArgs from 'command-line-args'
import logger from '@overleaf/logger'

logger.initialize('backup-queue')

// Use the same redis config as backup_worker
const redisOptions = config.get('redis.queue')

// Create a Bull queue named 'backup'
const backupQueue = new Queue('backup', {
  redis: redisOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: true,
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
]

// Parse command line arguments
const options = commandLineArgs(optionDefinitions)

// Helper to validate date format
function isValidDateFormat(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
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
  const job = await backupQueue.add(
    { startDate, endDate },
    { jobId: `backup-${startDate}-to-${endDate}` }
  )
  console.log(
    `Added date range backup job: ${startDate} to ${endDate}, job ID: ${job.id}`
  )
}

// Main execution block
async function run() {
  const optionCount = [
    options.clean,
    options.status,
    options.add,
    options.monitor,
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
        const job = await backupQueue.add(
          { projectId: input },
          { jobId: input }
        )
        console.log(`Added job for project: ${input}, job ID: ${job.id}`)
      }
    }
  } else if (options.monitor) {
    setupMonitoring()
  } else {
    console.log('Usage:')
    console.log('  --clean   Clean up completed and failed jobs')
    console.log('  --status  Show current job counts')
    console.log('  --add [projectId] Add a job for the specified projectId')
    console.log(
      '  --add [YYYY-MM-DD:YYYY-MM-DD] Add a job for the specified date range'
    )
    console.log('  --monitor Monitor queue events')
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
