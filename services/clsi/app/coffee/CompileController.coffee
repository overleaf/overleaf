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
						if error.timedout
							status = "timedout"
						else
							status = "error"
							code = 500
					else
						status = "failure"
						for file in outputFiles
							if file.path?.match(/output\.pdf$/)
								status = "success"

					timer.done()
					res.send (code or 200), {
						compile:
							status: status
							error:  error?.message or error
							outputFiles: outputFiles.map (file) ->
								url: "#{Settings.apis.clsi.url}/project/#{request.project_id}/output/#{file.path}"
								type: file.type
					}
		
	clearCache: (req, res, next = (error) ->) ->
		ProjectPersistenceManager.clearProject req.params.project_id, (error) ->
			return next(error) if error?
			res.send 204 # No content

	syncFromCode: (req, res, next = (error) ->) ->
		file   = req.query.file
		line   = parseInt(req.query.line, 10)
		column = parseInt(req.query.column, 10)
		project_id = req.params.project_id

		CompileManager.syncFromCode project_id, file, line, column, (error, pdfPositions) ->
			return next(error) if error?
			res.send JSON.stringify {
				pdf: pdfPositions
			}

	syncFromPdf: (req, res, next = (error) ->) ->
		page   = parseInt(req.query.page, 10)
		h      = parseFloat(req.query.h)
		v      = parseFloat(req.query.v)
		project_id = req.params.project_id

		CompileManager.syncFromPdf project_id, page, h, v, (error, codePositions) ->
			return next(error) if error?
			res.send JSON.stringify {
				code: codePositions
			}
