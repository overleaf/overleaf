import App from '../../../../app.mjs'
import QueueWorkers from '../../../../app/src/infrastructure/QueueWorkers.js'
import MongoHelper from './MongoHelper.mjs'
import RedisHelper from './RedisHelper.mjs'
import Settings from '@overleaf/settings'
import MockReCAPTCHAApi from '../mocks/MockReCaptchaApi.mjs'
import { gracefulShutdown } from '../../../../app/src/infrastructure/GracefulShutdown.js'
import Server from '../../../../app/src/infrastructure/Server.mjs'
import { injectRouteAfter } from './injectRoute.mjs'
import SplitTestHandler from '../../../../app/src/Features/SplitTests/SplitTestHandler.js'
import SplitTestSessionHandler from '../../../../app/src/Features/SplitTests/SplitTestSessionHandler.js'
import Modules from '../../../../app/src/infrastructure/Modules.js'

const app = Server.app

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
