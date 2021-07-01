const Queues = require('../../infrastructure/Queues')
const UserGetter = require('./UserGetter')
const {
  promises: InstitutionsAPIPromises,
} = require('../Institutions/InstitutionsAPI')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const Features = require('../../infrastructure/Features')

const ONE_DAY_MS = 24 * 60 * 60 * 1000

class UserPostRegistrationAnalyticsManager {
  constructor() {
    this.queue = Queues.getPostRegistrationAnalyticsQueue()
    this.queue.process(async job => {
      const { userId } = job.data
      await postRegistrationAnalytics(userId)
    })
  }

  async schedulePostRegistrationAnalytics(user) {
    await this.queue.add({ userId: user._id }, { delay: ONE_DAY_MS })
  }
}

async function postRegistrationAnalytics(userId) {
  const user = await UserGetter.promises.getUser({ _id: userId }, { email: 1 })
  if (!user) {
    return
  }
  await checkAffiliations(userId)
}

async function checkAffiliations(userId) {
  const affiliationsData = await InstitutionsAPIPromises.getUserAffiliations(
    userId
  )
  const hasCommonsAccountAffiliation = affiliationsData.some(
    affiliationData =>
      affiliationData.institution && affiliationData.institution.commonsAccount
  )

  if (hasCommonsAccountAffiliation) {
    await AnalyticsManager.setUserProperty(
      userId,
      'registered-from-commons-account',
      true
    )
  }
}

class NoopManager {
  async schedulePostRegistrationAnalytics() {}
}

module.exports = Features.hasFeature('saas')
  ? new UserPostRegistrationAnalyticsManager()
  : new NoopManager()
