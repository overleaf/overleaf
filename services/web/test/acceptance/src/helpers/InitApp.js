const App = require('../../../../app.js')
const QueueWorkers = require('../../../../app/src/infrastructure/QueueWorkers')
const MongoHelper = require('./MongoHelper')
const RedisHelper = require('./RedisHelper')
const { logger } = require('logger-sharelatex')

logger.level('error')

MongoHelper.initialize()
RedisHelper.initialize()

let server

before('start main app', function (done) {
  server = App.listen(3000, 'localhost', done)
})

before('start queue workers', function () {
  QueueWorkers.start()
})

after('stop main app', function (done) {
  if (!server) {
    return done()
  }
  server.close(done)
})
