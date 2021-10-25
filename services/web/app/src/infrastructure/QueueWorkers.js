const Features = require('./Features')
const Queues = require('./Queues')
const UserOnboardingEmailManager = require('../Features/User/UserOnboardingEmailManager')
const UserPostRegistrationAnalyticsManager = require('../Features/User/UserPostRegistrationAnalyticsManager')
const FeaturesUpdater = require('../Features/Subscription/FeaturesUpdater')

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

  const onboardingEmailsQueue = Queues.getQueue('emails-onboarding')
  onboardingEmailsQueue.process(async job => {
    const { userId } = job.data
    await UserOnboardingEmailManager.sendOnboardingEmail(userId)
  })

  const postRegistrationAnalyticsQueue = Queues.getQueue(
    'post-registration-analytics'
  )
  postRegistrationAnalyticsQueue.process(async job => {
    const { userId } = job.data
    await UserPostRegistrationAnalyticsManager.postRegistrationAnalytics(userId)
  })

  const refreshFeaturesQueue = Queues.getQueue('refresh-features')
  refreshFeaturesQueue.process(async job => {
    const { userId, reason } = job.data
    await FeaturesUpdater.promises.refreshFeatures(userId, reason)
  })
}

module.exports = { start }
