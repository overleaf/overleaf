const Queue = require('bull')
const Settings = require('settings-sharelatex')

const analyticsQueues = {}

// Bull will keep a fixed number of the most recently completed jobs. This is
// useful to inspect recently completed jobs. The bull prometheus exporter also
// uses the completed job records to report on job duration.
const MAX_COMPLETED_JOBS_RETAINED = 10000
const MAX_FAILED_JOBS_RETAINED = 50000

function initialize() {
  if (Settings.analytics.enabled) {
    analyticsQueues.events = createQueue('analytics-events')
    analyticsQueues.editingSessions = createQueue('analytics-editing-sessions')
  }
}

function createQueue(queueName, defaultJobOptions) {
  return new Queue(queueName, {
    redis: Settings.redis.queues,
    defaultJobOptions: {
      removeOnComplete: MAX_COMPLETED_JOBS_RETAINED,
      removeOnFail: MAX_FAILED_JOBS_RETAINED,
      attempts: 11,
      backoff: {
        type: 'exponential',
        delay: 3000
      }
    }
  })
}

module.exports = { initialize, analytics: analyticsQueues }
