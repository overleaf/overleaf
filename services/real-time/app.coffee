logger = require "logger-sharelatex"
logger.initialize("real-time-sharelatex")

express = require("express")
session = require("express-session")
redis = require("redis-sharelatex")
Settings = require "settings-sharelatex"
if Settings.sentry?.dsn?
	logger.initializeErrorReporting(Settings.sentry.dsn)

console.log "dasdsadasdsadsadsadsad"
console.log Settings.redis.websessions
sessionRedisClient = redis.createClient(Settings.redis.websessions)

RedisStore = require('connect-redis')(session)
SessionSockets = require('session.socket.io')
CookieParser = require("cookie-parser")

Metrics = require("metrics-sharelatex")
Metrics.initialize(Settings.appName or "real-time")
Metrics.event_loop.monitor(logger)


# Set up socket.io server
app = express()
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

app.get "/status", (req, res, next) ->
	res.send "real-time-sharelatex is alive"

rclient = require("redis-sharelatex").createClient(Settings.redis.realtime)
app.get "/health_check/redis", (req, res, next) ->
	rclient.healthCheck (error) ->
		if error?
			logger.err {err: error}, "failed redis health check"
			res.sendStatus 500
		else
			res.sendStatus 200

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
