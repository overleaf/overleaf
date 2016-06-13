
NotificationsHandler = require("./NotificationsHandler")

module.exports = 

	groupPlan: (user, licence)->
		key : "join-sub-#{licence.subscription_id}"
		logger.log user_id:user_id, key:key, "creating notification key for user"
		create: (callback = ->)->
			messageOpts = 
				groupName: licence.name
				subscription_id: licence.subscription_id
			NotificationsHandler.createNotification user._id, @key, "notification_group_invite", messageOpts, callback

		read: (callback = ->)->
			NotificationsHandler.markAsReadWithKey user._id, @key, callback
