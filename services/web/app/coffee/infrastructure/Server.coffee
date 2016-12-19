Path = require "path"
express = require('express')
Settings = require('settings-sharelatex')
logger = require 'logger-sharelatex'
metrics = require('./Metrics')
crawlerLogger = require('./CrawlerLogger')
expressLocals = require('./ExpressLocals')
Router = require('../router')
metrics.inc("startup")
UserSessionsRedis = require('../Features/User/UserSessionsRedis')

sessionsRedisClient = UserSessionsRedis.client()

session = require("express-session")
RedisStore = require('connect-redis')(session)
bodyParser = require('body-parser')
multer  = require('multer')
methodOverride = require('method-override')
csrf = require('csurf')
csrfProtection = csrf()
cookieParser = require('cookie-parser')

# Init the session store
sessionStore = new RedisStore(client:sessionsRedisClient)

passport = require('passport')
LocalStrategy = require('passport-local').Strategy

Mongoose = require("./Mongoose")

oneDayInMilliseconds = 86400000
ReferalConnect = require('../Features/Referal/ReferalConnect')
RedirectManager = require("./RedirectManager")
OldAssetProxy = require("./OldAssetProxy")
translations = require("translations-sharelatex").setup(Settings.i18n)
Modules = require "./Modules"

ErrorController = require "../Features/Errors/ErrorController"
UserSessionsManager = require "../Features/User/UserSessionsManager"
AuthenticationController = require "../Features/Authentication/AuthenticationController"

metrics.mongodb.monitor(Path.resolve(__dirname + "/../../../node_modules/mongojs/node_modules/mongodb"), logger)
metrics.mongodb.monitor(Path.resolve(__dirname + "/../../../node_modules/mongoose/node_modules/mongodb"), logger)

metrics.event_loop?.monitor(logger)

Settings.editorIsOpen ||= true

if Settings.cacheStaticAssets
	staticCacheAge = (oneDayInMilliseconds * 365)
else
	staticCacheAge = 0

app = express()

webRouter = express.Router()
apiRouter = express.Router()

if Settings.behindProxy
	app.enable('trust proxy')

webRouter.use express.static(__dirname + '/../../../public', {maxAge: staticCacheAge })
app.set 'views', __dirname + '/../../views'
app.set 'view engine', 'jade'
Modules.loadViewIncludes app



app.use bodyParser.urlencoded({ extended: true, limit: "2mb"})
# Make sure we can process the max doc length plus some overhead for JSON encoding
app.use bodyParser.json({limit: Settings.max_doc_length + 16 * 1024}) # 16kb overhead
app.use multer(dest: Settings.path.uploadFolder)
app.use methodOverride()

app.use metrics.http.monitor(logger)
app.use RedirectManager
app.use OldAssetProxy


webRouter.use cookieParser(Settings.security.sessionSecret)
webRouter.use session
	resave: false
	saveUninitialized:false
	secret:Settings.security.sessionSecret
	proxy: Settings.behindProxy
	cookie:
		domain: Settings.cookieDomain
		maxAge: Settings.cookieSessionLength
		secure: Settings.secureCookie
	store: sessionStore
	key: Settings.cookieName
	rolling: true

# passport
webRouter.use passport.initialize()
webRouter.use passport.session()

passport.use(new LocalStrategy(
	{
		passReqToCallback: true,
		usernameField: 'email',
		passwordField: 'password'
	},
	AuthenticationController.doPassportLogin
))
passport.serializeUser(AuthenticationController.serializeUser)
passport.deserializeUser(AuthenticationController.deserializeUser)

Modules.hooks.fire 'passportSetup', passport, (err) ->
	if err?
		logger.err {err}, "error setting up passport in modules"

Modules.applyNonCsrfRouter(webRouter, apiRouter)

webRouter.use csrfProtection
webRouter.use translations.expressMiddlewear
webRouter.use translations.setLangBasedOnDomainMiddlewear

# Measure expiry from last request, not last login
webRouter.use (req, res, next) ->
	req.session.touch()
	if AuthenticationController.isUserLoggedIn(req)
		UserSessionsManager.touch(AuthenticationController.getSessionUser(req), (err)->)
	next()

webRouter.use ReferalConnect.use
expressLocals(app, webRouter, apiRouter)

if app.get('env') == 'production'
	logger.info "Production Enviroment"
	app.enable('view cache')

app.use (req, res, next)->
	metrics.inc "http-request"
	crawlerLogger.log(req)
	next()

webRouter.use (req, res, next) ->
	if Settings.editorIsOpen
		next()
	else if req.url.indexOf("/admin") == 0
		next()
	else
		res.status(503)
		res.render("general/closed", {title:"maintenance"})

apiRouter.get "/status", (req, res)->
	res.send("web sharelatex is alive")

profiler = require "v8-profiler"
apiRouter.get "/profile", (req, res) ->
	time = parseInt(req.query.time || "1000")
	profiler.startProfiling("test")
	setTimeout () ->
		profile = profiler.stopProfiling("test")
		res.json(profile)
	, time

app.get "/heapdump", (req, res)->
	require('heapdump').writeSnapshot '/tmp/' + Date.now() + '.web.heapsnapshot', (err, filename)->
		res.send filename

logger.info ("creating HTTP server").yellow
server = require('http').createServer(app)

# process api routes first, if nothing matched fall though and use
# web middlewear + routes
app.use(apiRouter)
app.use(webRouter)

router = new Router(webRouter, apiRouter)

app.use ErrorController.handleError

module.exports =
	app: app
	server: server
