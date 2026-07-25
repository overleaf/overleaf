import Queues from '../../infrastructure/Queues.mjs'
import UserGetter from './UserGetter.mjs'
import InstitutionsAPI from '../Institutions/InstitutionsAPI.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

async function schedulePostRegistrationAnalytics(user) {
  await Queues.createScheduledJob(
    'post-registration-analytics',
    { data: { userId: user._id } },
    ONE_DAY_MS
  )
}

async function postRegistrationAnalytics(userId) {
  const user = await UserGetter.promises.getUser(
    { _id: userId },
    { email: 1, _id: 1, analyticsId: 1, labsProgram: 1 }
  )
  if (!user) {
    return
  }
  await checkAffiliations(user)
}

async function checkAffiliations(user) {
  const affiliationsData = await InstitutionsAPI.promises.getUserAffiliations(
    user._id.toString()
  )
  const hasCommonsAccountAffiliation = affiliationsData.some(
    affiliationData =>
      affiliationData.institution && affiliationData.institution.commonsAccount
  )

  if (hasCommonsAccountAffiliation) {
    await AnalyticsManager.setUserPropertyForMongoUser(
      user,
      'registered-from-commons-account',
      true
    )
  }
}

export default {
  schedulePostRegistrationAnalytics,
  postRegistrationAnalytics,
}
