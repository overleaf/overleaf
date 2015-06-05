Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
logger.initialize("track-changes")

Path = require "path"
Metrics = require "metrics-sharelatex"
Metrics.initialize("track-changes")
Metrics.mongodb.monitor(Path.resolve(__dirname + "/node_modules/mongojs/node_modules/mongodb"), logger)

child_process = require "child_process"

HttpController = require "./app/js/HttpController"
express = require "express"
app = express()

app.use Metrics.http.monitor(logger)

app.post "/project/:project_id/doc/:doc_id/flush", HttpController.flushDoc

app.get "/project/:project_id/doc/:doc_id/diff", HttpController.getDiff

app.get "/project/:project_id/updates", HttpController.getUpdates

app.post "/project/:project_id/flush", HttpController.flushProject

app.post "/project/:project_id/doc/:doc_id/version/:version/restore", HttpController.restore

app.post "/doc/:doc_id/pack", HttpController.packDoc

packWorker = null # use a single packing worker

app.post "/pack", (req, res, next) ->
	if packWorker?
		res.send "pack already running"
	else
		logger.log "running pack"
		packWorker = child_process.fork(__dirname + '/app/js/PackWorker.js',
			[req.query.limit, req.query.delay, req.query.timeout])
		packWorker.on 'exit', (code, signal) ->
			logger.log {code, signal}, "history auto pack exited"
			packWorker = null
		res.send "pack started"

app.get "/status", (req, res, next) ->
	res.send "track-changes is alive"

app.use (error, req, res, next) ->
	logger.error err: error, "an internal error occured"
	res.send 500

port = Settings.internal?.trackchanges?.port or 3015
host = Settings.internal?.trackchanges?.host or "localhost"
app.listen port, host, (error) ->
	if error?
		logger.error err: error, "could not start track-changes server"
	else
		logger.info "trackchanges starting up, listening on #{host}:#{port}"

