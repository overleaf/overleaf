const { waitForDb } = require('../../../app/js/mongodb')
const App = require('../../../app.js')
const { PORT } = require('./helpers/request')

before(waitForDb)
before(function (done) {
  return App.listen(PORT, 'localhost', done)
})
