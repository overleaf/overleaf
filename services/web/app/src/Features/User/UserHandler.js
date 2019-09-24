const TeamInvitesHandler = require('../Subscription/TeamInvitesHandler')

const UserHandler = {
  populateTeamInvites(user, callback) {
    TeamInvitesHandler.createTeamInvitesForLegacyInvitedEmail(
      user.email,
      callback
    )
  },

  setupLoginData(user, callback) {
    this.populateTeamInvites(user, callback)
  }
}
module.exports = UserHandler
