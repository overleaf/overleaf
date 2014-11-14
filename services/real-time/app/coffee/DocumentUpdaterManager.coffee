request = require "request"
logger = require "logger-sharelatex"
settings = require "settings-sharelatex"

redis = require("redis-sharelatex")
rclient = redis.createClient(settings.redis.web)

module.exports = DocumentUpdaterManager =
	getDocument: (project_id, doc_id, fromVersion, callback = (error, exists, doclines, version) ->) ->
		#timer = new metrics.Timer("get-document")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}?fromVersion=#{fromVersion}"
		logger.log {project_id, doc_id, fromVersion}, "getting doc from document updater"
		request.get url, (err, res, body) ->
			#timer.done()
			if err?
				logger.error {err, url, project_id, doc_id}, "error getting doc from doc updater"
				return callback(err)
			if 200 <= res.statusCode < 300
				logger.log {project_id, doc_id}, "got doc from document document updater"
				try
					body = JSON.parse(body)
				catch error
					return callback(error)
				callback null, body?.lines, body?.version, body?.ops
			else
				err = new Error("doc updater returned a non-success status code: #{res.statusCode}")
				err.statusCode = res.statusCode
				logger.error {err, project_id, doc_id, url}, "doc updater returned a non-success status code: #{res.statusCode}"
				callback err

	flushProjectToMongoAndDelete: (project_id, callback = ()->) ->
		logger.log project_id:project_id, "deleting project from document updater"
		#timer = new metrics.Timer("delete.mongo.project")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}"
		request.del url, (err, res, body)->
			#timer.done()
			if err?
				logger.error {err, project_id}, "error deleting project from document updater"
				return callback(err)
			else if 200 <= res.statusCode  < 300
				logger.log {project_id}, "deleted project from document updater"
				return callback(null)
			else
				err = new Error("document updater returned a failure status code: #{res.statusCode}")
				err.statusCode = res.statusCode
				logger.error {err, project_id}, "document updater returned failure status code: #{res.statusCode}"
				return callback(err)
				
	queueChange: (project_id, doc_id, change, callback = ()->)->
		jsonChange = JSON.stringify change
		doc_key = "#{project_id}:#{doc_id}"
		multi = rclient.multi()
		multi.rpush "PendingUpdates:#{doc_id}", jsonChange
		multi.sadd  "DocsWithPendingUpdates", doc_key
		multi.rpush "pending-updates-list", doc_key
		multi.exec (error) ->
			return callback(error) if error?
			callback()