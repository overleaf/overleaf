Path = require "path"
express = require('express')
Settings = require('settings-sharelatex')
logger = require 'logger-sharelatex'
metrics = require('./Metrics')
crawlerLogger = require('./CrawlerLogger')
expressLocals = require('./ExpressLocals')
Router = require('../router')
metrics.inc("startup")

redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.web)

RedisStore = require('connect-redis')(express)
sessionStore = new RedisStore(client:rclient)

cookieParser = express.cookieParser(Settings.security.sessionSecret)
oneDayInMilliseconds = 86400000
ReferalConnect = require('../Features/Referal/ReferalConnect')
RedirectManager = require("./RedirectManager")
OldAssetProxy = require("./OldAssetProxy")
translations = require("translations-sharelatex").setup(Settings.i18n)
Modules = require "./Modules"

metrics.mongodb.monitor(Path.resolve(__dirname + "/../../../node_modules/mongojs/node_modules/mongodb"), logger)
metrics.mongodb.monitor(Path.resolve(__dirname + "/../../../node_modules/mongoose/node_modules/mongodb"), logger)

metrics.event_loop?.monitor(logger)

Settings.editorIsOpen ||= true

if Settings.cacheStaticAssets
	staticCacheAge = (oneDayInMilliseconds * 365)
else
	staticCacheAge = 0

app = express()

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
	Modules.loadViewIncludes app
	app.use express.bodyParser(uploadDir: Settings.path.uploadFolder)
	app.use translations.expressMiddlewear
	app.use translations.setLangBasedOnDomainMiddlewear
	app.use cookieParser
	app.use express.session
		proxy: Settings.behindProxy
		cookie:
			domain: Settings.cookieDomain
			maxAge: Settings.cookieSessionLength
			secure: Settings.secureCookie
		store: sessionStore
		key: Settings.cookieName
	
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
	
profiler = require "v8-profiler"
app.get "/profile", (req, res) ->
	time = parseInt(req.query.time || "1000")
	profiler.startProfiling("test")
	setTimeout () ->
		profile = profiler.stopProfiling("test")
		res.json(profile)
	, time

logger.info ("creating HTTP server").yellow
server = require('http').createServer(app)

router = new Router(app)

module.exports =
	app: app
	server: server
