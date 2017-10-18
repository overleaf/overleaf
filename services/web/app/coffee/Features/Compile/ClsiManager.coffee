Path  = require "path"
async = require "async"
Settings = require "settings-sharelatex"
request = require('request')
Project = require("../../models/Project").Project
ProjectGetter = require("../Project/ProjectGetter")
ProjectEntityHandler = require("../Project/ProjectEntityHandler")
logger = require "logger-sharelatex"
Url = require("url")
ClsiCookieManager = require("./ClsiCookieManager")
ClsiStateManager = require("./ClsiStateManager")
_ = require("underscore")
async = require("async")
ClsiFormatChecker = require("./ClsiFormatChecker")
DocumentUpdaterHandler = require "../DocumentUpdater/DocumentUpdaterHandler"
Metrics = require('metrics-sharelatex')

module.exports = ClsiManager =

	sendRequest: (project_id, user_id, options = {}, callback) ->
		ClsiManager.sendRequestOnce project_id, user_id, options, (error, status, result...) ->
			return callback(error) if error?
			if status is 'conflict'
				options = _.clone(options)
				options.syncType = "full" #  force full compile
				ClsiManager.sendRequestOnce project_id, user_id, options, callback # try again
			else
				callback(error, status, result...)

	sendRequestOnce: (project_id, user_id, options = {}, callback = (error, status, outputFiles, clsiServerId, validationProblems) ->) ->
		ClsiManager._buildRequest project_id, options, (error, req) ->
			if error?
				if error.message is "no main file specified"
					return callback(null, "validation-problems", null, null, {mainFile:error.message})
				else
					return callback(error)
			logger.log project_id: project_id, "sending compile to CLSI"
			ClsiFormatChecker.checkRecoursesForProblems req.compile?.resources, (err, validationProblems)->
				if err?
					logger.err err, project_id, "could not check resources for potential problems before sending to clsi"
					return callback(err)
				if validationProblems?
					logger.log project_id:project_id, validationProblems:validationProblems, "problems with users latex before compile was attempted"
					return callback(null, "validation-problems", null, null, validationProblems)
				ClsiManager._postToClsi project_id, user_id, req, options.compileGroup, (error, response) ->
					if error?
						logger.err err:error, project_id:project_id, "error sending request to clsi"
						return callback(error)
					logger.log project_id: project_id, outputFilesLength: response?.outputFiles?.length, status: response?.status, compile_status: response?.compile?.status, "received compile response from CLSI"
					ClsiCookieManager._getServerId project_id, (err, clsiServerId)->
						if err?
							logger.err err:err, project_id:project_id, "error getting server id"
							return callback(err)
						outputFiles = ClsiManager._parseOutputFiles(project_id, response?.compile?.outputFiles)
						callback(null, response?.compile?.status, outputFiles, clsiServerId)

	stopCompile: (project_id, user_id, options, callback = (error) ->) ->
		compilerUrl = @_getCompilerUrl(options?.compileGroup, project_id, user_id, "compile/stop")
		opts =
			url:compilerUrl
			method:"POST"
		ClsiManager._makeRequest project_id, opts, callback

	deleteAuxFiles: (project_id, user_id, options, callback = (error) ->) ->
		compilerUrl = @_getCompilerUrl(options?.compileGroup, project_id, user_id)
		opts =
			url:compilerUrl
			method:"DELETE"
		ClsiManager._makeRequest project_id, opts, (clsiError) ->
			# always clear the project state from the docupdater, even if there
			# was a problem with the request to the clsi
			DocumentUpdaterHandler.clearProjectState project_id, (docUpdaterError) ->
				error = clsiError or docUpdaterError
				return callback(error) if error?
				callback()

	_makeRequest: (project_id, opts, callback)->
		ClsiCookieManager.getCookieJar project_id, (err, jar)->
			if err?
				logger.err err:err, "error getting cookie jar for clsi request"
				return callback(err)
			opts.jar = jar
			request opts, (err, response, body)->
				if err?
					logger.err err:err, project_id:project_id, url:opts?.url, "error making request to clsi"
					return callback(err)
				ClsiCookieManager.setServerId project_id, response, (err)->
					if err?
						logger.warn err:err, project_id:project_id, "error setting server id"
						
					return callback err, response, body

	_getCompilerUrl: (compileGroup, project_id, user_id, action) ->
		host = Settings.apis.clsi.url
		path = "/project/#{project_id}"
		path += "/user/#{user_id}" if user_id?
		path += "/#{action}" if action?
		return "#{host}#{path}"

	_postToClsi: (project_id, user_id, req, compileGroup, callback = (error, response) ->) ->
		compileUrl = @_getCompilerUrl(compileGroup, project_id, user_id, "compile")
		opts =
			url:  compileUrl
			json: req
			method: "POST"
		ClsiManager._makeRequest project_id, opts, (error, response, body) ->
			return callback(error) if error?
			if 200 <= response.statusCode < 300
				callback null, body
			else if response.statusCode == 413
				callback null, compile:status:"project-too-large"
			else if response.statusCode == 409
				callback null, compile:status:"conflict"
			else if response.statusCode == 423
				callback null, compile:status:"compile-in-progress"
			else
				error = new Error("CLSI returned non-success code: #{response.statusCode}")
				logger.error err: error, project_id: project_id, "CLSI returned failure code"
				callback error, body

	_parseOutputFiles: (project_id, rawOutputFiles = []) ->
		outputFiles = []
		for file in rawOutputFiles
			outputFiles.push
				path: file.path # the clsi is now sending this to web
				url: Url.parse(file.url).path # the location of the file on the clsi, excluding the host part
				type: file.type
				build: file.build
		return outputFiles

	VALID_COMPILERS: ["pdflatex", "latex", "xelatex", "lualatex"]

	_buildRequest: (project_id, options={}, callback = (error, request) ->) ->
		ProjectGetter.getProject project_id, {compiler: 1, rootDoc_id: 1, imageName: 1, rootFolder:1}, (error, project) ->
			return callback(error) if error?
			return callback(new Errors.NotFoundError("project does not exist: #{project_id}")) if !project?
			if project.compiler not in ClsiManager.VALID_COMPILERS
				project.compiler = "pdflatex"

			if options.incrementalCompilesEnabled or options.syncType? # new way, either incremental or full
				timer = new Metrics.Timer("editor.compile-getdocs-redis")
				ClsiManager.getContentFromDocUpdaterIfMatch project_id, project, options, (error, projectStateHash, docUpdaterDocs) ->
					timer.done()
					if error?
						logger.error err: error, project_id: project_id, "error checking project state"
						# note: we don't bail out when there's an error getting
						# incremental files from the docupdater, we just fall back
						# to a normal compile below
					else
						logger.log project_id: project_id, projectStateHash: projectStateHash, docs: docUpdaterDocs?, "checked project state"
					# see if we can send an incremental update to the CLSI
					if docUpdaterDocs? and (options.syncType isnt "full") and not error?
						Metrics.inc "compile-from-redis"
						ClsiManager._buildRequestFromDocupdater project_id, options, project, projectStateHash, docUpdaterDocs, callback
					else
						Metrics.inc "compile-from-mongo"
						ClsiManager._buildRequestFromMongo project_id, options, project, projectStateHash, callback
			else # old way, always from mongo
				timer = new Metrics.Timer("editor.compile-getdocs-mongo")
				ClsiManager._getContentFromMongo project_id, (error, docs, files) ->
					timer.done()
					return callback(error) if error?
					ClsiManager._finaliseRequest project_id, options, project, docs, files, callback

	getContentFromDocUpdaterIfMatch: (project_id, project, options, callback = (error, projectStateHash, docs) ->) ->
		ClsiStateManager.computeHash project, options, (error, projectStateHash) ->
			return callback(error) if error?
			DocumentUpdaterHandler.getProjectDocsIfMatch project_id, projectStateHash, (error, docs) ->
				return callback(error) if error?
				callback(null, projectStateHash, docs)

	_buildRequestFromDocupdater: (project_id, options, project, projectStateHash, docUpdaterDocs, callback = (error, request) ->) ->
		ProjectEntityHandler.getAllDocPathsFromProject project, (error, docPath) ->
				return callback(error) if error?
				docs = {}
				for doc in docUpdaterDocs or []
					path = docPath[doc._id]
					docs[path] = doc
				# send new docs but not files as those are already on the clsi
				options = _.clone(options)
				options.syncType = "incremental"
				options.syncState = projectStateHash
				# create stub doc entries for any possible root docs, if not
				# present in the docupdater. This allows finaliseRequest to
				# identify the root doc.
				possibleRootDocIds = [options.rootDoc_id, project.rootDoc_id]
				for rootDoc_id in possibleRootDocIds when rootDoc_id? and rootDoc_id of docPath
					path = docPath[rootDoc_id]
					docs[path] ?= {_id: rootDoc_id, path: path}
				ClsiManager._finaliseRequest project_id, options, project, docs, [], callback

	_buildRequestFromMongo: (project_id, options, project, projectStateHash, callback = (error, request) ->) ->
		ClsiManager._getContentFromMongo project_id, (error, docs, files) ->
			return callback(error) if error?
			options = _.clone(options)
			options.syncType = "full"
			options.syncState = projectStateHash
			ClsiManager._finaliseRequest project_id, options, project, docs, files, callback

	_getContentFromMongo: (project_id, callback = (error, docs, files) ->) ->
		DocumentUpdaterHandler.flushProjectToMongo project_id, (error) ->
			return callback(error) if error?
			ProjectEntityHandler.getAllDocs project_id, (error, docs = {}) ->
				return callback(error) if error?
				ProjectEntityHandler.getAllFiles project_id, (error, files = {}) ->
					return callback(error) if error?
					callback(null, docs, files)

	_finaliseRequest: (project_id, options, project, docs, files, callback = (error, params) -> ) ->
		resources = []
		rootResourcePath = null
		rootResourcePathOverride = null
		hasMainFile = false
		numberOfDocsInProject = 0

		for path, doc of docs
			path = path.replace(/^\//, "") # Remove leading /
			numberOfDocsInProject++
			if doc.lines? # add doc to resources unless it is just a stub entry
				resources.push
					path:    path
					content: doc.lines.join("\n")
			if project.rootDoc_id? and doc._id.toString() == project.rootDoc_id.toString()
				rootResourcePath = path
			if options.rootDoc_id? and doc._id.toString() == options.rootDoc_id.toString()
				rootResourcePathOverride = path
			if path is "main.tex"
				hasMainFile = true

		rootResourcePath = rootResourcePathOverride if rootResourcePathOverride?
		if !rootResourcePath?
			if hasMainFile
				logger.warn {project_id}, "no root document found, setting to main.tex"
				rootResourcePath = "main.tex"
			else if numberOfDocsInProject is 1 # only one file, must be the main document
				for path, doc of docs
					rootResourcePath = path.replace(/^\//, "") # Remove leading /
				logger.warn {project_id, rootResourcePath: rootResourcePath}, "no root document found, single document in project"
			else
				return callback new Error("no main file specified")

		for path, file of files
			path = path.replace(/^\//, "") # Remove leading /
			resources.push
				path:     path
				url:      "#{Settings.apis.filestore.url}/project/#{project._id}/file/#{file._id}"
				modified: file.created?.getTime()

		callback null, {
			compile:
				options:
					compiler: project.compiler
					timeout: options.timeout
					imageName: project.imageName
					draft: !!options.draft
					check: options.check
					syncType: options.syncType
					syncState: options.syncState
				rootResourcePath: rootResourcePath
				resources: resources
		}

	wordCount: (project_id, user_id, file, options, callback = (error, response) ->) ->
		ClsiManager._buildRequest project_id, options, (error, req) ->
			filename = file || req?.compile?.rootResourcePath
			wordcount_url = ClsiManager._getCompilerUrl(options?.compileGroup, project_id, user_id, "wordcount")
			opts =
				url: wordcount_url
				qs:
					file: filename
					image: req.compile.options.imageName
				method: "GET"
			ClsiManager._makeRequest project_id, opts, (error, response, body) ->
				return callback(error) if error?
				if 200 <= response.statusCode < 300
					callback null, body
				else
					error = new Error("CLSI returned non-success code: #{response.statusCode}")
					logger.error err: error, project_id: project_id, "CLSI returned failure code"
					callback error, body

