const Features = require('./Features')
const Queues = require('./Queues')
const UserOnboardingEmailManager = require('../Features/User/UserOnboardingEmailManager')
const UserPostRegistrationAnalyticsManager = require('../Features/User/UserPostRegistrationAnalyticsManager')
const FeaturesUpdater = require('../Features/Subscription/FeaturesUpdater')
const {
  addOptionalCleanupHandlerBeforeStoppingTraffic,
  addRequiredCleanupHandlerBeforeDrainingConnections,
} = require('./GracefulShutdown')
const EmailHandler = require('../Features/Email/EmailHandler')
const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')
const Modules = require('./Modules')

/**
 * @typedef {{
 *   data: {queueName: string,name?: string,data?: any},
 * }} BullJob
 */

/**
 * @param {string} queueName
 * @param {(job: BullJob) => Promise<void>} handler
 */
function registerQueue(queueName, handler) {
  if (process.env.QUEUE_PROCESSING_ENABLED === 'true') {
    const queue = Queues.getQueue(queueName)
    queue.process(handler)
    registerCleanup(queue)
  }
}

function start() {
  if (!Features.hasFeature('saas')) {
    return
  }

  registerQueue('scheduled-jobs', async job => {
    const { queueName, name, data, options } = job.data
    const queue = Queues.getQueue(queueName)
    if (name) {
      await queue.add(name, data || {}, options || {})
    } else {
      await queue.add(data || {}, options || {})
    }
  })

  registerQueue('emails-onboarding', async job => {
    const { userId } = job.data
    await UserOnboardingEmailManager.sendOnboardingEmail(userId)
  })

  registerQueue('post-registration-analytics', async job => {
    const { userId } = job.data
    await UserPostRegistrationAnalyticsManager.postRegistrationAnalytics(userId)
  })

  registerQueue('refresh-features', async job => {
    const { userId, reason } = job.data
    await FeaturesUpdater.promises.refreshFeatures(userId, reason)
  })

  registerQueue('deferred-emails', async job => {
    const { emailType, opts } = job.data
    try {
      await EmailHandler.promises.sendEmail(emailType, opts)
    } catch (e) {
      const error = OError.tag(e, 'failed to send deferred email')
      logger.warn({ error, emailType }, error.message)
      throw error
    }
  })

  registerQueue('group-sso-reminder', async job => {
    const { userId, subscriptionId } = job.data
    try {
      await Modules.promises.hooks.fire(
        'sendGroupSSOReminder',
        userId,
        subscriptionId
      )
    } catch (e) {
      const error = OError.tag(
        e,
        'failed to send scheduled Group SSO account linking reminder'
      )
      logger.warn({ error, userId, subscriptionId }, error.message)
      throw error
    }
  })
}

function registerCleanup(queue) {
  const label = `bull queue ${queue.name}`

  // Stop accepting new jobs.
  addOptionalCleanupHandlerBeforeStoppingTraffic(label, async () => {
    const justThisWorker = true
    await queue.pause(justThisWorker)
  })

  // Wait for all jobs to process before shutting down connections.
  addRequiredCleanupHandlerBeforeDrainingConnections(label, async () => {
    await queue.close()
  })

  // Disconnect from redis is scheduled in queue setup.
}

module.exports = { start, registerQueue }
