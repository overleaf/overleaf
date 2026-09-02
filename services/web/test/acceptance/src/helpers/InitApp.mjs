import App from '../../../../app.mjs'
import QueueWorkers from '../../../../app/src/infrastructure/QueueWorkers.mjs'
import MongoHelper from './MongoHelper.mjs'
import RedisHelper from './RedisHelper.mjs'
import Settings from '@overleaf/settings'
import MockReCAPTCHAApi from '../mocks/MockReCaptchaApi.mjs'
import { gracefulShutdown } from '../../../../app/src/infrastructure/GracefulShutdown.mjs'
import Server from '../../../../app/src/infrastructure/Server.mjs'
import { injectRouteAfter } from './injectRoute.mjs'
import SplitTestHandler from '../../../../app/src/Features/SplitTests/SplitTestHandler.mjs'
import SplitTestSessionHandler from '../../../../app/src/Features/SplitTests/SplitTestSessionHandler.mjs'
import Modules from '../../../../app/src/infrastructure/Modules.mjs'
import testLogRecorder from '@overleaf/logger/test-log-recorder.js'
import { parseReq, z } from '@overleaf/validation-tools'

const app = Server.app

const devSessionSchema = z.object({
  // dev-only test route: the whole point is to copy arbitrary
  // caller-supplied query keys onto the session, so this is a
  // genuinely open map, not an escape hatch.
  query: z.record(z.string(), z.unknown()),
})

const devSetInSessionSchema = z.object({
  // dev-only test route: same genuinely-open-map shape as above, for body.
  body: z.record(z.string(), z.unknown()),
})

const devGetAssignmentSchema = z.object({
  query: z.object({
    splitTestName: z.string(),
    includeReferer: z.string().optional(),
  }),
})

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
        const { query } = parseReq(req, devSessionSchema)
        if (Object.keys(query).length > 0) {
          Object.assign(req.session, query)
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
        const { body } = parseReq(req, devSetInSessionSchema)
        for (const [key, value] of Object.entries(body)) {
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
        const { query } = parseReq(req, devGetAssignmentSchema)
        SplitTestHandler.promises
          .getAssignment(req, res, query.splitTestName, {
            sync: true,
            includeReferer: query.includeReferer === 'true',
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

if (process.env.CI === 'true') {
  beforeEach('record error logs in junit', testLogRecorder)
}
