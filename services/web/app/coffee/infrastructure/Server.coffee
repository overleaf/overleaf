Path = require "path"
express = require('express')
Settings = require('settings-sharelatex')
logger = require 'logger-sharelatex'
metrics = require('metrics-sharelatex')
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
OAuth2Strategy = require('passport-oauth2').Strategy

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
OverleafAuthenticationController = require "../Features/Authentication/OverleafAuthenticationController"

metrics.event_loop?.monitor(logger)

Settings.editorIsOpen ||= true

if Settings.cacheStaticAssets
	staticCacheAge = (oneDayInMilliseconds * 365)
else
	staticCacheAge = 0

app = express()

webRouter = express.Router()
privateApiRouter = express.Router()
publicApiRouter = express.Router()

if Settings.behindProxy
	app.enable('trust proxy')

webRouter.use express.static(__dirname + '/../../../public', {maxAge: staticCacheAge })
app.set 'views', __dirname + '/../../views'
app.set 'view engine', 'pug'
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

overleafOAuth2Strategy = new OAuth2Strategy(
	{
		authorizationURL: 'http://localhost:5000/oauth/authorize',
		tokenURL: 'http://localhost:5000/oauth/token',
		clientID: "0479498de20727971b5f40f86dc558264fe7a5021ae74c3e0e03f7dccfeaf0ab",
		clientSecret: "ecb446d53bb9a1555fecd74b5e3faabefe1345ca6a9228da0c1fbdac2338c502",
		callbackURL: "http://www.sharelatex.dev:3000/overleaf/callback"
	},
	OverleafAuthenticationController.doPassportLogin
)
overleafOAuth2Strategy.userProfile = (accessToken, cb) ->
	require("request").get {
		url: "http://localhost:5000/api/v1/sharelatex/profile"
		json: true
		headers:
			Authorization: "Bearer #{accessToken}"
	}, (err, response, body) ->
		console.log {err, response, body}
		return cb(err) if err?
		cb(null, body)
passport.use(overleafOAuth2Strategy)


Modules.hooks.fire 'passportSetup', passport, (err) ->
	if err?
		logger.err {err}, "error setting up passport in modules"

Modules.applyNonCsrfRouter(webRouter, privateApiRouter, publicApiRouter)

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
expressLocals(app, webRouter, privateApiRouter, publicApiRouter)

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

profiler = require "v8-profiler"
privateApiRouter.get "/profile", (req, res) ->
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

# provide settings for separate web and api processes
# if enableApiRouter and enableWebRouter are not defined they default
# to true.
notDefined = (x) -> !x?
enableApiRouter = Settings.web?.enableApiRouter
if enableApiRouter or notDefined(enableApiRouter)
	logger.info("providing api router");
	app.use(privateApiRouter)
	app.use(ErrorController.handleApiError)

enableWebRouter = Settings.web?.enableWebRouter
if enableWebRouter or notDefined(enableWebRouter)
	logger.info("providing web router");
	app.use(publicApiRouter) # public API goes with web router for public access
	app.use(ErrorController.handleApiError)
	app.use(webRouter)
	app.use(ErrorController.handleError)

router = new Router(webRouter, privateApiRouter, publicApiRouter)

module.exports =
	app: app
	server: server
