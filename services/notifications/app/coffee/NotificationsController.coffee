Notifications = require("./Notifications")
logger = require("logger-sharelatex")

module.exports =

	getUserNotifications: (req, res)->
		logger.log user_id: req.params.user_id, "getting user unread notifications"
		Notifications.getUserUnreadNotifications req.params.user_id, (err, notifications)->
			res.json(notifications)

	addNotification: (req, res)->
		logger.log user_id: req.params.user_id, notification:req.body, "adding notification"
		Notifications.addNotification req.params.user_id, req.body, (err, notifications)->
			res.send()

	removeNotificacion: (req, res)->
		logger.log user_id: req.params.user_id, notification_key:req.params.key "removing notification"
		Notifications.removeNotification req.params.user_id, req.params.key, (err, notifications)->
			res.send()
