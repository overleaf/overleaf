
NotificationsHandler = require("./NotificationsHandler")

module.exports = 

	groupPlan: (user, licence)->
		key : "join-sub-#{licence.subscription_id}"

		create: (callback = ->)->
			messageOpts = 
				groupName: licence.name
				subscription_id: licence.subscription_id
			NotificationsHandler.createNotification user._id, key, "joinSubscriptionInvite", messageOpts, callback

		read: (callback = ->)->
			NotificationsHandler.markAsReadWithKey user._id, key, callback
