const Queue = require('bull')
const Settings = require('@overleaf/settings')

// Bull will keep a fixed number of the most recently completed jobs. This is
// useful to inspect recently completed jobs. The bull prometheus exporter also
// uses the completed job records to report on job duration.
const MAX_COMPLETED_JOBS_RETAINED = 10000
const MAX_FAILED_JOBS_RETAINED = 50000

const QUEUES_JOB_OPTIONS = {
  'analytics-events': {},
  'analytics-editing-sessions': {},
  'analytics-user-properties': {},
  'refresh-features': {
    attempts: 3,
  },
  'emails-onboarding': {},
  'post-registration-analytics': {},
  'scheduled-jobs': {
    attempts: 1,
  },
}

const queues = {}

function getQueue(queueName) {
  if (!queues[queueName]) {
    const jobOptions = QUEUES_JOB_OPTIONS[queueName] || {}
    queues[queueName] = new Queue(queueName, {
      // this configuration is duplicated in /services/analytics/app/js/Queues.js
      // and needs to be manually kept in sync whenever modified
      redis: Settings.redis.queues,
      defaultJobOptions: {
        removeOnComplete: MAX_COMPLETED_JOBS_RETAINED,
        removeOnFail: MAX_FAILED_JOBS_RETAINED,
        attempts: 11,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        ...jobOptions,
      },
    })
  }
  return queues[queueName]
}

async function createScheduledJob(queueName, { name, data, options }, delay) {
  await getQueue('scheduled-jobs').add(
    { queueName, name, data, options },
    {
      delay,
    }
  )
}

module.exports = {
  getQueue,
  createScheduledJob,
}
