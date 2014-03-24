express = require('express')
Settings = require('settings-sharelatex')
logger = require 'logger-sharelatex'
metrics = require('./Metrics')
crawlerLogger = require('./CrawlerLogger')
expressLocals = require('./ExpressLocals')
socketIoConfig = require('./SocketIoConfig')
soareqid = require('soa-req-id')
Router = require('../router')
metrics.inc("startup")
redis = require('redis')
RedisStore = require('connect-redis')(express)
SessionSockets = require('session.socket.io')
sessionStore = new RedisStore(host:Settings.redis.web.host, port:Settings.redis.web.port, pass:Settings.redis.web.password)
cookieParser = express.cookieParser(Settings.security.sessionSecret)
oneDayInMilliseconds = 86400000
ReferalConnect = require('../Features/Referal/ReferalConnect')
i18n = require("i18next")
i18n.init(resGetPath: 'locales/__lng__.json')

Monitor = require "./Monitor"

Settings.editorIsOpen ||= true

if Settings.cacheStaticAssets
	staticCacheAge = (oneDayInMilliseconds * 365)
else
	staticCacheAge = 0

app = express()

cookieKey = "sharelatex.sid"
cookieSessionLength = 5 * oneDayInMilliseconds

csrf = express.csrf()
ignoreCsrfRoutes = []
app.ignoreCsrf = (method, route) ->
	ignoreCsrfRoutes.push new express.Route(method, route)

app.configure ()->
	app.use express.static(__dirname + '/../../../public', {maxAge: staticCacheAge })
	app.set 'views', __dirname + '/../../views'
	app.set 'view engine', 'jade'
	app.use express.bodyParser(uploadDir: __dirname + "/../../../data/uploads")
	app.use i18n.handle
	app.use cookieParser
	app.use express.session
		proxy: true
		cookie:
			maxAge: cookieSessionLength
			secure: Settings.secureCookie
		store: sessionStore
		key: cookieKey

	# Measure expiry from last request, not last login
	app.use (req, res, next) ->
		req.session.expires = Date.now() + cookieSessionLength
		next()
	
	app.use (req, res, next) ->
		for route in ignoreCsrfRoutes
			if route.method == req.method?.toLowerCase() and route.match(req.path)
				return next()
		csrf(req, res, next)

	app.use ReferalConnect.use
	app.use express.methodOverride()

expressLocals(app)

app.configure 'production', ->
	logger.info "Production Enviroment"
	app.enable('view cache')

app.use Monitor.logger

app.use (req, res, next)->
	metrics.inc "http-request"
	crawlerLogger.log(req)
	next()

app.use (req, res, next) ->
	if !Settings.editorIsOpen
		res.status(503)
		res.render("general/closed", {title:"Maintenance"})
	else
		next()

app.get "/status", (req, res)->
	res.send("web sharelatex is alive")
	req.session.destroy()

logger.info ("creating HTTP server").yellow
server = require('http').createServer(app)

io = require('socket.io').listen(server)

sessionSockets = new SessionSockets(io, sessionStore, cookieParser, cookieKey)
router = new Router(app, io, sessionSockets)
socketIoConfig.configure(io)

module.exports =
	io: io
	app: app
	server: server
