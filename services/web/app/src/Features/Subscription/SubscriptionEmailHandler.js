const EmailHandler = require('../Email/EmailHandler')
const UserGetter = require('../User/UserGetter')
require('./SubscriptionEmailBuilder')

const SubscriptionEmailHandler = {
  async sendTrialOnboardingEmail(userId) {
    const user = await UserGetter.promises.getUser(userId, {
      email: 1,
    })

    const emailOptions = {
      to: user.email,
      sendingUser_id: userId,
    }
    await EmailHandler.promises.sendEmail('trialOnboarding', emailOptions)
  },
}

module.exports = SubscriptionEmailHandler
