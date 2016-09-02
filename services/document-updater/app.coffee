express = require('express')
http = require("http")
Settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
logger.initialize("documentupdater")
RedisManager = require('./app/js/RedisManager')
DispatchManager = require('./app/js/DispatchManager')
Keys = require('./app/js/RedisKeyBuilder')
Errors = require "./app/js/Errors"
HttpController = require "./app/js/HttpController"
MongoHealthCheck = require('./app/js/MongoHealthCheck')

redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.web)


Path = require "path"
Metrics = require "metrics-sharelatex"
Metrics.initialize("doc-updater")
Metrics.mongodb.monitor(Path.resolve(__dirname + "/node_modules/mongojs/node_modules/mongodb"), logger)

app = express()
app.configure ->
	app.use(Metrics.http.monitor(logger));
	app.use express.bodyParser()
	app.use app.router

DispatchManager.createAndStartDispatchers(Settings.dispatcherCount || 10)

app.param 'project_id', (req, res, next, project_id) ->
	if project_id?.match /^[0-9a-f]{24}$/
		next()
	else
		next new Error("invalid project id")

app.param 'doc_id', (req, res, next, doc_id) ->
	if doc_id?.match /^[0-9a-f]{24}$/
		next()
	else
		next new Error("invalid doc id")

app.get    '/project/:project_id/doc/:doc_id',       HttpController.getDoc
app.post   '/project/:project_id/doc/:doc_id',       HttpController.setDoc
app.post   '/project/:project_id/doc/:doc_id/flush', HttpController.flushDocIfLoaded
app.delete '/project/:project_id/doc/:doc_id',       HttpController.flushAndDeleteDoc
app.delete '/project/:project_id',                   HttpController.deleteProject
app.post   '/project/:project_id/flush',             HttpController.flushProject

app.get '/total', (req, res)->
	timer = new Metrics.Timer("http.allDocList")	
	RedisManager.getCountOfDocsInMemory (err, count)->
		timer.done()
		res.send {total:count}
	
app.get '/status', (req, res)->
	if Settings.shuttingDown
		res.send 503 # Service unavailable
	else
		res.send('document updater is alive')

app.get '/health_check/mongo', (req, res, next) ->
	MongoHealthCheck.isAlive (error) ->
		if error?
			res.send 500, error.message
		else
			res.send 200

redisCheck = require("redis-sharelatex").activeHealthCheckRedis(Settings.redis.web)
app.get "/health_check/redis", (req, res, next)->
	if redisCheck.isAlive()
		res.send 200
	else
		res.send 500

app.get "/health_check/redis_cluster", (req, res, next) ->
	RedisManager.rclient.healthCheck (error, alive) ->
		if error?
			logger.err {err: error}, "failed redis cluster health check"
			res.send 500
		else
			res.send 200

app.use (error, req, res, next) ->
	if error instanceof Errors.NotFoundError
		res.send 404
	else if error instanceof Errors.OpRangeNotAvailableError
		res.send 422 # Unprocessable Entity
	else
		logger.error err: error, "request errored"
		res.send(500, "Oops, something went wrong")

shutdownCleanly = (signal) ->
	return () ->
		logger.log signal: signal, "received interrupt, cleaning up"
		Settings.shuttingDown = true
		setTimeout () ->
			logger.log signal: signal, "shutting down"
			process.exit()
		, 10000

port = Settings.internal?.documentupdater?.port or Settings.apis?.documentupdater?.port or 3003
host = Settings.internal.documentupdater.host or "localhost"
app.listen port, host, ->
	logger.info "Document-updater starting up, listening on #{host}:#{port}"

for signal in ['SIGINT', 'SIGHUP', 'SIGQUIT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'SIGABRT']
	process.on signal, shutdownCleanly(signal)