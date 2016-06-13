Metrics = require "../../infrastructure/Metrics"
Project = require("../../models/Project").Project
CompileManager = require("./CompileManager")
ClsiManager = require("./ClsiManager")
logger  = require "logger-sharelatex"
request = require "request"
Settings = require "settings-sharelatex"
AuthenticationController = require "../Authentication/AuthenticationController"
UserGetter = require "../User/UserGetter"
RateLimiter = require("../../infrastructure/RateLimiter")
ClsiCookieManager = require("./ClsiCookieManager")
Path = require("path")

module.exports = CompileController =
	compile: (req, res, next = (error) ->) ->
		res.setTimeout(5 * 60 * 1000)
		project_id = req.params.Project_id
		isAutoCompile = !!req.query?.auto_compile
		AuthenticationController.getLoggedInUserId req, (error, user_id) ->
			return next(error) if error?
			options = {
				isAutoCompile: isAutoCompile
			}
			if req.body?.rootDoc_id?
				options.rootDoc_id = req.body.rootDoc_id
			else if req.body?.settingsOverride?.rootDoc_id? # Can be removed after deploy
				options.rootDoc_id = req.body.settingsOverride.rootDoc_id
			if req.body?.compiler
				options.compiler = req.body.compiler
			if req.body?.draft
				options.draft = req.body.draft
			if req.query?.isolated is "true"
				options.isolated = true
			logger.log {options:options, project_id:project_id, user_id:user_id}, "got compile request"
			CompileManager.compile project_id, user_id, options, (error, status, outputFiles, clsiServerId, limits, validationProblems) ->
				return next(error) if error?
				res.contentType("application/json")
				res.status(200).send JSON.stringify {
					status: status
					outputFiles: outputFiles
					compileGroup: limits?.compileGroup
					clsiServerId:clsiServerId
					validationProblems:validationProblems
				}

	_compileAsUser: (req, callback) ->
		isolated = req.query?.isolated is "true"
		if isolated
			AuthenticationController.getLoggedInUserId req, callback
		else
			callback()

	downloadPdf: (req, res, next = (error) ->)->
		Metrics.inc "pdf-downloads"
		project_id = req.params.Project_id
		isPdfjsPartialDownload = req.query?.pdfng
		rateLimit = (callback)->
			if isPdfjsPartialDownload
				callback null, true
			else
				rateLimitOpts =
					endpointName: "full-pdf-download"
					throttle: 1000
					subjectName : req.ip
					timeInterval : 60 * 60
				RateLimiter.addCount rateLimitOpts, callback

		Project.findById project_id, {name: 1}, (err, project)->
			res.contentType("application/pdf")
			if !!req.query.popupDownload
				logger.log project_id: project_id, "download pdf as popup download"
				res.header('Content-Disposition', "attachment; filename=#{project.getSafeProjectName()}.pdf")
			else
				logger.log project_id: project_id, "download pdf to embed in browser"
				res.header('Content-Disposition', "filename=#{project.getSafeProjectName()}.pdf")

			rateLimit (err, canContinue)->
				if err?
					logger.err err:err, "error checking rate limit for pdf download"
					return res.send 500
				else if !canContinue
					logger.log project_id:project_id, ip:req.ip, "rate limit hit downloading pdf"
					res.send 500
				else
					CompileController.proxyToClsi(project_id, "/project/#{project_id}/output/output.pdf", req, res, next)

	deleteAuxFiles: (req, res, next) ->
		project_id = req.params.Project_id
		CompileController._compileAsUser req, (error, user_id) ->
			return next(error) if error?
			CompileManager.deleteAuxFiles project_id, user_id, (error) ->
				return next(error) if error?
				res.sendStatus(200)

	compileAndDownloadPdf: (req, res, next)->
		project_id = req.params.project_id
		CompileController._compileAsUser req, (error, user_id) ->
			return next(error) if error?
			CompileManager.compile project_id, user_id, {}, (err)->
				if err?
					logger.err err:err, project_id:project_id, "something went wrong compile and downloading pdf"
					res.sendStatus 500
				url = "/project/#{project_id}/output/output.pdf"
				CompileController.proxyToClsi project_id, user_id, url, req, res, next

	getFileFromClsi: (req, res, next = (error) ->) ->
		project_id = req.params.Project_id
		build_id = req.params.build_id
		user_id = req.params.user_id
		if user_id? and build_id?
			url = "/project/#{project_id}/user/#{user_id}/build/#{build_id}/output/#{req.params.file}"
		else if build_id?
			url = "/project/#{project_id}/build/#{build_id}/output/#{req.params.file}"
		else
			url = "/project/#{project_id}/output/#{req.params.file}"
		CompileController.proxyToClsi(project_id, url, req, res, next)

	_getUrl: (project_id, user_id, action) ->
		path = "/project/#{project_id}"
		path += "/user/#{user_id}" if user_id?
		return "#{path}/#{action}"

	proxySyncPdf: (req, res, next = (error) ->) ->
		project_id = req.params.Project_id
		{page, h, v} = req.query
		if not page?.match(/^\d+$/)
			return next(new Error("invalid page parameter"))
		if not h?.match(/^\d+\.\d+$/)
			return next(new Error("invalid h parameter"))
		if not v?.match(/^\d+\.\d+$/)
			return next(new Error("invalid v parameter"))
		url = CompileController._getUrl(project_id, user_id, "sync/pdf")
		destination = {url: url, qs: {page, h, v}}
		# whether this request is going to a per-user container
		CompileController._compileAsUser req, (error, user_id) ->
			return next(error) if error?
			CompileController.proxyToClsi(project_id, destination, req, res, next)

	proxySyncCode: (req, res, next = (error) ->) ->
		project_id = req.params.Project_id
		{file, line, column} = req.query
		if not file? or Path.resolve("/", file) isnt "/#{file}"
			return next(new Error("invalid file parameter"))
		if not line?.match(/^\d+$/)
			return next(new Error("invalid line parameter"))
		if not column?.match(/^\d+$/)
			return next(new Error("invalid column parameter"))
		url = CompileController._getUrl(project_id, user_id, "sync/code")
		destination = {url:url, qs: {file, line, column}}
		CompileController._compileAsUser req, (error, user_id) ->
			return next(error) if error?
			CompileController.proxyToClsi(project_id, destination, req, res, next)

	proxyToClsi: (project_id, url, req, res, next = (error) ->) ->
		if req.query?.compileGroup
			CompileController.proxyToClsiWithLimits(project_id, url, {compileGroup: req.query.compileGroup}, req, res, next)
		else
			CompileManager.getProjectCompileLimits project_id, (error, limits) ->
				return next(error) if error?
				CompileController.proxyToClsiWithLimits(project_id, url, limits, req, res, next)

	proxyToClsiWithLimits: (project_id, url, limits, req, res, next = (error) ->) ->
		ClsiCookieManager.getCookieJar project_id, (err, jar)->
			if err?
				logger.err err:err, "error getting cookie jar for clsi request"
				return callback(err)
			# expand any url parameter passed in as {url:..., qs:...}
			if typeof url is "object"
				{url, qs} = url
			compilerUrl = Settings.apis.clsi.url
			url = "#{compilerUrl}#{url}"
			logger.log url: url, "proxying to CLSI"
			oneMinute = 60 * 1000
			# the base request
			options = { url: url, method: req.method, timeout: oneMinute, jar : jar }
			# add any provided query string
			options.qs = qs if qs?
			# if we have a build parameter, pass it through to the clsi
			if req.query?.pdfng && req.query?.build? # only for new pdf viewer
				options.qs ?= {}
				options.qs.build = req.query.build
			# if we are byte serving pdfs, pass through If-* and Range headers
			# do not send any others, there's a proxying loop if Host: is passed!
			if req.query?.pdfng
				newHeaders = {}
				for h, v of req.headers
					newHeaders[h] = req.headers[h] if h.match /^(If-|Range)/i
				options.headers = newHeaders
			proxy = request(options)
			proxy.pipe(res)
			proxy.on "error", (error) ->
				logger.warn err: error, url: url, "CLSI proxy error"

	wordCount: (req, res, next) ->
		project_id = req.params.Project_id
		file   = req.query.file || false
		CompileController._compileAsUser req, (error, user_id) ->
			return next(error) if error?
			CompileManager.wordCount project_id, user_id, file, (error, body) ->
				return next(error) if error?
				res.contentType("application/json")
				res.send body
