const Features = require('./Features')
const Queues = require('./Queues')
const UserOnboardingEmailManager = require('../Features/User/UserOnboardingEmailManager')
const UserPostRegistrationAnalyticsManager = require('../Features/User/UserPostRegistrationAnalyticsManager')

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
}

module.exports = { start }
