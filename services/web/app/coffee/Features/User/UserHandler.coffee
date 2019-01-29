TeamInvitesHandler = require("../Subscription/TeamInvitesHandler")

module.exports = UserHandler =
	populateTeamInvites: (user, callback) ->
		TeamInvitesHandler.createTeamInvitesForLegacyInvitedEmail(user.email, callback)

	setupLoginData: (user, callback = ->)->
		@populateTeamInvites user, callback
