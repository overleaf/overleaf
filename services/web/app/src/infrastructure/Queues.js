const Queue = require('bull')
const Settings = require('@overleaf/settings')

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

function getAnalyticsUserPropertiesQueue() {
  if (Settings.analytics.enabled) {
    return getOrCreateQueue('analytics-user-properties')
  }
}

function getRefreshFeaturesQueue() {
  return getOrCreateQueue('refresh-features', { attempts: 3 })
}

function getOnboardingEmailsQueue() {
  return getOrCreateQueue('emails-onboarding')
}

function getPostRegistrationAnalyticsQueue() {
  return getOrCreateQueue('post-registration-analytics')
}

function getOrCreateQueue(queueName, jobOptions = {}) {
  if (!queues[queueName]) {
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

module.exports = {
  getAnalyticsEventsQueue,
  getAnalyticsEditingSessionsQueue,
  getAnalyticsUserPropertiesQueue,
  getRefreshFeaturesQueue,
  getOnboardingEmailsQueue,
  getPostRegistrationAnalyticsQueue,
}
