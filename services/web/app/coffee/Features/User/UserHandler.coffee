SubscriptionDomainHandler = require("../Subscription/SubscriptionDomainHandler")
NotificationsBuilder = require("../Notifications/NotificationsBuilder")


module.exports =

	setupLoginData: (user, callback = ->)->
		licence = SubscriptionDomainHandler.getLicenceUserCanJoin user
		if licence?
			NotificationsBuilder.groupPlan(user, licence).create(callback)
		else
			return callback()
