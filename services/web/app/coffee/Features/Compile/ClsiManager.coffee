Path  = require "path"
async = require "async"
Settings = require "settings-sharelatex"
request = require('request')
Project = require("../../models/Project").Project
logger = require "logger-sharelatex"
url = require("url")

module.exports = ClsiManager =
	sendRequest: (project_id, callback = (error, success) ->) ->
		Project.findById project_id, (error, project) ->
			return callback(error) if error?
			ClsiManager._buildRequest project, (error, req) ->
				return callback(error) if error?
				logger.log project_id: project_id, "sending compile to CLSI"
				ClsiManager._postToClsi project_id, req, (error, response) ->
					return callback(error) if error?
					logger.log project_id: project_id, response: response, "received compile response from CLSI"
					callback(
						null
						(response?.compile?.status == "success")
						ClsiManager._parseOutputFiles(project_id, response?.compile?.outputFiles)
					)

	getLogLines: (project_id, callback = (error, lines) ->) ->
		request "#{Settings.apis.clsi.url}/project/#{project_id}/output/output.log", (error, response, body) ->
			return callback(error) if error?
			callback null, body?.split("\n") or []

	_postToClsi: (project_id, req, callback = (error, response) ->) ->
		request.post {
			url:  "#{Settings.apis.clsi.url}/project/#{project_id}/compile"
			json: req
			jar:  false
		}, (error, response, body) ->
			callback error, body

	_parseOutputFiles: (project_id, rawOutputFiles = []) ->
		outputFiles = []
		for file in rawOutputFiles
			outputFiles.push
				path: url.parse(file.url).path.replace("/project/#{project_id}/output/", "")
				type: file.type
		return outputFiles

	VALID_COMPILERS: ["pdflatex", "latex", "xelatex", "lualatex"]
	_buildRequest: (project, callback = (error, request) ->) ->
		if project.compiler not in @VALID_COMPILERS
			project.compiler = "pdflatex"

		resources = []
		rootResourcePath = null

		addDoc = (basePath, doc, callback = (error) ->) ->
			path = Path.join(basePath, doc.name)
			resources.push
				path:    path
				content: doc.lines.join("\n")
			if doc._id.toString() == project.rootDoc_id.toString()
				rootResourcePath = path
			callback()

		addFile = (basePath, file, callback = (error) ->) ->
			resources.push
				path:     Path.join(basePath, file.name)
				url:      "#{Settings.apis.filestore.url}/project/#{project._id}/file/#{file._id}"
				modified: file.created?.getTime()
			callback()

		addFolder = (basePath, folder, callback = (error) ->) ->
			jobs = []
			for doc in folder.docs
				do (doc) ->
					jobs.push (callback) -> addDoc(basePath, doc, callback)

			for file in folder.fileRefs
				do (file) ->
					jobs.push (callback) -> addFile(basePath, file, callback)

			for childFolder in folder.folders
				do (childFolder) ->
					jobs.push (callback) -> addFolder(Path.join(basePath, childFolder.name), childFolder, callback)

			async.series jobs, callback

		addFolder "", project.rootFolder[0], (error) ->
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
		
