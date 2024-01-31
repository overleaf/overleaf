const EmailHandler = require('../Email/EmailHandler')
const UserGetter = require('../User/UserGetter')
require('./SubscriptionEmailBuilder')
const PlansLocator = require('./PlansLocator')
const Settings = require('@overleaf/settings')

const SubscriptionEmailHandler = {
  async sendTrialOnboardingEmail(userId, planCode) {
    const user = await UserGetter.promises.getUser(userId, {
      email: 1,
    })

    const plan = PlansLocator.findLocalPlanInSettings(planCode)
    if (!plan) {
      throw new Error('unknown paid plan: ' + planCode)
    }
    if (Settings.enableOnboardingEmails) {
      const emailOptions = {
        to: user.email,
        sendingUser_id: userId,
        planName: plan.name,
        features: plan.features,
      }
      await EmailHandler.promises.sendEmail('trialOnboarding', emailOptions)
    }
  },
}

module.exports = SubscriptionEmailHandler
