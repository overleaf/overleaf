const Features = require('../../infrastructure/Features')
const Queues = require('../../infrastructure/Queues')
const EmailHandler = require('../Email/EmailHandler')
const UserUpdater = require('./UserUpdater')
const UserGetter = require('./UserGetter')

const ONE_DAY_MS = 24 * 60 * 60 * 1000

class UserOnboardingEmailManager {
  constructor() {
    this.queue = Queues.getOnboardingEmailsQueue()
    this.queue.process(async job => {
      const { userId } = job.data
      await this._sendOnboardingEmail(userId)
    })
  }

  async scheduleOnboardingEmail(user) {
    await this.queue.add({ userId: user._id }, { delay: ONE_DAY_MS })
  }

  async _sendOnboardingEmail(userId) {
    const user = await UserGetter.promises.getUser(
      { _id: userId },
      { email: 1 }
    )
    if (user) {
      await EmailHandler.promises.sendEmail('userOnboardingEmail', {
        to: user.email,
      })
      await UserUpdater.promises.updateUser(user._id, {
        $set: { onboardingEmailSentAt: new Date() },
      })
    }
  }
}

class NoopManager {
  async scheduleOnboardingEmail() {}
}

module.exports = Features.hasFeature('saas')
  ? new UserOnboardingEmailManager()
  : new NoopManager()
