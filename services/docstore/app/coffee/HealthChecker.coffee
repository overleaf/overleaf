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
		getOpts = -> {url:url, timeout:3000}
		logger.log lines:lines, url:url, doc_id:doc_id, project_id:project_id, "running health check"
		jobs = [
			(cb)->
				opts = getOpts()
				opts.json = {lines: lines, version: 42}
				request.post(opts, cb)
			(cb)->
				opts = getOpts()
				opts.json = true
				request.get opts, (err, res, body)->
					if err?
						logger.err err:err, "docstore returned a error in health check get"
						cb(err)
					else if !res?
						cb("no response from docstore with get check")
					else if res?.statusCode != 200
						cb("status code not 200, its #{res.statusCode}")
					else if _.isEqual(body?.lines, lines) and body?._id == doc_id.toString()
						cb()
					else
						cb("health check lines not equal #{body.lines} != #{lines}")
		]
		async.series jobs, (err)->
			if err?
				callback(err)
			request.del getOpts(), callback
