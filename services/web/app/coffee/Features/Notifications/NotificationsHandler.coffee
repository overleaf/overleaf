settings = require("settings-sharelatex")
request = require("request")
logger = require("logger-sharelatex")

oneSecond = 1000
module.exports = 

	getUserNotifications: (user_id, callback)->
		opts = 
			uri: "#{settings.apis.notifications.url}/user/#{user_id}"
			json: true
			timeout: 2000
		request.get opts, (err, res, unreadNotifications)->
			statusCode =  if res? then res.statusCode else 500
			if err? or statusCode != 200
				e = new Error("something went wrong getting notifications, #{err}, #{statusCode}")
				logger.err err:err, "something went wrong getting notifications"
				callback(null, [])
			else
				if !unreadNotifications?
					unreadNotifications = []
				callback(null, unreadNotifications)

	markAsRead: (user_id, notification_id, callback)->
		opts =
			uri: "#{settings.apis.notifications.url}/user/#{user_id}/notification/#{notification_id}"
			timeout:oneSecond
		logger.log user_id:user_id, notification_id:notification_id, "send mark notification to notifications api"
		request.del opts, callback
