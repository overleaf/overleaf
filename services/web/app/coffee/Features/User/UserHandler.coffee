SubscriptionDomainHandler = require("../Subscription/SubscriptionDomainHandler")
NotificationsBuilder = require("../Notifications/NotificationsBuilder")
SubscriptionGroupHandler = require("../Subscription/SubscriptionGroupHandler")
logger = require("logger-sharelatex")


module.exports = UserHandler =

	_populateGroupLicenceInvite: (user, callback)->
		licence = SubscriptionDomainHandler.getLicenceUserCanJoin user
		if !licence?
			return callback()

		SubscriptionGroupHandler.isUserPartOfGroup user._id, licence.subscription_id, (err, alreadyPartOfGroup)->
			if err?
				return callback(err)
			else if alreadyPartOfGroup
				logger.log user_id:user._id, "user already part of group, not creating notifcation for them"
				return callback()
			else
				NotificationsBuilder.groupPlan(user, licence).create(callback)

	setupLoginData: (user, callback = ->)->
		@_populateGroupLicenceInvite user, callback

