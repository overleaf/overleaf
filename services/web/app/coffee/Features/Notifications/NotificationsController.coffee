NotificationsHandler = require("./NotificationsHandler")
logger = require("logger-sharelatex")
_ = require("underscore")

module.exports =

	getAllUnreadNotifications: (req, res)->
		NotificationsHandler.getUserNotifications req.session.user._id, (err, unreadNotifications)->
			unreadNotifications = _.map unreadNotifications, (notification)-> 
				notification.html = req.i18n.translate(notification.templateKey, notification.messageOpts)
				return notification
			res.send(unreadNotifications)

	markNotificationAsRead: (req, res)->
		user_id = req.session.user._id
		notification_id = req.params.notification_id
		NotificationsHandler.markAsRead user_id, notification_id, ->
			res.send()
		logger.log user_id:user_id, notification_id:notification_id, "mark notification as read"
