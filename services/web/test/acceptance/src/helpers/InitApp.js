const App = require('../../../../app')
const QueueWorkers = require('../../../../app/src/infrastructure/QueueWorkers')
const MongoHelper = require('./MongoHelper')
const RedisHelper = require('./RedisHelper')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const MockReCAPTCHAApi = require('../mocks/MockReCaptchaApi')
const {
  gracefulShutdown,
} = require('../../../../app/src/infrastructure/GracefulShutdown')
const { app } = require('../../../../app/src/infrastructure/Server')
const { injectRouteAfter } = require('./injectRoute')
const SplitTestHandler = require('../../../../app/src/Features/SplitTests/SplitTestHandler')
const SplitTestSessionHandler = require('../../../../app/src/Features/SplitTests/SplitTestSessionHandler')
const Modules = require('../../../../app/src/infrastructure/Modules')

logger.logger.level('error')

MongoHelper.initialize()
RedisHelper.initialize()
MockReCAPTCHAApi.initialize(2222)

let server

before('start main app', function (done) {
  // We expose addition routes in the test environment for acceptance tests.
  injectRouteAfter(
    app,
    route => route.path && route.path === '/dev/csrf',
    router => {
      router.get('/dev/session', (req, res) => {
        // allow changing the session directly for testing, assign any
        // properties in the query string to req.session
        if (req.query && Object.keys(req.query).length > 0) {
          Object.assign(req.session, req.query)
        }
        return res.json(req.session)
      })
    }
  )
  injectRouteAfter(
    app,
    route => route.path && route.path === '/dev/csrf',
    router => {
      router.post('/dev/set_in_session', (req, res) => {
        for (const [key, value] of Object.entries(req.body)) {
          req.session[key] = value
        }
        return res.sendStatus(200)
      })
    }
  )
  injectRouteAfter(
    app,
    route => route.path && route.path === '/dev/csrf',
    router => {
      router.get('/dev/split_test/get_assignment', (req, res) => {
        const { splitTestName } = req.query
        SplitTestHandler.promises
          .getAssignment(req, res, splitTestName, {
            sync: true,
          })
          .then(assignment => res.json(assignment))
          .catch(error => {
            res.status(500).json({ error: JSON.stringify(error) })
          })
      })
    }
  )
  injectRouteAfter(
    app,
    route => route.path && route.path === '/dev/csrf',
    router => {
      router.post('/dev/split_test/session_maintenance', (req, res) => {
        SplitTestSessionHandler.promises
          .sessionMaintenance(req)
          .then(res.sendStatus(200))
          .catch(error => {
            res.status(500).json({ error: JSON.stringify(error) })
          })
      })
    }
  )
  injectRouteAfter(
    app,
    route => route.path && route.path === '/dev/csrf',
    router => {
      router.csrf.disableDefaultCsrfProtection(
        '/dev/no_autostart_post_gateway',
        'POST'
      )
      router.sessionAutostartMiddleware.disableSessionAutostartForRoute(
        '/dev/no_autostart_post_gateway',
        'POST',
        (req, res, next) => {
          next()
        }
      )
      router.post('/dev/no_autostart_post_gateway', (req, res) => {
        res.status(200).json({ message: 'no autostart' })
      })
    }
  )

  server = App.listen(23000, '127.0.0.1', done)
})

before('start queue workers', async function () {
  QueueWorkers.start()
  await Modules.start()
})

after('stop main app', async function () {
  if (!server) {
    return
  }
  Settings.gracefulShutdownDelayInMs = 1
  await gracefulShutdown(server, 'tests')
})
