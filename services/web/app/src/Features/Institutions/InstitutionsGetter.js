const { promisify, callbackify } = require('util')
const UserGetter = require('../User/UserGetter')
const UserMembershipsHandler = require('../UserMembership/UserMembershipsHandler')
const UserMembershipEntityConfigs = require('../UserMembership/UserMembershipEntityConfigs')

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

const InstitutionsGetter = {
  getConfirmedAffiliations(userId, callback) {
    UserGetter.getUserFullEmails(userId, function (error, emailsData) {
      if (error) {
        return callback(error)
      }

      const confirmedAffiliations = emailsData
        .filter(
          emailData =>
            emailData.confirmedAt &&
            emailData.affiliation &&
            emailData.affiliation.institution &&
            emailData.affiliation.institution.confirmed
        )
        .map(emailData => emailData.affiliation)

      callback(null, confirmedAffiliations)
    })
  },

  getCurrentInstitutionIds: callbackify(getCurrentInstitutionIds),
  getCurrentInstitutionsWithLicence: callbackify(
    getCurrentInstitutionsWithLicence
  ),

  getManagedInstitutions(userId, callback) {
    UserMembershipsHandler.getEntitiesByUser(
      UserMembershipEntityConfigs.institution,
      userId,
      callback
    )
  },
}

InstitutionsGetter.promises = {
  getCurrentAffiliations,
  getCurrentInstitutionIds,
  getCurrentInstitutionsWithLicence,
  getCurrentAndPastAffiliationIds,
  getManagedInstitutions: promisify(InstitutionsGetter.getManagedInstitutions),
}

module.exports = InstitutionsGetter
