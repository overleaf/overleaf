const Features = require('./Features')
const Queues = require('./Queues')
const UserOnboardingEmailManager = require('../Features/User/UserOnboardingEmailManager')
const UserPostRegistrationAnalyticsManager = require('../Features/User/UserPostRegistrationAnalyticsManager')
const FeaturesUpdater = require('../Features/Subscription/FeaturesUpdater')

function start() {
  if (!Features.hasFeature('saas')) {
    return
  }

  const onboardingEmailsQueue = Queues.getOnboardingEmailsQueue()
  onboardingEmailsQueue.process(async job => {
    const { userId } = job.data
    await UserOnboardingEmailManager.sendOnboardingEmail(userId)
  })

  const postRegistrationAnalyticsQueue = Queues.getPostRegistrationAnalyticsQueue()
  postRegistrationAnalyticsQueue.process(async job => {
    const { userId } = job.data
    await UserPostRegistrationAnalyticsManager.postRegistrationAnalytics(userId)
  })

  const refreshFeaturesQueue = Queues.getRefreshFeaturesQueue()
  refreshFeaturesQueue.process(async job => {
    const { userId, reason } = job.data
    await FeaturesUpdater.promises.refreshFeatures(userId, reason)
  })
}

module.exports = { start }
