import { app } from '../../../app/js/server.js'
import { PORT } from './helpers/request.js'

before(function (done) {
  return app.listen(PORT, 'localhost', done)
})
