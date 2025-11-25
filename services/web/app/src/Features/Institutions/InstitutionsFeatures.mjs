import { callbackifyAll } from '@overleaf/promise-utils'
import UserGetter from '../User/UserGetter.mjs'
import PlansLocator from '../Subscription/PlansLocator.mjs'
import Settings from '@overleaf/settings'
import InstitutionsGetter from './InstitutionsGetter.mjs'
import FeaturesHelper from '../Subscription/FeaturesHelper.mjs'

async function _getInstitutionsAddons(userId) {
  const affiliates =
    await InstitutionsGetter.promises.getCurrentAffiliations(userId)
  // currently only addOn available to institutions is assist/WF bundle,
  //  which is denoted by the presence of writefullCommonsAccount on the institution
  const hasAssistBundle = affiliates.some(
    affiliate => affiliate?.institution?.writefullCommonsAccount === true
  )
  return hasAssistBundle ? { aiErrorAssistant: true } : {}
}

async function getInstitutionsFeatures(userId) {
  const planCode = await getInstitutionsPlan(userId)
  const plan = planCode && PlansLocator.findLocalPlanInSettings(planCode)
  let features = plan && plan.features

  const addOns = await _getInstitutionsAddons(userId)
  features = FeaturesHelper.mergeFeatures(features, addOns)

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
