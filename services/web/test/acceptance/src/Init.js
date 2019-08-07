const App = require('../../../app.js')
require('logger-sharelatex').logger.level('error')

before(function(done) {
  return App.listen(3000, 'localhost', done)
})
