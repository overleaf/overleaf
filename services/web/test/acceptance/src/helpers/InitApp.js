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

logger.logger.level('error')

MongoHelper.initialize()
RedisHelper.initialize()
MockReCAPTCHAApi.initialize(2222)

let server

before('start main app', function (done) {
  // We expose a session route in the test environment so that we can
  // use it to access email confirmation codes in acceptance tests.
  injectRouteAfter(
    app,
    route => route.path && route.path === '/dev/csrf',
    router => {
      router.get('/dev/session', (req, res) => {
        return res.json(req.session)
      })
    }
  )
  server = App.listen(23000, '127.0.0.1', done)
})

before('start queue workers', function () {
  QueueWorkers.start()
})

after('stop main app', async function () {
  if (!server) {
    return
  }
  Settings.gracefulShutdownDelayInMs = 1
  await gracefulShutdown(server, 'tests')
})
