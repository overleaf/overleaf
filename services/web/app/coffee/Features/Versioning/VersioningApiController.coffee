versioningApiHandler = require './VersioningApiHandler'
metrics = require('../../infrastructure/Metrics')

module.exports =
	enableVersioning: (project_id, callback)->
		metrics.inc "versioning.enableVersioning"
		versioningApiHandler.enableVersioning project_id, callback

	listVersions : (req, res) ->
		metrics.inc "versioning.listVersions"
		versioningApiHandler.proxyToVersioningApi(req, res)
	
	getVersion : (req, res) ->
		metrics.inc "versioning.getVersion"
		versioningApiHandler.proxyToVersioningApi(req, res)
	
	getVersionFile : (req, res) ->
		metrics.inc "versioning.getVersionFile"
		versioningApiHandler.proxyToVersioningApi(req, res)
	
	takeSnapshot: (req, res, next) ->
		metrics.inc "versioning.takeSnapshot"
		if req.body? and req.body.message? and req.body.message.length > 0
			message = req.body.message
		else
			message = "Manual snapshot"
		versioningApiHandler.takeSnapshot req.params.Project_id, message, (error) ->
			if error?
				next(error)
			else
				res.send(200, "{}")
