const App = require('../../../../app.js')
const MongoHelper = require('./MongoHelper')
const { logger } = require('logger-sharelatex')

logger.level('error')

MongoHelper.initialize()

let server

before('start main app', function(done) {
  server = App.listen(3000, 'localhost', done)
})

after('stop main app', function(done) {
  if (!server) {
    return done()
  }
  server.close(done)
})
