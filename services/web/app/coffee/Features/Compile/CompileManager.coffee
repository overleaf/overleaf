Settings = require('settings-sharelatex')
redis = require('redis')
rclient = redis.createClient(Settings.redis.web.port, Settings.redis.web.host)
rclient.auth(Settings.redis.web.password)
DocumentUpdaterHandler = require "../DocumentUpdater/DocumentUpdaterHandler"
Project = require("../../models/Project").Project
ProjectRootDocManager = require "../Project/ProjectRootDocManager"
ClsiManager = require "./ClsiManager"
Metrics = require('../../infrastructure/Metrics')
logger = require("logger-sharelatex")
rateLimiter = require("../../infrastructure/RateLimiter")

module.exports = CompileManager =
	compile: (project_id, user_id, opt = {}, _callback = (error) ->) ->
		timer = new Metrics.Timer("editor.compile")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		@_checkIfAutoCompileLimitHasBeenHit opt.isAutoCompile, (err, canCompile)->
			if !canCompile
				return callback null, "autocompile-backoff", []
			logger.log project_id: project_id, user_id: user_id, "compiling project"
			CompileManager._checkIfRecentlyCompiled project_id, user_id, (error, recentlyCompiled) ->
				return callback(error) if error?
				if recentlyCompiled
					return callback new Error("project was recently compiled so not continuing")

				CompileManager._ensureRootDocumentIsSet project_id, (error) ->
					return callback(error) if error?
					DocumentUpdaterHandler.flushProjectToMongo project_id, (error) ->
						return callback(error) if error?
						ClsiManager.sendRequest project_id, (error, status, outputFiles) ->
							return callback(error) if error?
							logger.log files: outputFiles, "output files"
							callback(null, status, outputFiles)


	getLogLines: (project_id, callback)->
		Metrics.inc "editor.raw-logs"
		ClsiManager.getLogLines project_id, (error, logLines)->
			return callback(error) if error?
			callback null, logLines

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
			timeInterval:15
			subjectName:"everyone"
			throttle: 10
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
		
