import { callbackify } from 'node:util'
import UserGetter from '../User/UserGetter.mjs'
import UserMembershipsHandler from '../UserMembership/UserMembershipsHandler.mjs'
import UserMembershipEntityConfigs from '../UserMembership/UserMembershipEntityConfigs.mjs'

async function getCurrentAffiliations(userId) {
  const fullEmails = await UserGetter.promises.getUserFullEmails(userId)
  // current are those confirmed and not with lapsed reconfirmations
  return fullEmails
    .filter(
      emailData =>
        emailData.confirmedAt &&
        emailData.affiliation &&
        emailData.affiliation.institution &&
        emailData.affiliation.institution.confirmed &&
        !emailData.affiliation.pastReconfirmDate
    )
    .map(emailData => emailData.affiliation)
}

async function getCurrentAndPastAffiliationIds(userId) {
  let fullEmails = await UserGetter.promises.getUserFullEmails(userId)
  // current are those confirmed and not with lapsed reconfirmations
  fullEmails = fullEmails
    .filter(
      emailData =>
        emailData.confirmedAt && emailData.affiliation?.institution?.confirmed
    )
    .map(emailData => emailData.affiliation.institution.id)
  // remove dupes
  return [...new Set(fullEmails)]
}

async function getCurrentInstitutionIds(userId) {
  // current are those confirmed and not with lapsed reconfirmations
  // only 1 record returned per current institutionId
  const institutionIds = new Set()
  const currentAffiliations = await getCurrentAffiliations(userId)
  currentAffiliations.forEach(affiliation => {
    institutionIds.add(affiliation.institution.id)
  })
  return [...institutionIds]
}

async function getCurrentInstitutionsWithLicence(userId) {
  // current are those confirmed and not with lapsed reconfirmations
  // only 1 record returned per current institution
  const institutions = {}
  const currentAffiliations = await getCurrentAffiliations(userId)
  currentAffiliations.forEach(affiliation => {
    if (affiliation.licence && affiliation.licence !== 'free') {
      institutions[affiliation.institution.id] = affiliation.institution
    }
  })
  return Object.values(institutions)
}

async function getConfirmedAffiliations(userId) {
  const emailsData = await UserGetter.promises.getUserFullEmails(userId)

  const confirmedAffiliations = emailsData
    .filter(
      emailData =>
        emailData.confirmedAt &&
        emailData.affiliation &&
        emailData.affiliation.institution &&
        emailData.affiliation.institution.confirmed
    )
    .map(emailData => emailData.affiliation)

  return confirmedAffiliations
}

async function getManagedInstitutions(userId) {
  return await UserMembershipsHandler.promises.getEntitiesByUser(
    UserMembershipEntityConfigs.institution,
    userId
  )
}

const InstitutionsGetter = {
  getConfirmedAffiliations: callbackify(getConfirmedAffiliations),
  getCurrentInstitutionIds: callbackify(getCurrentInstitutionIds),
  getCurrentInstitutionsWithLicence: callbackify(
    getCurrentInstitutionsWithLicence
  ),
  getManagedInstitutions: callbackify(getManagedInstitutions),
}

InstitutionsGetter.promises = {
  getCurrentAffiliations,
  getCurrentInstitutionIds,
  getCurrentInstitutionsWithLicence,
  getCurrentAndPastAffiliationIds,
  getManagedInstitutions,
}

export default InstitutionsGetter
