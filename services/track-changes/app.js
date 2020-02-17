Metrics = require "metrics-sharelatex"
Metrics.initialize("track-changes")
Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
TrackChangesLogger = logger.initialize("track-changes").logger

if Settings.sentry?.dsn?
	logger.initializeErrorReporting(Settings.sentry.dsn)

# log updates as truncated strings
truncateFn = (updates) ->
		JSON.parse(
			JSON.stringify updates, (key, value) ->
				if typeof value == 'string' && (len = value.length) > 80
					return value.substr(0,32) + "...(message of length #{len} truncated)..." + value.substr(-32)
				else
					return value
		)

TrackChangesLogger.addSerializers {
	rawUpdate: truncateFn
	rawUpdates: truncateFn
	newUpdates: truncateFn
	lastUpdate: truncateFn
}

Path = require "path"

Metrics.memory.monitor(logger)

child_process = require "child_process"

HttpController = require "./app/js/HttpController"
express = require "express"
app = express()

app.use Metrics.http.monitor(logger)

Metrics.injectMetricsRoute(app)

app.post "/project/:project_id/doc/:doc_id/flush", HttpController.flushDoc

app.get "/project/:project_id/doc/:doc_id/diff", HttpController.getDiff

app.get "/project/:project_id/doc/:doc_id/check", HttpController.checkDoc

app.get "/project/:project_id/updates", HttpController.getUpdates

app.post "/project/:project_id/flush", HttpController.flushProject

app.post "/project/:project_id/doc/:doc_id/version/:version/restore", HttpController.restore

app.post  '/project/:project_id/doc/:doc_id/push', HttpController.pushDocHistory
app.post  '/project/:project_id/doc/:doc_id/pull', HttpController.pullDocHistory

app.post '/flush/all', HttpController.flushAll
app.post '/check/dangling', HttpController.checkDanglingUpdates

packWorker = null # use a single packing worker

app.post "/pack", (req, res, next) ->
	if packWorker?
		res.send "pack already running"
	else
		logger.log "running pack"
		packWorker = child_process.fork(__dirname + '/app/js/PackWorker.js',
			[req.query.limit || 1000, req.query.delay || 1000, req.query.timeout || 30*60*1000])
		packWorker.on 'exit', (code, signal) ->
			logger.log {code, signal}, "history auto pack exited"
			packWorker = null
		res.send "pack started"

app.get "/status", (req, res, next) ->
	res.send "track-changes is alive"

app.get "/oops", (req, res, next) ->
	throw new Error("dummy test error")

app.get "/check_lock", HttpController.checkLock

app.get "/health_check",  HttpController.healthCheck

app.use (error, req, res, next) ->
	logger.error err: error, req: req, "an internal error occured"
	res.send 500

port = Settings.internal?.trackchanges?.port or 3015
host = Settings.internal?.trackchanges?.host or "localhost"

if !module.parent # Called directly
	app.listen port, host, (error) ->
		if error?
			logger.error err: error, "could not start track-changes server"
		else
			logger.info "trackchanges starting up, listening on #{host}:#{port}"

module.exports = app

