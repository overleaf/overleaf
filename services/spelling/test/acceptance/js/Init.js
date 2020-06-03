const App = require('../../../app.js')
const { PORT } = require('./helpers/request')

before(function(done) {
  return App.listen(PORT, 'localhost', done)
})
