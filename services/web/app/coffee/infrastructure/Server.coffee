Path = require "path"
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
RedirectManager = require("./RedirectManager")
OldAssetProxy = require("./OldAssetProxy")
translations = require("translations-sharelatex").setup(Settings.i18n)

metrics.mongodb.monitor(Path.resolve(__dirname + "/../../../node_modules/mongojs/node_modules/mongodb"), logger)
metrics.mongodb.monitor(Path.resolve(__dirname + "/../../../node_modules/mongoose/node_modules/mongodb"), logger)

Settings.editorIsOpen ||= true

if Settings.cacheStaticAssets
	staticCacheAge = (oneDayInMilliseconds * 365)
else
	staticCacheAge = 0

app = express()

cookieKey = Settings.cookieName
cookieSessionLength = 5 * oneDayInMilliseconds

csrf = express.csrf()
ignoreCsrfRoutes = []
app.ignoreCsrf = (method, route) ->
	ignoreCsrfRoutes.push new express.Route(method, route)



app.configure () ->
	if Settings.behindProxy
		app.enable('trust proxy')
	app.use express.static(__dirname + '/../../../public', {maxAge: staticCacheAge })
	app.set 'views', __dirname + '/../../views'
	app.set 'view engine', 'jade'
	app.use express.bodyParser(uploadDir: Settings.path.uploadFolder)
	app.use express.bodyParser(uploadDir: __dirname + "/../../../data/uploads")
	app.use translations.expressMiddlewear
	app.use translations.setLangBasedOnDomainMiddlewear
	app.use cookieParser
	app.use express.session
		proxy: Settings.behindProxy
		cookie:
			domain: Settings.cookieDomain
			maxAge: cookieSessionLength
			secure: Settings.secureCookie
		store: sessionStore
		key: cookieKey
	app.use (req, res, next)->
		console.log req.session, req.url, "session log"
		next()

	# Measure expiry from last request, not last login
	app.use (req, res, next) ->
		req.session.touch()
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

app.use metrics.http.monitor(logger)
app.use RedirectManager
app.use OldAssetProxy

app.use (req, res, next)->
	metrics.inc "http-request"
	crawlerLogger.log(req)
	next()

app.use (req, res, next) ->
	if !Settings.editorIsOpen
		res.status(503)
		res.render("general/closed", {title:"maintenance"})
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
