/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UserHandler
const TeamInvitesHandler = require('../Subscription/TeamInvitesHandler')

module.exports = UserHandler = {
  populateTeamInvites(user, callback) {
    return TeamInvitesHandler.createTeamInvitesForLegacyInvitedEmail(
      user.email,
      callback
    )
  },

  setupLoginData(user, callback) {
    if (callback == null) {
      callback = function() {}
    }
    return this.populateTeamInvites(user, callback)
  }
}
