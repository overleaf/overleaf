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

/**
 * Inject an endpoint to get the current users session into our app. This
 * endpoint should only be available when running in the test environment.
 * It is used to retrieve an email confirmation code when registering a
 * new user account in acceptance tests.
 */
const addSessionEndpoint = app => {
  const stack = app._router.stack

  stack.forEach(layer => {
    if (layer.name !== 'router' || !layer.handle || !layer.handle.stack) {
      return
    }

    // We want to position our /dev/session endpoint next to the /dev/csrf
    // endpoint so we check each router for the presence of this path.
    const newRouteIndex = layer.handle.stack.findIndex(
      route =>
        route &&
        route.route &&
        route.route.path &&
        route.route.path === '/dev/csrf'
    )

    if (newRouteIndex !== -1) {
      // We add our new endpoint to the end of the router stack.
      layer.handle.get('/dev/session', (req, res) => {
        return res.json(req.session)
      })

      const routeStack = layer.handle.stack
      const sessionRoute = routeStack[routeStack.length - 1]

      // Then we reposition it next to the /dev/csrf endpoint.
      layer.handle.stack = [
        ...routeStack.slice(0, newRouteIndex),
        sessionRoute,
        ...routeStack.slice(newRouteIndex, routeStack.length - 1),
      ]
    }
  })
}

logger.logger.level('error')

MongoHelper.initialize()
RedisHelper.initialize()
MockReCAPTCHAApi.initialize(2222)

let server

before('start main app', function (done) {
  addSessionEndpoint(app)
  server = App.listen(23000, 'localhost', done)
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
