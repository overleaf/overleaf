ObjectId = require("mongojs").ObjectId
request = require("request")
async = require("async")
_ = require("underscore")
settings = require("settings-sharelatex")
port = settings.internal.notifications.port
logger = require "logger-sharelatex"

mongojs = require('mongojs')
Settings = require 'settings-sharelatex'
db = mongojs(Settings.mongo?.url, ['notifications'])

module.exports = 
	check : (callback)->
		user_id = ObjectId(settings.notifications.healthCheck.user_id)
		notification_key = "smoke-test-notification-#{ObjectId()}"
		getOpts = (endPath)-> {url:"http://localhost:#{port}/user/#{user_id}#{endPath}", timeout:3000}
		logger.log user_id:user_id, opts:getOpts(), key:notification_key, user_id:user_id, "Health Check: running"
		jobs = [
			(cb)->
				opts = getOpts("/")
				opts.json = {key: notification_key, messageOpts:'', templateKey:'f4g5', user_id:user_id}
				request.post(opts, cb)
			(cb)->
				opts = getOpts("/")
				opts.json = true
				request.get opts, (err, res, body)->
					if err?
						logger.err err:err, "Health Check: error getting notification"
						return callback(err)
					else if res.statusCode != 200
						e = "status code not 200 #{res.statusCode}"
						logger.err err:err, e
						return cb(e)
					hasNotification = _.some body, (notification)-> 
						notification.key == notification_key and notification.user_id == user_id.toString()
					if hasNotification
						cb(null, body)
					else
						logger.err body:body, notification_key:notification_key, "Health Check: notification not in response"
						return cb("notification not found in response")
		]
		async.series jobs, (err, body)->
			if err?
				logger.err err:err, "Health Check: error running health check"
				return callback(err)
			else
				notification_id = body[1][0]._id
				notification_key = body[1][0].key
				opts = getOpts("/notification/#{notification_id}")
				logger.log notification_id:notification_id, notification_key:notification_key, "Health Check: doing cleanup"
				request.del opts, (err, res, body)->
					if err?
						logger.err err, opts, "Health Check: error cleaning up notification"
						return callback(err)
					opts = getOpts("")
					opts.json = {key: notification_key}
					request.del opts, (err, res, body)->
						if err?
							logger.err err, opts, "Health Check: error cleaning up notification"
							return callback(err)
						db.notifications.remove {_id:ObjectId(notification_id)}, callback
