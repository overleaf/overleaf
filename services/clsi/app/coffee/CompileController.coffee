RequestParser = require "./RequestParser"
CompileManager = require "./CompileManager"
Settings = require "settings-sharelatex"
Metrics = require "./Metrics"
ProjectPersistenceManager = require "./ProjectPersistenceManager"
logger = require "logger-sharelatex"

module.exports = CompileController =
	compile: (req, res, next = (error) ->) ->
		timer = new Metrics.Timer("compile-request")
		RequestParser.parse req.body, (error, request) ->
			return next(error) if error?
			request.project_id = req.params.project_id
			ProjectPersistenceManager.markProjectAsJustAccessed request.project_id, (error) ->
				return next(error) if error?
				CompileManager.doCompile request, (error, outputFiles = []) ->
					if error?
						logger.error err: error, project_id: request.project_id, "error running compile"
						error = error.message or error
						status = "failure"
					else
						status = "failure"
						for file in outputFiles
							if file.type == "pdf"
								status = "success"

					timer.done()
					res.send JSON.stringify {
						compile:
							status: status
							error:  error
							outputFiles: outputFiles.map (file) ->
								url: "#{Settings.apis.clsi.url}/project/#{request.project_id}/output/#{file.path}"
								type: file.type
					}
		
	clearCache: (req, res, next = (error) ->) ->
		ProjectPersistenceManager.clearProject req.params.project_id, (error) ->
			return next(error) if error?
			res.send 204 # No content
