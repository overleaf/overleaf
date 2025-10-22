import EmailHandler from '../Email/EmailHandler.mjs'
import UserGetter from '../User/UserGetter.mjs'
import './SubscriptionEmailBuilder.mjs'
import PlansLocator from './PlansLocator.mjs'
import Settings from '@overleaf/settings'

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

export default SubscriptionEmailHandler
