Settings = require('settings-sharelatex')

redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.web)

DocumentUpdaterHandler = require "../DocumentUpdater/DocumentUpdaterHandler"
Project = require("../../models/Project").Project
ProjectRootDocManager = require "../Project/ProjectRootDocManager"
UserGetter = require "../User/UserGetter"
ClsiManager = require "./ClsiManager"
Metrics = require('../../infrastructure/Metrics')
logger = require("logger-sharelatex")
rateLimiter = require("../../infrastructure/RateLimiter")

module.exports = CompileManager =
	compile: (project_id, user_id, options = {}, _callback = (error) ->) ->
		timer = new Metrics.Timer("editor.compile")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		@_checkIfAutoCompileLimitHasBeenHit options.isAutoCompile, (err, canCompile)->
			if !canCompile
				return callback null, "autocompile-backoff", []
			logger.log project_id: project_id, user_id: user_id, "compiling project"
			CompileManager._checkIfRecentlyCompiled project_id, user_id, (error, recentlyCompiled) ->
				return callback(error) if error?
				if recentlyCompiled
					logger.warn {project_id, user_id}, "project was recently compiled so not continuing"
					return callback null, "too-recently-compiled", []
				
				CompileManager._ensureRootDocumentIsSet project_id, (error) ->
					return callback(error) if error?
					DocumentUpdaterHandler.flushProjectToMongo project_id, (error) ->
						return callback(error) if error?
						CompileManager.getProjectCompileLimits project_id, (error, limits) ->
							return callback(error) if error?
							for key, value of limits
								options[key] = value
							ClsiManager.sendRequest project_id, options, (error, status, outputFiles, output) ->
								return callback(error) if error?
								logger.log files: outputFiles, "output files"
								callback(null, status, outputFiles, output, limits)
								
	deleteAuxFiles: (project_id, callback = (error) ->) ->
		CompileManager.getProjectCompileLimits project_id, (error, limits) ->
			return callback(error) if error?
			ClsiManager.deleteAuxFiles project_id, limits, callback

	getProjectCompileLimits: (project_id, callback = (error, limits) ->) ->
		Project.findById project_id, {owner_ref: 1}, (error, project) ->
			return callback(error) if error?
			UserGetter.getUser project.owner_ref, {"features":1}, (err, owner)->
				return callback(error) if error?
				callback null, {
					timeout: owner.features?.compileTimeout || Settings.defaultFeatures.compileTimeout
					compileGroup: owner.features?.compileGroup || Settings.defaultFeatures.compileGroup
				}

	COMPILE_DELAY: 1 # seconds
	_checkIfRecentlyCompiled: (project_id, user_id, callback = (error, recentlyCompiled) ->) ->
		key = "compile:#{project_id}:#{user_id}"
		rclient.set key, true, "EX", @COMPILE_DELAY, "NX", (error, ok) ->
			return callback(error) if error?
			if ok == "OK"
				return callback null, false
			else
				return callback null, true

	_checkIfAutoCompileLimitHasBeenHit: (isAutoCompile, callback = (err, canCompile)->)->
		if !isAutoCompile
			return callback(null, true)
		opts = 
			endpointName:"auto_compile"
			timeInterval:20
			subjectName:"everyone"
			throttle: 25
		rateLimiter.addCount opts, (err, canCompile)->
			if err?
				canCompile = false
			logger.log canCompile:canCompile, opts:opts, "checking if auto compile limit has been hit"
			callback err, canCompile

	_ensureRootDocumentIsSet: (project_id, callback = (error) ->) ->
		Project.findById project_id, 'rootDoc_id', (error, project)=>
			return callback(error) if error?
			if !project?
				return callback new Error("project not found")

			if project.rootDoc_id?
				callback()
			else
				ProjectRootDocManager.setRootDocAutomatically project_id, callback
		
	wordCount: (project_id, file, callback = (error) ->) ->
		CompileManager.getProjectCompileLimits project_id, (error, limits) ->
			return callback(error) if error?
			ClsiManager.wordCount project_id, file, limits, callback
