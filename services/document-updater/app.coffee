express = require('express')
http = require("http")
Settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
logger.initialize("documentupdater")
RedisManager = require('./app/js/RedisManager.js')
UpdateManager = require('./app/js/UpdateManager.js')
Keys = require('./app/js/RedisKeyBuilder')
redis = require('redis')
Errors = require "./app/js/Errors"
HttpController = require "./app/js/HttpController"

redisConf = Settings.redis.web
rclient = redis.createClient(redisConf.port, redisConf.host)
rclient.auth(redisConf.password)

Path = require "path"
Metrics = require "metrics-sharelatex"
Metrics.initialize("doc-updater")
Metrics.mongodb.monitor(Path.resolve(__dirname + "/node_modules/mongojs/node_modules/mongodb"), logger)

app = express()
app.configure ->
	app.use(Metrics.http.monitor(logger));
	app.use express.bodyParser()
	app.use app.router

rclient.subscribe("pending-updates")
rclient.on "message", (channel, doc_key) ->
	[project_id, doc_id] = Keys.splitProjectIdAndDocId(doc_key)
	if !Settings.shuttingDown
		UpdateManager.processOutstandingUpdatesWithLock project_id, doc_id, (error) ->
			logger.error err: error, project_id: project_id, doc_id: doc_id, "error processing update" if error?
	else
		logger.log project_id: project_id, doc_id: doc_id, "ignoring incoming update" 

UpdateManager.resumeProcessing()

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

app.use (error, req, res, next) ->
	logger.error err: error, "request errored"
	if error instanceof Errors.NotFoundError
		res.send 404
	else
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
app.listen port, "localhost", ->
	logger.log("documentupdater-sharelatex server listening on port #{port}")

for signal in ['SIGINT', 'SIGHUP', 'SIGQUIT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'SIGABRT']
	process.on signal, shutdownCleanly(signal)