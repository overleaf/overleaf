/* eslint-disable
    handle-callback-err,
    max-len,
    no-path-concat,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let staticCacheAge
const Path = require('path')
const express = require('express')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const crawlerLogger = require('./CrawlerLogger')
const expressLocals = require('./ExpressLocals')
const Router = require('../router')
const helmet = require('helmet')
const UserSessionsRedis = require('../Features/User/UserSessionsRedis')
const Csrf = require('./Csrf')

const sessionsRedisClient = UserSessionsRedis.client()

const session = require('express-session')
const RedisStore = require('connect-redis')(session)
const bodyParser = require('body-parser')
const methodOverride = require('method-override')
const cookieParser = require('cookie-parser')
const bearerToken = require('express-bearer-token')

// Init the session store
const sessionStore = new RedisStore({ client: sessionsRedisClient })

const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy

const Mongoose = require('./Mongoose')

const oneDayInMilliseconds = 86400000
const ReferalConnect = require('../Features/Referal/ReferalConnect')
const RedirectManager = require('./RedirectManager')
const ProxyManager = require('./ProxyManager')
const translations = require('translations-sharelatex').setup(Settings.i18n)
const Modules = require('./Modules')

const ErrorController = require('../Features/Errors/ErrorController')
const UserSessionsManager = require('../Features/User/UserSessionsManager')
const AuthenticationController = require('../Features/Authentication/AuthenticationController')

if (metrics.event_loop != null) {
  metrics.event_loop.monitor(logger)
}

if (Settings.cacheStaticAssets) {
  staticCacheAge = oneDayInMilliseconds * 365
} else {
  staticCacheAge = 0
}

const app = express()

const webRouter = express.Router()
const privateApiRouter = express.Router()
const publicApiRouter = express.Router()

if (Settings.behindProxy) {
  app.enable('trust proxy')
}

webRouter.use(
  express.static(__dirname + '/../../../public', { maxAge: staticCacheAge })
)
app.set('views', __dirname + '/../../views')
app.set('view engine', 'pug')
Modules.loadViewIncludes(app)

app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }))
// Make sure we can process twice the max doc length, to allow for
// - the doc content
// - text ranges spanning the whole doc
// Also allow some overhead for JSON encoding
app.use(bodyParser.json({ limit: 2 * Settings.max_doc_length + 64 * 1024 })) // 64kb overhead
app.use(methodOverride())
app.use(bearerToken())

app.use(metrics.http.monitor(logger))
RedirectManager.apply(webRouter)
ProxyManager.apply(publicApiRouter)

webRouter.use(cookieParser(Settings.security.sessionSecret))
webRouter.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: Settings.security.sessionSecret,
    proxy: Settings.behindProxy,
    cookie: {
      domain: Settings.cookieDomain,
      maxAge: Settings.cookieSessionLength,
      secure: Settings.secureCookie
    },
    store: sessionStore,
    key: Settings.cookieName,
    rolling: true
  })
)

// passport
webRouter.use(passport.initialize())
webRouter.use(passport.session())

passport.use(
  new LocalStrategy(
    {
      passReqToCallback: true,
      usernameField: 'email',
      passwordField: 'password'
    },
    AuthenticationController.doPassportLogin
  )
)
passport.serializeUser(AuthenticationController.serializeUser)
passport.deserializeUser(AuthenticationController.deserializeUser)

Modules.hooks.fire('passportSetup', passport, function(err) {
  if (err != null) {
    return logger.err({ err }, 'error setting up passport in modules')
  }
})

Modules.applyNonCsrfRouter(webRouter, privateApiRouter, publicApiRouter)

webRouter.csrf = new Csrf()
webRouter.use(webRouter.csrf.middleware)
webRouter.use(translations.expressMiddlewear)
webRouter.use(translations.setLangBasedOnDomainMiddlewear)

// Measure expiry from last request, not last login
webRouter.use(function(req, res, next) {
  req.session.touch()
  if (AuthenticationController.isUserLoggedIn(req)) {
    UserSessionsManager.touch(
      AuthenticationController.getSessionUser(req),
      function(err) {}
    )
  }
  return next()
})

webRouter.use(ReferalConnect.use)
expressLocals(app, webRouter, privateApiRouter, publicApiRouter)

if (app.get('env') === 'production') {
  logger.info('Production Enviroment')
  app.enable('view cache')
}

app.use(function(req, res, next) {
  metrics.inc('http-request')
  crawlerLogger.log(req)
  return next()
})

webRouter.use(function(req, res, next) {
  if (Settings.siteIsOpen) {
    return next()
  } else {
    res.status(503)
    return res.render('general/closed', { title: 'maintenance' })
  }
})

webRouter.use(function(req, res, next) {
  if (Settings.editorIsOpen) {
    return next()
  } else if (req.url.indexOf('/admin') === 0) {
    return next()
  } else {
    res.status(503)
    return res.render('general/closed', { title: 'maintenance' })
  }
})

// add security headers using Helmet
webRouter.use(function(req, res, next) {
  const isLoggedIn = AuthenticationController.isUserLoggedIn(req)
  const isProjectPage = !!req.path.match('^/project/[a-f0-9]{24}$')

  return helmet({
    // note that more headers are added by default
    dnsPrefetchControl: false,
    referrerPolicy: { policy: 'origin-when-cross-origin' },
    noCache: isLoggedIn || isProjectPage,
    noSniff: false,
    hsts: false,
    frameguard: false
  })(req, res, next)
})

const profiler = require('v8-profiler-node8')
privateApiRouter.get('/profile', function(req, res) {
  const time = parseInt(req.query.time || '1000')
  profiler.startProfiling('test')
  return setTimeout(function() {
    const profile = profiler.stopProfiling('test')
    return res.json(profile)
  }, time)
})

privateApiRouter.get('/heapdump', (req, res) =>
  require('heapdump').writeSnapshot(
    `/tmp/${Date.now()}.web.heapsnapshot`,
    (err, filename) => res.send(filename)
  )
)

logger.info('creating HTTP server'.yellow)
const server = require('http').createServer(app)

// provide settings for separate web and api processes
// if enableApiRouter and enableWebRouter are not defined they default
// to true.
const notDefined = x => x == null
const enableApiRouter =
  Settings.web != null ? Settings.web.enableApiRouter : undefined
if (enableApiRouter || notDefined(enableApiRouter)) {
  logger.info('providing api router')
  app.use(privateApiRouter)
  app.use(ErrorController.handleApiError)
}

const enableWebRouter =
  Settings.web != null ? Settings.web.enableWebRouter : undefined
if (enableWebRouter || notDefined(enableWebRouter)) {
  logger.info('providing web router')
  app.use(publicApiRouter) // public API goes with web router for public access
  app.use(ErrorController.handleApiError)
  app.use(webRouter)
  app.use(ErrorController.handleError)
}

metrics.injectMetricsRoute(webRouter)

const router = new Router(webRouter, privateApiRouter, publicApiRouter)

module.exports = {
  app,
  server
}
