const Queue = require('bull')
const Settings = require('settings-sharelatex')

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

module.exports = {
  analytics: {
    events: createQueue('analytics-events'),
    editingSessions: createQueue('analytics-editing-sessions')
  }
}
