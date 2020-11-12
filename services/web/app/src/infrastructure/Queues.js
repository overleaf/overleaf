const Queue = require('bull')
const Settings = require('settings-sharelatex')

const analyticsQueues = {}

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
      removeOnComplete: true,
      attempts: 11,
      backoff: {
        type: 'exponential',
        delay: 3000
      }
    }
  })
}

module.exports = { initialize, analytics: analyticsQueues }
