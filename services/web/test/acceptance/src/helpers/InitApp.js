const App = require('../../../../app.js')
const QueueWorkers = require('../../../../app/src/infrastructure/QueueWorkers')
const MongoHelper = require('./MongoHelper')
const RedisHelper = require('./RedisHelper')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const MockReCAPTCHAApi = require('../mocks/MockReCaptchaApi')
const {
  gracefulShutdown,
} = require('../../../../app/src/infrastructure/GracefulShutdown')

logger.logger.level('error')

MongoHelper.initialize()
RedisHelper.initialize()
MockReCAPTCHAApi.initialize(2222)

let server

before('start main app', function (done) {
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
