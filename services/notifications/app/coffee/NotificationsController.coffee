Notifications = require("./Notifications")
logger = require("logger-sharelatex")

module.exports =

	getUserNotifications: (req, res)->
		logger.log user_id: req.params.user_id, "getting user unread notifications"
		Notifications.getUserNotifications req.params.user_id, (err, notifications)->
			res.json(notifications)

	addNotification: (req, res)->
		logger.log user_id: req.params.user_id, notification:req.body, "adding notification"
		Notifications.addNotification req.params.user_id, req.body, (err, notifications)->
			if err?
				res.send 500
			else
				res.send()

	removeNotification: (req, res)->
		logger.log user_id: req.params.user_id, notification_id: req.params.notification_id, "mark notification as read"
		Notifications.removeNotification req.params.user_id, req.params.notification_id, (err, notifications)->
			res.send()
