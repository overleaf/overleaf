import Queue from 'bull'
import logger from '@overleaf/logger'
import config from 'config'
import metrics from '@overleaf/metrics'

const CONCURRENCY = 10
const redisOptions = config.get('redis.queue')
const TIME_BUCKETS = [10, 100, 500, 1000, 5000, 10000, 30000, 60000]

// Create a Bull queue named 'backup'
const backupQueue = new Queue('backup', {
  redis: redisOptions,
})

// Log queue events
backupQueue.on('active', job => {
  logger.info({ job }, 'job  is now active')
})

backupQueue.on('completed', (job, result) => {
  metrics.inc('backup_worker_job', 1, { status: 'completed' })
  logger.info({ job, result }, 'job completed')
})

backupQueue.on('failed', (job, err) => {
  metrics.inc('backup_worker_job', 1, { status: 'failed' })
  logger.error({ job, err }, 'job failed')
})

backupQueue.on('waiting', jobId => {
  logger.info({ jobId }, 'job is waiting')
})

backupQueue.on('error', error => {
  logger.error({ error }, 'queue error')
})

// Process jobs
backupQueue.process(CONCURRENCY, async job => {
  const { projectId } = job.data
  const timer = new metrics.Timer(
    'backup_worker_job_duration',
    1,
    {},
    TIME_BUCKETS
  )
  logger.info({ projectId }, 'processing backup for project')
  await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000))
  timer.done()
  return `backup completed ${projectId}`
})

export async function drainQueue() {
  logger.info({ queue: backupQueue.name }, 'pausing queue')
  await backupQueue.pause(true) // pause this worker and wait for jobs to finish
  logger.info({ queue: backupQueue.name }, 'closing queue')
  await backupQueue.close()
}

export async function healthCheck() {
  const count = await backupQueue.count()
  metrics.gauge('backup_worker_queue_length', count)
}
