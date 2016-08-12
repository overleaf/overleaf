settings = require("settings-sharelatex")
request = require("request")
logger = require("logger-sharelatex")

oneSecond = 1000

makeRequest = (opts, callback)->
	if !settings.apis.notifications?.url?
		return callback(null, statusCode:200)
	else
		request(opts, callback)

module.exports =

	getUserNotifications: (user_id, callback)->
		opts =
			uri: "#{settings.apis.notifications?.url}/user/#{user_id}"
			json: true
			timeout: oneSecond
			method: "GET"
		makeRequest opts, (err, res, unreadNotifications)->
			statusCode =  if res? then res.statusCode else 500
			if err? or statusCode != 200
				e = new Error("something went wrong getting notifications, #{err}, #{statusCode}")
				logger.err err:err, "something went wrong getting notifications"
				callback(null, [])
			else
				if !unreadNotifications?
					unreadNotifications = []
				callback(null, unreadNotifications)

	createNotification: (user_id, key, templateKey, messageOpts, callback)->
		opts =
			uri: "#{settings.apis.notifications?.url}/user/#{user_id}"
			timeout: oneSecond
			method:"POST"
			json: {
				key:key
				messageOpts:messageOpts
				templateKey:templateKey
			}
		logger.log opts:opts, "creating notification for user"
		makeRequest opts, callback

	markAsReadWithKey: (user_id, key, callback)->
		opts =
			uri: "#{settings.apis.notifications?.url}/user/#{user_id}"
			method: "DELETE"
			timeout: oneSecond
			json: {
				key:key
			}
		logger.log user_id:user_id, key:key, "sending mark notification as read with key to notifications api"
		makeRequest opts, callback


	markAsRead: (user_id, notification_id, callback)->
		opts =
			method: "DELETE"
			uri: "#{settings.apis.notifications?.url}/user/#{user_id}/notification/#{notification_id}"
			timeout:oneSecond
		logger.log user_id:user_id, notification_id:notification_id, "sending mark notification as read to notifications api"
		makeRequest opts, callback

	# removes notification by key, without regard for user_id,
	# should not be exposed to user via ui/router
	markAsReadByKeyOnly: (key, callback)->
		opts =
			uri: "#{settings.apis.notifications?.url}/key/#{key}"
			method: "DELETE"
			timeout: oneSecond
		logger.log {key:key}, "sending mark notification as read with key-only to notifications api"
		makeRequest opts, callback
