const Queue = require('bull')
const Settings = require('settings-sharelatex')

// Bull will keep a fixed number of the most recently completed jobs. This is
// useful to inspect recently completed jobs. The bull prometheus exporter also
// uses the completed job records to report on job duration.
const MAX_COMPLETED_JOBS_RETAINED = 10000
const MAX_FAILED_JOBS_RETAINED = 50000

const queues = {}

function getAnalyticsEventsQueue() {
  if (Settings.analytics.enabled) {
    return getOrCreateQueue('analytics-events')
  }
}

function getAnalyticsEditingSessionsQueue() {
  if (Settings.analytics.enabled) {
    return getOrCreateQueue('analytics-editing-sessions')
  }
}

function getOnboardingEmailsQueue() {
  return getOrCreateQueue('emails-onboarding')
}

function getOrCreateQueue(queueName, defaultJobOptions) {
  if (!queues[queueName]) {
    queues[queueName] = new Queue(queueName, {
      redis: Settings.redis.queues,
      defaultJobOptions: {
        removeOnComplete: MAX_COMPLETED_JOBS_RETAINED,
        removeOnFail: MAX_FAILED_JOBS_RETAINED,
        attempts: 11,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    })
  }
  return queues[queueName]
}

module.exports = {
  getAnalyticsEventsQueue,
  getAnalyticsEditingSessionsQueue,
  getOnboardingEmailsQueue,
}
