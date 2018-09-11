express = require('express')
logger = require('logger-sharelatex')
logger.initialize("filestore")
settings = require("settings-sharelatex")
request = require("request")
fileController = require("./app/js/FileController")
bucketController = require("./app/js/BucketController")
keyBuilder = require("./app/js/KeyBuilder")
healthCheckController = require("./app/js/HealthCheckController")
domain = require("domain")
appIsOk = true
app = express()

if settings.sentry?.dsn?
	logger.initializeErrorReporting(settings.sentry.dsn)

Metrics = require "metrics-sharelatex"
Metrics.initialize("filestore")
Metrics.open_sockets.monitor(logger)
Metrics.event_loop?.monitor(logger)
Metrics.memory.monitor(logger)

app.configure ->
	app.use Metrics.http.monitor(logger)

app.configure 'development', ->
	console.log "Development Enviroment"
	app.use express.errorHandler({ dumpExceptions: true, showStack: true })

app.configure 'production', ->
	console.log "Production Enviroment"
	app.use express.errorHandler()

Metrics.inc "startup"

app.use (req, res, next)->
	Metrics.inc "http-request"
	next()

app.use (req, res, next) ->
	requestDomain = domain.create()
	requestDomain.add req
	requestDomain.add res
	requestDomain.on "error", (err)->
		try
			# request a shutdown to prevent memory leaks
			beginShutdown()
			if !res.headerSent
				res.send(500, "uncaught exception")
			logger = require('logger-sharelatex')
			req =
				body:req.body
				headers:req.headers
				url:req.url
				key: req.key
				statusCode: req.statusCode
			err =
				message: err.message
				stack: err.stack
				name: err.name
				type: err.type
				arguments: err.arguments
			logger.err err:err, req:req, res:res, "uncaught exception thrown on request"
		catch exception
			logger.err err: exception, "exception in request domain handler"
	requestDomain.run next

app.use (req, res, next) ->
	if not appIsOk
		# when shutting down, close any HTTP keep-alive connections
		res.set 'Connection', 'close'
	next()

app.get  "/project/:project_id/file/:file_id", keyBuilder.userFileKey, fileController.getFile
app.post "/project/:project_id/file/:file_id", keyBuilder.userFileKey, fileController.insertFile

app.put "/project/:project_id/file/:file_id", keyBuilder.userFileKey, express.bodyParser(), fileController.copyFile
app.del "/project/:project_id/file/:file_id", keyBuilder.userFileKey, fileController.deleteFile

app.get  "/template/:template_id/v/:version/:format", keyBuilder.templateFileKey, fileController.getFile
app.get  "/template/:template_id/v/:version/:format/:sub_type", keyBuilder.templateFileKey, fileController.getFile
app.post "/template/:template_id/v/:version/:format", keyBuilder.templateFileKey, fileController.insertFile


app.get  "/project/:project_id/public/:public_file_id", keyBuilder.publicFileKey, fileController.getFile
app.post "/project/:project_id/public/:public_file_id", keyBuilder.publicFileKey, fileController.insertFile

app.put "/project/:project_id/public/:public_file_id", keyBuilder.publicFileKey, express.bodyParser(), fileController.copyFile
app.del "/project/:project_id/public/:public_file_id", keyBuilder.publicFileKey, fileController.deleteFile

app.get "/project/:project_id/size", keyBuilder.publicProjectKey, fileController.directorySize

app.get "/bucket/:bucket/key/*", bucketController.getFile

app.get "/heapdump", (req, res)->
	require('heapdump').writeSnapshot '/tmp/' + Date.now() + '.filestore.heapsnapshot', (err, filename)->
		res.send filename

app.post "/shutdown", (req, res)->
	appIsOk = false
	res.send()

app.get '/status', (req, res)->
	if appIsOk
		res.send('filestore sharelatex up')
	else
		logger.log "app is not ok - shutting down"
		res.send("server is being shut down", 500)


app.get "/health_check", healthCheckController.check


app.get '*', (req, res)->
	res.send 404

server = require('http').createServer(app)
port = settings.internal.filestore.port or 3009
host = settings.internal.filestore.host or "localhost"

beginShutdown = () ->
	if appIsOk
		appIsOk = false
		# hard-terminate this process if graceful shutdown fails
		killTimer = setTimeout () ->
			process.exit 1
		, 120*1000
		killTimer.unref?() # prevent timer from keeping process alive
		server.close () ->
			logger.log "closed all connections"
			Metrics.close()
			process.disconnect?()
		logger.log "server will stop accepting connections"

server.listen port, host, ->
	logger.info "Filestore starting up, listening on #{host}:#{port}"

process.on 'SIGTERM', () ->
	logger.log("filestore got SIGTERM, shutting down gracefully")
	beginShutdown()

if global.gc?
	gcTimer = setInterval () ->
		global.gc()
		logger.log process.memoryUsage(), "global.gc"
	, 3 * oneMinute = 60 * 1000
	gcTimer.unref()
