import Queue from 'bull'
import Settings from '@overleaf/settings'
import Features from '../infrastructure/Features.mjs'
import { addConnectionDrainer } from './GracefulShutdown.mjs'

// Bull will keep a fixed number of the most recently completed jobs. This is
// useful to inspect recently completed jobs. The bull prometheus exporter also
// uses the completed job records to report on job duration.
const MAX_COMPLETED_JOBS_RETAINED = 10000
const MAX_FAILED_JOBS_RETAINED = 50000
const MAX_FAILED_JOBS_RETAINED_ANALYTICS = 3000000

const QUEUES_JOB_OPTIONS = {
  'analytics-events': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED_ANALYTICS,
  },
  'analytics-editing-sessions': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED_ANALYTICS,
  },
  'analytics-account-mapping': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED_ANALYTICS,
  },
  'analytics-user-properties': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED_ANALYTICS,
  },
  'refresh-features': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED,
    attempts: 3,
  },
  'analytics-email-change': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED_ANALYTICS,
  },
  'analytics-package-usage': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED_ANALYTICS,
  },
  'emails-onboarding': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED,
  },
  'post-registration-analytics': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED_ANALYTICS,
  },
  'scheduled-jobs': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED,
    attempts: 1,
  },
  'confirm-institution-domain': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED,
    attempts: 3,
  },

  'group-sso-reminder': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED,
    attempts: 3,
  },
  'deferred-subscription-webhook-event': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED,
    attempts: 3,
  },
  'project-notification': {
    removeOnFail: MAX_FAILED_JOBS_RETAINED,
    attempts: 3,
  },
}

const QUEUE_OPTIONS = {
  'confirm-institution-domain': {
    limiter: {
      max: 1,
      duration: 60 * 1000,
    },
  },
}

const ANALYTICS_QUEUES = [
  'analytics-account-mapping',
  'analytics-email-change',
  'analytics-events',
  'analytics-editing-sessions',
  'analytics-package-usage',
  'analytics-user-properties',
  'analytics-user-exports',
  'post-registration-analytics',
]

const queues = {}

function getQueue(queueName) {
  if (!Features.hasFeature('saas')) {
    // Disable bull queue handling for Server Pro/CE by providing a stub interface.
    return {
      async add() {},
      process() {},
    }
  }

  if (!queues[queueName]) {
    const redisOptions = ANALYTICS_QUEUES.includes(queueName)
      ? Settings.redis.analyticsQueues
      : Settings.redis.queues
    const queueOptions = QUEUE_OPTIONS[queueName] || {}
    const jobOptions = QUEUES_JOB_OPTIONS[queueName] || {}
    queues[queueName] = new Queue(queueName, {
      // this configuration is duplicated in /services/analytics/app/js/Queues.js
      // and needs to be manually kept in sync whenever modified
      redis: redisOptions,
      ...queueOptions,
      defaultJobOptions: {
        removeOnComplete: MAX_COMPLETED_JOBS_RETAINED,
        attempts: 11,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        ...jobOptions,
      },
    })

    // Disconnect from redis eventually.
    addConnectionDrainer(`bull queue ${queueName}`, async () => {
      await queues[queueName].disconnect()
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

export default {
  getQueue,
  createScheduledJob,
}
