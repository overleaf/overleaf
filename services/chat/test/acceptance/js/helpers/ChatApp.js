import { createServer } from '../../../../app/js/server.js'
import { promisify } from 'node:util'
import './MongoHelper.js'
import testLogRecorder from '@overleaf/logger/test-log-recorder.js'

export { db } from '../../../../app/js/mongodb.js'

let serverPromise = null

export async function ensureRunning() {
  if (!serverPromise) {
    const { app } = await createServer()
    const startServer = promisify(app.listen.bind(app))
    serverPromise = startServer(3010, '127.0.0.1')
  }
  return serverPromise
}

if (process.env.CI === 'true') {
  beforeEach('record error logs in junit', testLogRecorder)
}
