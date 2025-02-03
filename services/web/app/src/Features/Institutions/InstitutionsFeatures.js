const { callbackifyAll } = require('@overleaf/promise-utils')
const UserGetter = require('../User/UserGetter')
const PlansLocator = require('../Subscription/PlansLocator')
const Settings = require('@overleaf/settings')

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
module.exports = {
  promises: InstitutionsFeatures,
  ...callbackifyAll(InstitutionsFeatures),
}
