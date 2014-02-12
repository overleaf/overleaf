settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
Project = require('../../models/Project').Project
request = require('request')
DocumentUpdaterHandler = require('../../Features/DocumentUpdater/DocumentUpdaterHandler')
redis = require('redis')
rclient = redis.createClient(settings.redis.web.port, settings.redis.web.host)
rclient.auth(settings.redis.web.password)
Keys = require("./RedisKeys")
ProjectEntityHandler = require('../../Features/Project/ProjectEntityHandler')
metrics = require('../../infrastructure/Metrics')
keys = require('../../infrastructure/Keys')
queue = require('fairy').connect(settings.redis.fairy).queue(keys.queue.web_to_tpds_http_requests)
slReqIdHelper = require('soa-req-id')

headers =
	Authorization : "Basic " + new Buffer("#{settings.apis.versioning.username}:#{settings.apis.versioning.password}").toString("base64")

module.exports =
	
	enableVersioning: (project_or_id, callback = (err)->)->
		Project.getProject project_or_id, 'existsInVersioningApi', (error, project)=>
			return callback error if error?
			return callback new Error("project_id:#{project_id} does not exist") if !project?
			project_id = project._id
			if project.existsInVersioningApi
				logger.log project_id: project_id, "versioning already enabled"
				return callback()
			logger.log project_id: project_id, "enabling versioning in versioning API"
			@createProject project_id, (error) ->
				return callback error if error?
				logger.log project_id: project_id, "enabling versioning in Mongo"
				project.existsInVersioningApi = true
				update = existsInVersioningApi : true
				conditions = _id:project_id
				Project.update conditions, update, {}, ->
					ProjectEntityHandler.flushProjectToThirdPartyDataStore project_id, (err) ->
						callback(err)
			
	proxyToVersioningApi : (req, res) ->
		metrics.inc "versioning.proxy"
		options =
			url : settings.apis.versioning.url + req.url
			headers : headers
		logger.log url: req.url, "proxying to versioning api"
		getReq = request.get(options)
		getReq.pipe(res)
		getReq.on "error", (error) ->
			logger.error err: error, "versioning API error"
			res.send 500
	
	createProject : (project_id, callback) ->
		url =  "#{settings.apis.versioning.url}/project/#{project_id}"
		options = {method:"post", url:url, headers:headers, title:"createVersioningProject"}
		queue.enqueue project_id, "standardHttpRequest", options, callback

	takeSnapshot: (project_id, message, sl_req_id, callback = (error) ->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		logger.log project_id: project_id, sl_req_id: sl_req_id, "taking snapshot of project"

		# This isn't critical so we can do it async
		rclient.set Keys.buildLastSnapshotKey(project_id), Date.now(), () ->
			rclient.srem Keys.projectsToSnapshotKey, project_id, () ->

		DocumentUpdaterHandler.flushProjectToMongo project_id, sl_req_id, (err) ->
			return callback(err) if err?
			url =  "#{settings.apis.versioning.url}/project/#{project_id}/version"
			json = version:{message:message}
			options = {method:"post", json:json, url:url, headers:headers, title:"takeVersioningSnapshot"}
			queue.enqueue project_id, "standardHttpRequest", options, ->
				logger.log options:options, project_id, "take snapshot enqueued"
				callback()



