Metrics = require "metrics-sharelatex"
Metrics.initialize("doc-updater")

express = require('express')
http = require("http")
Settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
logger.initialize("document-updater")

logger.logger.addSerializers(require("./app/js/LoggerSerializers"))

if Settings.sentry?.dsn?
	logger.initializeErrorReporting(Settings.sentry.dsn)

RedisManager = require('./app/js/RedisManager')
DispatchManager = require('./app/js/DispatchManager')
DeleteQueueManager = require('./app/js/DeleteQueueManager')
Errors = require "./app/js/Errors"
HttpController = require "./app/js/HttpController"
mongojs = require "./app/js/mongojs"
async = require "async"

Path = require "path"
bodyParser = require "body-parser"

Metrics.mongodb.monitor(Path.resolve(__dirname + "/node_modules/mongojs/node_modules/mongodb"), logger)
Metrics.event_loop.monitor(logger, 100)

app = express()
app.use(Metrics.http.monitor(logger));
app.use bodyParser.json({limit: (Settings.max_doc_length + 64 * 1024)})
Metrics.injectMetricsRoute(app)

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

app.get    '/project/:project_id/doc/:doc_id',                          HttpController.getDoc
# temporarily keep the GET method for backwards compatibility
app.get    '/project/:project_id/doc',                                  HttpController.getProjectDocsAndFlushIfOld
# will migrate to the POST method of get_and_flush_if_old instead
app.post   '/project/:project_id/get_and_flush_if_old',                 HttpController.getProjectDocsAndFlushIfOld
app.post   '/project/:project_id/clearState',                           HttpController.clearProjectState
app.post   '/project/:project_id/doc/:doc_id',                          HttpController.setDoc
app.post   '/project/:project_id/doc/:doc_id/flush',                    HttpController.flushDocIfLoaded
app.delete '/project/:project_id/doc/:doc_id',                          HttpController.deleteDoc
app.delete '/project/:project_id',                                      HttpController.deleteProject
app.delete '/project',                                                  HttpController.deleteMultipleProjects
app.post   '/project/:project_id',                                      HttpController.updateProject
app.post   '/project/:project_id/history/resync',                       HttpController.resyncProjectHistory
app.post   '/project/:project_id/flush',                                HttpController.flushProject
app.post   '/project/:project_id/doc/:doc_id/change/:change_id/accept', HttpController.acceptChanges
app.post   '/project/:project_id/doc/:doc_id/change/accept',            HttpController.acceptChanges
app.delete '/project/:project_id/doc/:doc_id/comment/:comment_id',      HttpController.deleteComment

app.get    '/flush_all_projects',                                       HttpController.flushAllProjects
app.get    '/flush_queued_projects', HttpController.flushQueuedProjects

app.get '/total', (req, res)->
	timer = new Metrics.Timer("http.allDocList")
	RedisManager.getCountOfDocsInMemory (err, count)->
		timer.done()
		res.send {total:count}

app.get '/status', (req, res)->
	if Settings.shuttingDown
		res.sendStatus 503 # Service unavailable
	else
		res.send('document updater is alive')

pubsubClient = require("redis-sharelatex").createClient(Settings.redis.pubsub)
app.get "/health_check/redis", (req, res, next) ->
	pubsubClient.healthCheck (error) ->
		if error?
			logger.err {err: error}, "failed redis health check"
			res.sendStatus 500
		else
			res.sendStatus 200

docUpdaterRedisClient = require("redis-sharelatex").createClient(Settings.redis.documentupdater)
app.get "/health_check/redis_cluster", (req, res, next) ->
	docUpdaterRedisClient.healthCheck (error) ->
		if error?
			logger.err {err: error}, "failed redis cluster health check"
			res.sendStatus 500
		else
			res.sendStatus 200

app.get "/health_check", (req, res, next) ->
	async.series [
		(cb) ->
			pubsubClient.healthCheck (error) ->
				if error?
					logger.err {err: error}, "failed redis health check"
				cb(error)
		(cb) ->
			docUpdaterRedisClient.healthCheck (error) ->
				if error?
					logger.err {err: error}, "failed redis cluster health check"
				cb(error)
		(cb) ->
			mongojs.healthCheck (error) ->
				if error?
					logger.err {err: error}, "failed mongo health check"
				cb(error)
	] , (error) ->
		if error?
			res.sendStatus 500
		else
			res.sendStatus 200

app.use (error, req, res, next) ->
	if error instanceof Errors.NotFoundError
		res.sendStatus 404
	else if error instanceof Errors.OpRangeNotAvailableError
		res.sendStatus 422 # Unprocessable Entity
	else if error.statusCode is 413
		res.status(413).send("request entity too large")
	else
		logger.error err: error, req: req, "request errored"
		res.status(500).send("Oops, something went wrong")

shutdownCleanly = (signal) ->
	return () ->
		logger.log signal: signal, "received interrupt, cleaning up"
		Settings.shuttingDown = true
		setTimeout () ->
			logger.log signal: signal, "shutting down"
			process.exit()
		, 10000

watchForEvent = (eventName)->
	docUpdaterRedisClient.on eventName, (e)->
		console.log "redis event: #{eventName} #{e}"

events = ["connect", "ready", "error", "close", "reconnecting", "end"]
for eventName in events
	watchForEvent(eventName)


port = Settings.internal?.documentupdater?.port or Settings.apis?.documentupdater?.port or 3003
host = Settings.internal.documentupdater.host or "localhost"
if !module.parent # Called directly
	app.listen port, host, ->
		logger.info "Document-updater starting up, listening on #{host}:#{port}"
		if Settings.continuousBackgroundFlush
			logger.info "Starting continuous background flush"
			DeleteQueueManager.startBackgroundFlush()

module.exports = app

for signal in ['SIGINT', 'SIGHUP', 'SIGQUIT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'SIGABRT']
	process.on signal, shutdownCleanly(signal)

