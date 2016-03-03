ObjectId = require("mongojs").ObjectId
request = require("request")
async = require("async")
settings = require("settings-sharelatex")
port = settings.internal.trackchanges.port
logger = require "logger-sharelatex"
LockManager = require "./LockManager"

module.exports =
	check : (callback)->
		project_id = ObjectId(settings.trackchanges.healthCheck.project_id)
		url = "http://localhost:#{port}/project/#{project_id}"
		logger.log project_id:project_id, "running health check"
		jobs = [
			(cb)->
				request.get {url:"http://localhost:#{port}/check_lock", timeout:3000}, (err, res, body) ->
					if err?
						logger.err err:err, project_id:project_id, "error checking lock for health check"
						cb(err)
					else if res?.statusCode != 200
						cb("status code not 200, it's #{res.statusCode}")
					else
						cb()
			(cb)->
				request.post {url:"#{url}/flush", timeout:3000}, (err, res, body) ->
					if err?
						logger.err err:err, project_id:project_id, "error flushing for health check"
						cb(err)
					else if res?.statusCode != 204
						cb("status code not 204, it's #{res.statusCode}")
					else
						cb()
			(cb)->
				request.get {url:"#{url}/updates", timeout:3000}, (err, res, body)->
					if err?
						logger.err err:err, project_id:project_id, "error getting updates for health check"
						cb(err)
					else if res?.statusCode != 200
						cb("status code not 200, it's #{res.statusCode}")
					else
						cb()
		]
		async.series jobs, callback

	checkLock: (callback) ->
		LockManager.healthCheck callback
