import { callbackifyAll } from '@overleaf/promise-utils'
import UserGetter from '../User/UserGetter.mjs'
import PlansLocator from '../Subscription/PlansLocator.mjs'
import Settings from '@overleaf/settings'

async function getInstitutionsFeatures(userId) {
  const planCode = await getInstitutionsPlan(userId)
  const plan = planCode && PlansLocator.findLocalPlanInSettings(planCode)
  const features = plan && plan.features
  return features || {}
}

async function getInstitutionsPlan(userId) {
  if (await hasLicence(userId)) {
    return Settings.institutionPlanCode
  }
  return null
}

async function hasLicence(userId) {
  const emailsData = await UserGetter.promises.getUserFullEmails(userId)
  return emailsData.some(emailData => emailData.emailHasInstitutionLicence)
}
const InstitutionsFeatures = {
  getInstitutionsFeatures,
  getInstitutionsPlan,
  hasLicence,
}

export default {
  promises: InstitutionsFeatures,
  ...callbackifyAll(InstitutionsFeatures),
}
