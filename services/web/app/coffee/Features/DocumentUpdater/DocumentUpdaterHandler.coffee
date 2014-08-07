request = require 'request'
request = request.defaults()
async = require 'async'
settings = require 'settings-sharelatex'
_ = require 'underscore'
async = require 'async'
logger = require('logger-sharelatex')
metrics = require('../../infrastructure/Metrics')
slReqIdHelper = require('soa-req-id')
redis = require('redis')
rclient = redis.createClient(settings.redis.web.port, settings.redis.web.host)
rclient.auth(settings.redis.web.password)
Project = require("../../models/Project").Project
ProjectLocator = require('../../Features/Project/ProjectLocator')

module.exports = DocumentUpdaterHandler =
	
	queueChange : (project_id, doc_id, change, sl_req_id, callback = ()->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		jsonChange = JSON.stringify change
		doc_key = keys.combineProjectIdAndDocId(project_id, doc_id)
		multi = rclient.multi()
		multi.rpush keys.pendingUpdates(doc_id:doc_id), jsonChange
		multi.sadd  keys.docsWithPendingUpdates, doc_key
		multi.rpush "pending-updates-list", doc_key
		multi.exec (error) ->
			return callback(error) if error?
			callback()

	flushProjectToMongo: (project_id, sl_req_id, callback = (error) ->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		logger.log project_id:project_id, sl_req_id:sl_req_id, "flushing project from document updater"
		timer = new metrics.Timer("flushing.mongo.project")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/flush"
		request.post url, (error, res, body)->
			if error?
				logger.error err: error, project_id: project_id, sl_req_id: sl_req_id, "error flushing project from document updater"
				return callback(error)
			else if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id: project_id, sl_req_id: sl_req_id, "flushed project from document updater"
				return callback(null)
			else
				error = new Error("document updater returned a failure status code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, sl_req_id: sl_req_id, "document updater returned failure status code: #{res.statusCode}"
				return callback(error)

	flushMultipleProjectsToMongo: (project_ids, callback = (error) ->) ->
		jobs = []
		for project_id in project_ids
			do (project_id) ->
				jobs.push (callback) ->
					DocumentUpdaterHandler.flushProjectToMongo project_id, callback
		async.series jobs, callback

	flushProjectToMongoAndDelete: (project_id, sl_req_id, callback = ()->) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		logger.log project_id:project_id, sl_req_id:sl_req_id, "deleting project from document updater"
		timer = new metrics.Timer("delete.mongo.project")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}"
		request.del url, (error, res, body)->
			if error?
				logger.error err: error, project_id: project_id, sl_req_id: sl_req_id, "error deleting project from document updater"
				return callback(error)
			else if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id: project_id, sl_req_id: sl_req_id, "deleted project from document updater"
				return callback(null)
			else
				error = new Error("document updater returned a failure status code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, sl_req_id: sl_req_id, "document updater returned failure status code: #{res.statusCode}"
				return callback(error)

	flushDocToMongo: (project_id, doc_id, callback = (error) ->) ->
		logger.log project_id:project_id, doc_id: doc_id, "flushing doc from document updater"
		timer = new metrics.Timer("flushing.mongo.doc")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}/flush"
		request.post url, (error, res, body)->
			if error?
				logger.error err: error, project_id: project_id, doc_id: doc_id, "error flushing doc from document updater"
				return callback(error)
			else if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id: project_id, doc_id: doc_id, "flushed doc from document updater"
				return callback(null)
			else
				error = new Error("document updater returned a failure status code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, doc_id: doc_id, "document updater returned failure status code: #{res.statusCode}"
				return callback(error)
	
	deleteDoc : (project_id, doc_id, sl_req_id, callback = ()->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		logger.log project_id:project_id, doc_id: doc_id, sl_req_id:sl_req_id, "deleting doc from document updater"
		timer = new metrics.Timer("delete.mongo.doc")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}"
		request.del url, (error, res, body)->
			if error?
				logger.error err: error, project_id: project_id, doc_id: doc_id, sl_req_id: sl_req_id, "error deleting doc from document updater"
				return callback(error)
			else if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id: project_id, doc_id: doc_id, sl_req_id: sl_req_id, "deleted doc from document updater"
				return callback(null)
			else
				error = new Error("document updater returned a failure status code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, doc_id: doc_id, sl_req_id: sl_req_id, "document updater returned failure status code: #{res.statusCode}"
				return callback(error)

	getDocument: (project_id, doc_id, fromVersion, sl_req_id, callback = (error, exists, doclines, version) ->) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		timer = new metrics.Timer("get-document")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}?fromVersion=#{fromVersion}"
		logger.log project_id:project_id, doc_id: doc_id, sl_req_id:sl_req_id, "getting doc from document updater"
		request.get url, (error, res, body)->
			timer.done()
			if error?
				logger.error err:error, url:url, project_id:project_id, doc_id:doc_id, "error getting doc from doc updater"
				return callback(error)
			if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id:project_id, doc_id:doc_id, "got doc from document document updater"
				try
					body = JSON.parse(body)
				catch error
					return callback(error)
				callback null, body.lines, body.version, body.ops
			else
				logger.error project_id:project_id, doc_id:doc_id, url: url, "doc updater returned a non-success status code: #{res.statusCode}"
				callback new Error("doc updater returned a non-success status code: #{res.statusCode}")

	setDocument : (project_id, doc_id, docLines, sl_req_id, callback = (error) ->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		timer = new metrics.Timer("set-document")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}"
		body =
			url: url
			json:
				lines: docLines
		logger.log project_id:project_id, doc_id: doc_id, sl_req_id:sl_req_id, "setting doc in document updater"
		request.post body, (error, res, body)->
			timer.done()
			if error?
				logger.error err:error, url:url, project_id:project_id, doc_id:doc_id, "error setting doc in doc updater"
				return callback(error)
			if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id: project_id, doc_id: doc_id, sl_req_id: sl_req_id, "set doc in document updater"
				return callback(null)
			else
				logger.error project_id:project_id, doc_id:doc_id, url: url, "doc updater returned a non-success status code: #{res.statusCode}"
				callback new Error("doc updater returned a non-success status code: #{res.statusCode}")

	getNumberOfDocsInMemory : (callback)->
		request.get "#{settings.apis.documentupdater.url}/total", (err, req, body)->
			try
				body = JSON.parse body
			catch err
				logger.err err:err, "error parsing response from doc updater about the total number of docs"
			callback(err, body?.total)



PENDINGUPDATESKEY = "PendingUpdates"
DOCLINESKEY = "doclines"
DOCIDSWITHPENDINGUPDATES = "DocsWithPendingUpdates"

keys =
	pendingUpdates : (op) ->  "#{PENDINGUPDATESKEY}:#{op.doc_id}"
	docsWithPendingUpdates: DOCIDSWITHPENDINGUPDATES
	docLines : (op) -> "#{DOCLINESKEY}:#{op.doc_id}"
	combineProjectIdAndDocId: (project_id, doc_id) -> "#{project_id}:#{doc_id}"


