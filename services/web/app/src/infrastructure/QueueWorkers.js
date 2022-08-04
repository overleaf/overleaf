const Features = require('./Features')
const Queues = require('./Queues')
const UserOnboardingEmailManager = require('../Features/User/UserOnboardingEmailManager')
const UserPostRegistrationAnalyticsManager = require('../Features/User/UserPostRegistrationAnalyticsManager')
const FeaturesUpdater = require('../Features/Subscription/FeaturesUpdater')
const {
  addOptionalCleanupHandlerBeforeStoppingTraffic,
  addRequiredCleanupHandlerBeforeDrainingConnections,
} = require('./GracefulShutdown')

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
