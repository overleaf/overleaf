SubscriptionDomainHandler = require("../Subscription/SubscriptionDomainHandler")
NotificationsBuilder = require("../Notifications/NotificationsBuilder")
SubscriptionGroupHandler = require("../Subscription/SubscriptionGroupHandler")

module.exports = UserHandler =

	_populateGroupLicenceInvite: (user, callback)->
		licence = SubscriptionDomainHandler.getLicenceUserCanJoin user
		if !licence?
			return callback()

		SubscriptionGroupHandler.isUserPartOfGroup user._id, licence.subscription_id, (err, alreadyPartOfGroup)->
			if err? or alreadyPartOfGroup
				return callback(err)
			else
				NotificationsBuilder.groupPlan(user, licence).create(callback)

	setupLoginData: (user, callback = ->)->
		@_populateGroupLicenceInvite user, callback

