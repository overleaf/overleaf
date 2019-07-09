const App = require('../../../app.js')
const { PORT } = require('./helpers/request')

before(done => App.listen(PORT, 'localhost', done))
