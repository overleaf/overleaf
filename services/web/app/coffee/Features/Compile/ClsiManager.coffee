Path  = require "path"
async = require "async"
Settings = require "settings-sharelatex"
request = require('request')
Project = require("../../models/Project").Project
ProjectEntityHandler = require("../Project/ProjectEntityHandler")
logger = require "logger-sharelatex"
Url = require("url")
ClsiCookieManager = require("./ClsiCookieManager")
_ = require("underscore")
async = require("async")
ClsiFormatChecker = require("./ClsiFormatChecker")

module.exports = ClsiManager =

	sendRequest: (project_id, user_id, options = {}, callback = (error, status, outputFiles, clsiServerId, validationProblems) ->) ->
		ClsiManager._buildRequest project_id, options, (error, req) ->
			return callback(error) if error?
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
				logger.log project_id: project_id, outputFilesLength: response?.outputFiles?.length, status: response?.status, "received compile response from CLSI"
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
		ClsiManager._makeRequest project_id, opts, callback

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
		Project.findById project_id, {compiler: 1, rootDoc_id: 1, imageName: 1}, (error, project) ->
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
					rootResourcePathOverride = null

					for path, doc of docs
						path = path.replace(/^\//, "") # Remove leading /
						resources.push
							path:    path
							content: doc.lines.join("\n")
						if project.rootDoc_id? and doc._id.toString() == project.rootDoc_id.toString()
							rootResourcePath = path
						if options.rootDoc_id? and doc._id.toString() == options.rootDoc_id.toString()
							rootResourcePathOverride = path

					rootResourcePath = rootResourcePathOverride if rootResourcePathOverride?
					if !rootResourcePath?
						logger.warn {project_id}, "no root document found, setting to main.tex"
						rootResourcePath = "main.tex"

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

