ObjectId = require("mongojs").ObjectId
request = require("request")
async = require("async")
_ = require("underscore")
settings = require("settings-sharelatex")
port = settings.internal.notifications.port
logger = require "logger-sharelatex"


module.exports = 
	check : (callback)->
		project_id = ObjectId()
		user_id = ObjectId(settings.notifications.healthCheck.user_id)
		notification_key = "smoke-test-notification"
		getOpts = (endPath)-> {url:"http://localhost:#{port}/user/#{user_id}#{endPath}", timeout:3000}
		logger.log user_id:user_id, opts:getOpts(), key:notification_key, user_id:user_id, "running health check"
		jobs = [
			(cb)->
				opts = getOpts("/")
				opts.json = {key: notification_key, messageOpts:'', templateKey:'', user_id:user_id}
				request.post(opts, cb)
			(cb)->
				opts = getOpts("/")
				opts.json = true
				request.get opts, (err, res, body)->
					if res.statusCode != 200
						return cb("status code not 200, its #{res.statusCode}")

					hasNotification = _.some body, (notification)-> 
						notification.key == notification_key and _.contains(notification.user_id, user_id.toString())
					if hasNotification
						cb()
					else
						cb("notification not found in response")
		]
		async.series jobs, (err)->
			if err?
				callback(err)
			opts = getOpts("/notification_id/#{notification_id}")
			request.del opts, callback
