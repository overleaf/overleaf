/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let InstitutionsGetter
const UserGetter = require('../User/UserGetter')
const UserMembershipsHandler = require('../UserMembership/UserMembershipsHandler')
const UserMembershipEntityConfigs = require('../UserMembership/UserMembershipEntityConfigs')
const logger = require('logger-sharelatex')

module.exports = InstitutionsGetter = {
  getConfirmedInstitutions(userId, callback) {
    if (callback == null) {
      callback = function(error, institutions) {}
    }
    return UserGetter.getUserFullEmails(userId, function(error, emailsData) {
      if (error != null) {
        return callback(error)
      }

      const confirmedInstitutions = emailsData
        .filter(
          emailData =>
            emailData.confirmedAt != null &&
            __guard__(
              emailData.affiliation != null
                ? emailData.affiliation.institution
                : undefined,
              x => x.confirmed
            )
        )
        .map(
          emailData =>
            emailData.affiliation != null
              ? emailData.affiliation.institution
              : undefined
        )

      return callback(null, confirmedInstitutions)
    })
  },

  getManagedInstitutions(user_id, callback) {
    if (callback == null) {
      callback = function(error, managedInstitutions) {}
    }
    return UserMembershipsHandler.getEntitiesByUser(
      UserMembershipEntityConfigs.institution,
      user_id,
      callback
    )
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
