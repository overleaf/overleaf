import { app } from '../../../app/js/server.js'
import { PORT } from './helpers/request.js'

before(function (done) {
  return app.listen(PORT, '127.0.0.1', done)
})
