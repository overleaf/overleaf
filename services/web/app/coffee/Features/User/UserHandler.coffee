SubscriptionDomainHandler = require("../Subscription/SubscriptionDomainHandler")
NotificationsBuilder = require("../Notifications/NotificationsBuilder")
SubscriptionGroupHandler = require("../Subscription/SubscriptionGroupHandler")
TeamInvitesHandler = require("../Subscription/TeamInvitesHandler")
logger = require("logger-sharelatex")


module.exports = UserHandler =

	populateTeamInvites: (user, callback) ->
		UserHandler.notifyDomainLicence user, (err) ->
			return callback(err) if err?
			TeamInvitesHandler.createTeamInvitesForLegacyInvitedEmail(user.email, callback)

	notifyDomainLicence: (user, callback = ->)->
		logger.log user_id:user._id, "notiying user about a potential domain licence"
		licence = SubscriptionDomainHandler.getLicenceUserCanJoin user
		if !licence?
			return callback()

		SubscriptionGroupHandler.isUserPartOfGroup user._id, licence.subscription_id, (err, alreadyPartOfGroup)->
			if err?
				return callback(err)
			else if alreadyPartOfGroup
				logger.log user_id:user._id, "user already part of team, not creating notifcation for them"
				return callback()
			else
				NotificationsBuilder.groupPlan(user, licence).create(callback)

	setupLoginData: (user, callback = ->)->
		@populateTeamInvites user, callback
