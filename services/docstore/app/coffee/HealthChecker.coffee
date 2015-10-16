ObjectId = require("mongojs").ObjectId
request = require("request")
async = require("async")
_ = require("underscore")
crypto = require("crypto")	
settings = require("settings-sharelatex")
port = settings.internal.docstore.port
logger = require "logger-sharelatex"


module.exports = 
	check : (callback)->
		doc_id = ObjectId()
		project_id = ObjectId(settings.docstore.healthCheck.project_id)
		url = "http://localhost:#{port}/project/#{project_id}/doc/#{doc_id}"
		lines = ["smoke test - delete me", "#{crypto.randomBytes(32).toString("hex")}"]
		logger.log lines:lines, url:url, doc_id:doc_id, project_id:project_id, "running health check"
		jobs = [
			(cb)->
				opts = 
					url:url
					json: {lines: lines}
				request.post(opts, cb)
			(cb)->
				request.get {url:url, json:true}, (err, res, body)->
					if res.statusCode != 200
						cb("status code not 200, its #{res.statusCode}")
					else if _.isEqual(body.lines, lines) and body._id == doc_id.toString()
						cb()
					else
						cb("health check lines not equal #{body.lines} != #{lines}")
			(cb)->
				request.del url, cb
		]
		async.series jobs, callback
