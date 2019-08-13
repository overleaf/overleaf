Metrics = require("metrics-sharelatex")
Settings = require "settings-sharelatex"
Metrics.initialize(Settings.appName or "real-time")
async = require("async")
_ = require "underscore"

logger = require "logger-sharelatex"
logger.initialize("real-time")
Metrics.event_loop.monitor(logger)

express = require("express")
session = require("express-session")
redis = require("redis-sharelatex")
if Settings.sentry?.dsn?
	logger.initializeErrorReporting(Settings.sentry.dsn)

sessionRedisClient = redis.createClient(Settings.redis.websessions)

RedisStore = require('connect-redis')(session)
SessionSockets = require('session.socket.io')
CookieParser = require("cookie-parser")

DrainManager = require("./app/js/DrainManager")
HealthCheckManager = require("./app/js/HealthCheckManager")

# work around frame handler bug in socket.io v0.9.16
require("./socket.io.patch.js") 

# Set up socket.io server
app = express()
Metrics.injectMetricsRoute(app)
server = require('http').createServer(app)
io = require('socket.io').listen(server)

# Bind to sessions
sessionStore = new RedisStore(client: sessionRedisClient)
cookieParser = CookieParser(Settings.security.sessionSecret)

sessionSockets = new SessionSockets(io, sessionStore, cookieParser, Settings.cookieName)

io.configure ->
	io.enable('browser client minification')
	io.enable('browser client etag')

	# Fix for Safari 5 error of "Error during WebSocket handshake: location mismatch"
	# See http://answers.dotcloud.com/question/578/problem-with-websocket-over-ssl-in-safari-with
	io.set('match origin protocol', true)

	# gzip uses a Node 0.8.x method of calling the gzip program which
	# doesn't work with 0.6.x
	#io.enable('browser client gzip')
	io.set('transports', ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling'])
	io.set('log level', 1)

app.get "/", (req, res, next) ->
	res.send "real-time-sharelatex is alive"

app.get "/status", (req, res, next) ->
	res.send "real-time-sharelatex is alive"

app.get "/debug/events", (req, res, next) ->
	Settings.debugEvents = parseInt(req.query?.count,10) || 20
	logger.log {count: Settings.debugEvents}, "starting debug mode"
	res.send "debug mode will log next #{Settings.debugEvents} events"

rclient = require("redis-sharelatex").createClient(Settings.redis.realtime)

app.get "/health_check/redis", (req, res, next) ->
	rclient.healthCheck (error) ->
		if error?
			logger.err {err: error}, "failed redis health check"
			res.sendStatus 500
		else if HealthCheckManager.isFailing()
			status = HealthCheckManager.status()
			logger.err {pubSubErrors: status}, "failed pubsub health check"
			res.sendStatus 500
		else
			res.sendStatus 200

Metrics.injectMetricsRoute(app)

Router = require "./app/js/Router"
Router.configure(app, io, sessionSockets)

WebsocketLoadBalancer = require "./app/js/WebsocketLoadBalancer"
WebsocketLoadBalancer.listenForEditorEvents(io)

DocumentUpdaterController = require "./app/js/DocumentUpdaterController"
DocumentUpdaterController.listenForUpdatesFromDocumentUpdater(io)

port = Settings.internal.realTime.port
host = Settings.internal.realTime.host

server.listen port, host, (error) ->
	throw error if error?
	logger.info "realtime starting up, listening on #{host}:#{port}"

# Stop huge stack traces in logs from all the socket.io parsing steps.
Error.stackTraceLimit = 10


shutdownCleanly = (signal) ->
	connectedClients = io.sockets.clients()?.length
	if connectedClients == 0
		logger.log("no clients connected, exiting")
		process.exit()
	else
		logger.log {connectedClients}, "clients still connected, not shutting down yet"
		setTimeout () ->
			shutdownCleanly(signal)
		, 10000

forceDrain = ->
	logger.log {delay_ms:Settings.forceDrainMsDelay}, "starting force drain after timeout"
	setTimeout ()-> 
		logger.log "starting drain over #{Settings.shutdownDrainTimeWindow} mins"
		DrainManager.startDrainTimeWindow(io, Settings.shutdownDrainTimeWindow)
	, Settings.forceDrainMsDelay

shutDownInProgress = false
if Settings.forceDrainMsDelay?
	Settings.forceDrainMsDelay = parseInt(Settings.forceDrainMsDelay, 10)
	logger.log forceDrainMsDelay: Settings.forceDrainMsDelay,"forceDrainMsDelay enabled"
	for signal in ['SIGINT', 'SIGHUP', 'SIGQUIT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'SIGABRT']
		process.on signal, ->
			if shutDownInProgress
				logger.log signal: signal, "shutdown already in progress, ignoring signal"
				return
			else
				shutDownInProgress = true
				logger.log signal: signal, "received interrupt, cleaning up"
				shutdownCleanly(signal)
				forceDrain()



if Settings.continualPubsubTraffic
	console.log "continualPubsubTraffic enabled"

	pubsubClient = redis.createClient(Settings.redis.pubsub)
	clusterClient = redis.createClient(Settings.redis.websessions)

	publishJob = (channel, callback)->
		checker = new HealthCheckManager(channel)
		logger.debug {channel:channel}, "sending pub to keep connection alive"
		json = JSON.stringify({health_check:true, key: checker.id, date: new Date().toString()})
		pubsubClient.publish channel, json, (err)->
			if err?
				logger.err {err, channel}, "error publishing pubsub traffic to redis"
			clusterClient.publish "cluster-continual-traffic", {keep: "alive"}, callback


	runPubSubTraffic = ->
		async.map ["applied-ops", "editor-events"], publishJob, (err)->
			setTimeout(runPubSubTraffic, 1000 * 20)

	runPubSubTraffic()



