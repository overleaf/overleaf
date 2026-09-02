import { callbackify } from 'node:util'
import UserGetter from '../User/UserGetter.mjs'
import UserMembershipsHandler from '../UserMembership/UserMembershipsHandler.mjs'
import UserMembershipEntityConfigs from '../UserMembership/UserMembershipEntityConfigs.mjs'

// The affiliation getters below all derive from UserGetter.getUserFullEmails
// and differ only in filter strictness. Terms used in their names:
//   - "confirmed": email confirmed AND its institution's domain confirmed.
//   - "current": confirmed AND not past the reconfirmation deadline.
//   - "entitled": current AND the user holds an institution licence for that
//     email. Being current is not sufficient: some commons subscriptions only
//     entitle specific SSO users. Use the entitled getter for licence-gated
//     benefits so unentitled users don't receive them.

/**
 * See "entitled" above. Use for licence-gated benefits (e.g. the institution
 * plan, the AI assist add-on bundle). Same selection as
 * getCurrentInstitutionsWithLicence, but returns one affiliation object per
 * matching email (not deduplicated by institution).
 * @param {string} userId
 * @returns {Promise<object[]>} affiliation objects
 */
async function getCurrentEntitledAffiliations(userId) {
  const fullEmails = await UserGetter.promises.getUserFullEmails(userId)
  // emailHasInstitutionLicence already implies a confirmed email at a confirmed
  // institution that is not past reconfirmation (see InstitutionsHelper), so no
  // further filtering is needed.
  return fullEmails
    .filter(emailData => emailData.emailHasInstitutionLicence)
    .map(emailData => emailData.affiliation)
}

/**
 * Does not check entitlement, so may include affiliations the user holds no
 * licence for; use getCurrentEntitledAffiliations for licence-gated benefits.
 * @param {string} userId
 * @returns {Promise<object[]>} affiliation objects
 */
async function getCurrentAffiliations(userId) {
  const fullEmails = await UserGetter.promises.getUserFullEmails(userId)
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

/**
 * @param {string} userId
 * @returns {Promise<Array<string|number>>} deduplicated institution ids
 */
async function getCurrentAndPastAffiliationIds(userId) {
  let fullEmails = await UserGetter.promises.getUserFullEmails(userId)
  fullEmails = fullEmails
    .filter(
      emailData =>
        emailData.confirmedAt && emailData.affiliation?.institution?.confirmed
    )
    .map(emailData => emailData.affiliation.institution.id)
  return [...new Set(fullEmails)]
}

/**
 * @param {string} userId
 * @returns {Promise<Array<string|number>>} deduplicated institution ids
 */
async function getCurrentInstitutionIds(userId) {
  const institutionIds = new Set()
  const currentAffiliations = await getCurrentAffiliations(userId)
  currentAffiliations.forEach(affiliation => {
    institutionIds.add(affiliation.institution.id)
  })
  return [...institutionIds]
}

/**
 * A non-free affiliation licence is exactly what "entitled" means (see above),
 * so this selects the same set as getCurrentEntitledAffiliations. The
 * difference is the return value: institution objects deduplicated per
 * institution, rather than one affiliation object per matching email.
 * @param {string} userId
 * @returns {Promise<object[]>} institution objects, deduplicated
 */
async function getCurrentInstitutionsWithLicence(userId) {
  const institutions = {}
  const currentAffiliations = await getCurrentAffiliations(userId)
  currentAffiliations.forEach(affiliation => {
    if (affiliation.licence && affiliation.licence !== 'free') {
      institutions[affiliation.institution.id] = affiliation.institution
    }
  })
  return Object.values(institutions)
}

/**
 * Loosest getter: no reconfirmation or entitlement filtering (see above).
 * @param {string} userId
 * @returns {Promise<object[]>} affiliation objects
 */
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

/**
 * Institutions the user administers (via user memberships), not their email
 * affiliations.
 * @param {string} userId
 * @returns {Promise<object[]>} managed institution entities
 */
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
  getCurrentEntitledAffiliations,
  getCurrentInstitutionIds,
  getCurrentInstitutionsWithLicence,
  getCurrentAndPastAffiliationIds,
  getManagedInstitutions,
}

export default InstitutionsGetter
