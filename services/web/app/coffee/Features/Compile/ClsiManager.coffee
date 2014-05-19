Path  = require "path"
async = require "async"
Settings = require "settings-sharelatex"
request = require('request')
Project = require("../../models/Project").Project
ProjectEntityHandler = require("../Project/ProjectEntityHandler")
logger = require "logger-sharelatex"
url = require("url")

module.exports = ClsiManager =
	sendRequest: (project_id, callback = (error, success) ->) ->
		ClsiManager._buildRequest project_id, (error, req) ->
			return callback(error) if error?
			logger.log project_id: project_id, "sending compile to CLSI"
			ClsiManager._postToClsi project_id, req, (error, response) ->
				return callback(error) if error?
				logger.log project_id: project_id, response: response, "received compile response from CLSI"
				callback(
					null
					response?.compile?.status
					ClsiManager._parseOutputFiles(project_id, response?.compile?.outputFiles)
				)

	getLogLines: (project_id, callback = (error, lines) ->) ->
		request "#{Settings.apis.clsi.url}/project/#{project_id}/output/output.log", (error, response, body) ->
			return callback(error) if error?
			callback null, body?.split("\n") or []

	deleteAuxFiles: (project_id, callback = (error) ->) ->
		request.del "#{Settings.apis.clsi.url}/project/#{project_id}", callback

	_postToClsi: (project_id, req, callback = (error, response) ->) ->
		request.post {
			url:  "#{Settings.apis.clsi.url}/project/#{project_id}/compile"
			json: req
			jar:  false
		}, (error, response, body) ->
			return callback(error) if error?
			if 200 <= response.statusCode < 300
				callback null, body
			else
				error = new Error("CLSI returned non-success code: #{response.statusCode}")
				logger.error err: error, project_id: project_id, "CLSI returned failure code"
				callback error, body

	_parseOutputFiles: (project_id, rawOutputFiles = []) ->
		outputFiles = []
		for file in rawOutputFiles
			outputFiles.push
				path: url.parse(file.url).path.replace("/project/#{project_id}/output/", "")
				type: file.type
		return outputFiles

	VALID_COMPILERS: ["pdflatex", "latex", "xelatex", "lualatex"]
	_buildRequest: (project_id, callback = (error, request) ->) ->
		Project.findById project_id, {compiler: 1, rootDoc_id: 1}, (error, project) ->
			return callback(error) if error?
			return callback(new Errors.NotFoundError("project does not exist: #{project_id}")) if !project?

			if project.compiler not in ClsiManager.VALID_COMPILERS
				project.compiler = "pdflatex"

			ProjectEntityHandler.getAllDocs project_id, (error, docs = {}) ->
				return callback(error) if error?
				ProjectEntityHandler.getAllFiles project_id, (error, files = {}) ->
					return callback(error) if error?

					resources = []
					rootResourcePath = null

					for path, doc of docs
						path = path.replace(/^\//, "") # Remove leading /
						resources.push
							path:    path
							content: doc.lines.join("\n")
						if project.rootDoc_id? and doc._id.toString() == project.rootDoc_id.toString()
							rootResourcePath = path

					for path, file of files
						path = path.replace(/^\//, "") # Remove leading /
						resources.push
							path:     path
							url:      "#{Settings.apis.filestore.url}/project/#{project._id}/file/#{file._id}"
							modified: file.created?.getTime()

					if !rootResourcePath?
						callback new Error("no root document exists")
					else
						callback null, {
							compile:
								options:
									compiler: project.compiler
								rootResourcePath: rootResourcePath
								resources: resources
						}
		
