import Queue from 'bull'
import logger from '@overleaf/logger'
import config from 'config'
import metrics from '@overleaf/metrics'
import {
  backupProject,
  initializeProjects,
  configureBackup,
  closeConnections,
} from './backup.mjs'

const JOB_CONCURRENCY = parseInt(process.env.JOB_CONCURRENCY, 10) || 15
const UPLOAD_CONCURRENCY = parseInt(process.env.UPLOAD_CONCURRENCY, 10) || 50
const WARN_THRESHOLD = 2 * 60 * 60 * 1000 // warn if projects are older than this
const redisOptions = config.get('redis.queue')
const JOB_TIME_BUCKETS = [10, 100, 500, 1000, 5000, 10000, 30000, 60000] // milliseconds
const LAG_TIME_BUCKETS_HRS = [
  0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2, 3, 4, 5, 6,
] // hours

// Configure backup settings to match worker concurrency
configureBackup({ concurrency: UPLOAD_CONCURRENCY, useSecondary: true })

let gracefulShutdownInitiated = false

process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

async function handleSignal() {
  if (!gracefulShutdownInitiated) {
    gracefulShutdownInitiated = true
    logger.info({}, 'graceful shutdown: stopping backup worker')
    await drainQueue()
  }
}

// Create a Bull queue named 'backup'
const backupQueue = new Queue('backup', {
  redis: redisOptions,
  settings: {
    lockDuration: 15 * 60 * 1000, // 15 minutes
    lockRenewTime: 60 * 1000, // 1 minute
    maxStalledCount: 1, // allow stalled jobs to retried
  },
})

// Log queue events
backupQueue.on('active', job => {
  logger.debug({ job }, 'job is now active')
})

backupQueue.on('completed', (job, result) => {
  metrics.inc('backup_worker_job', 1, { status: 'completed' })
  logger.debug({ job, result }, 'job completed')
})

backupQueue.on('failed', (job, err) => {
  metrics.inc('backup_worker_job', 1, { status: 'failed' })
  logger.error({ job, err }, 'job failed')
})

backupQueue.on('waiting', jobId => {
  logger.debug({ jobId }, 'job is waiting')
})

backupQueue.on('error', error => {
  logger.error({ error }, 'queue error')
})

backupQueue.on('stalled', job => {
  logger.error({ job }, 'job has stalled')
})

backupQueue.on('lock-extension-failed', (job, err) => {
  logger.error({ job, err }, 'lock extension failed')
})

backupQueue.on('paused', () => {
  logger.info({}, 'queue paused')
})

backupQueue.on('resumed', () => {
  logger.info({}, 'queue resumed')
})

// Process jobs
backupQueue.process(JOB_CONCURRENCY, async job => {
  const { projectId, startDate, endDate } = job.data

  if (projectId) {
    return await runBackup(projectId, job.data, job)
  } else if (startDate && endDate) {
    return await runInit(startDate, endDate)
  } else {
    throw new Error('invalid job data')
  }
})

async function runBackup(projectId, data, job) {
  const { pendingChangeAt } = data
  // record the time it takes to run the backup job
  const timer = new metrics.Timer(
    'backup_worker_job_duration',
    1,
    {},
    JOB_TIME_BUCKETS
  )
  const pendingAge = Date.now() - pendingChangeAt
  if (pendingAge > WARN_THRESHOLD) {
    logger.warn(
      { projectId, pendingAge, job },
      'project has been pending for a long time'
    )
  }
  try {
    logger.debug({ projectId }, 'processing backup for project')
    await backupProject(projectId, {})
    metrics.inc('backup_worker_project', 1, {
      status: 'success',
    })
    timer.done()
    // record the replication lag (time from change to backup)
    if (pendingChangeAt) {
      metrics.histogram(
        'backup_worker_replication_lag_in_hours',
        (Date.now() - pendingChangeAt) / (3600 * 1000),
        LAG_TIME_BUCKETS_HRS
      )
    }
    return `backup completed ${projectId}`
  } catch (err) {
    if (err.message === 'Project deleted') {
      metrics.inc('backup_worker_project', 1, { status: 'deleted' })
      logger.warn({ projectId, err }, 'skipping backup of deleted project')
    } else {
      metrics.inc('backup_worker_project', 1, { status: 'failed' })
      logger.error({ projectId, err }, 'backup failed')
      throw err // Re-throw to mark job as failed
    }
  }
}

async function runInit(startDate, endDate) {
  try {
    logger.info({ startDate, endDate }, 'initializing projects')
    await initializeProjects({ 'start-date': startDate, 'end-date': endDate })
    return `initialization completed ${startDate} - ${endDate}`
  } catch (err) {
    logger.error({ startDate, endDate, err }, 'initialization failed')
    throw err
  }
}

export async function drainQueue() {
  logger.info({ queue: backupQueue.name }, 'closing queue')
  await backupQueue.close()
  logger.info({ queue: backupQueue.name }, 'closing database connections')
  await closeConnections()
}

export async function healthCheck() {
  const count = await backupQueue.count()
  metrics.gauge('backup_worker_queue_length', count)
}
