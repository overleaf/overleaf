NotificationsHandler = require("./NotificationsHandler")
NotificationsBuilder = require("./NotificationsBuilder")
AuthenticationController = require("../Authentication/AuthenticationController")
Settings = require 'settings-sharelatex'
logger = require("logger-sharelatex")
_ = require("underscore")

module.exports =

	getAllUnreadNotifications: (req, res)->
		ip = req.headers['x-forwarded-for'] ||
		 req.connection.remoteAddress ||
		 req.socket.remoteAddress
		user_id = AuthenticationController.getLoggedInUserId(req)

		# in v2 add notifications for matching university IPs
		if Settings.overleaf?
			NotificationsBuilder.ipMatcherAffiliation(user_id, ip).create((err) ->
				return err
			)

		NotificationsHandler.getUserNotifications user_id, (err, unreadNotifications)->
			unreadNotifications = _.map unreadNotifications, (notification)->
				notification.html = req.i18n.translate(notification.templateKey, notification.messageOpts)
				return notification
			res.send(unreadNotifications)

	markNotificationAsRead: (req, res)->
		user_id = AuthenticationController.getLoggedInUserId(req)
		notification_id = req.params.notification_id
		NotificationsHandler.markAsRead user_id, notification_id, ->
			res.send()
		logger.log user_id:user_id, notification_id:notification_id, "mark notification as read"
