const App = require('../../../app.js')
const { logger } = require('logger-sharelatex')

before(done => App.listen(3000, 'localhost', done))

beforeEach(() => {
  // log level is reset in several places throughout the code, can't be set
  // in a single global `before` step
  logger.level('fatal')
})
