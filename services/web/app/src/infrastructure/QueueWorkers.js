const Features = require('./Features')
const Queues = require('./Queues')
const UserOnboardingEmailManager = require('../Features/User/UserOnboardingEmailManager')
const UserPostRegistrationAnalyticsManager = require('../Features/User/UserPostRegistrationAnalyticsManager')
const FeaturesUpdater = require('../Features/Subscription/FeaturesUpdater')
const InstitutionsManager = require('../Features/Institutions/InstitutionsManager')
const {
  addOptionalCleanupHandlerBeforeStoppingTraffic,
  addRequiredCleanupHandlerBeforeDrainingConnections,
} = require('./GracefulShutdown')
const EmailHandler = require('../Features/Email/EmailHandler')
const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')
const Modules = require('./Modules')

function start() {
  if (!Features.hasFeature('saas')) {
    return
  }

  const scheduledJobsQueue = Queues.getQueue('scheduled-jobs')
  scheduledJobsQueue.process(async job => {
    const { queueName, name, data, options } = job.data
    const queue = Queues.getQueue(queueName)
    if (name) {
      await queue.add(name, data || {}, options || {})
    } else {
      await queue.add(data || {}, options || {})
    }
  })
  registerCleanup(scheduledJobsQueue)

  const onboardingEmailsQueue = Queues.getQueue('emails-onboarding')
  onboardingEmailsQueue.process(async job => {
    const { userId } = job.data
    await UserOnboardingEmailManager.sendOnboardingEmail(userId)
  })
  registerCleanup(onboardingEmailsQueue)

  const postRegistrationAnalyticsQueue = Queues.getQueue(
    'post-registration-analytics'
  )
  postRegistrationAnalyticsQueue.process(async job => {
    const { userId } = job.data
    await UserPostRegistrationAnalyticsManager.postRegistrationAnalytics(userId)
  })
  registerCleanup(postRegistrationAnalyticsQueue)

  const refreshFeaturesQueue = Queues.getQueue('refresh-features')
  refreshFeaturesQueue.process(async job => {
    const { userId, reason } = job.data
    await FeaturesUpdater.promises.refreshFeatures(userId, reason)
  })
  registerCleanup(refreshFeaturesQueue)

  const deferredEmailsQueue = Queues.getQueue('deferred-emails')
  deferredEmailsQueue.process(async job => {
    const { emailType, opts } = job.data
    try {
      await EmailHandler.promises.sendEmail(emailType, opts)
    } catch (e) {
      const error = OError.tag(e, 'failed to send deferred email')
      logger.warn(error)
      throw error
    }
  })
  registerCleanup(deferredEmailsQueue)

  const confirmInstitutionDomainQueue = Queues.getQueue(
    'confirm-institution-domain'
  )
  confirmInstitutionDomainQueue.process(async job => {
    const { hostname } = job.data
    try {
      await InstitutionsManager.promises.affiliateUsers(hostname)
    } catch (e) {
      const error = OError.tag(e, 'failed to confirm university domain')
      logger.warn(error)
      throw error
    }
  })
  registerCleanup(confirmInstitutionDomainQueue)

  const groupSSOReminderQueue = Queues.getQueue('group-sso-reminder')
  groupSSOReminderQueue.process(async job => {
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
      logger.warn(error)
      throw error
    }
  })
  registerCleanup(groupSSOReminderQueue)
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

module.exports = { start }
