import app from '../../../../app.js'
import Settings from '@overleaf/settings'
import testLogRecorder from '@overleaf/logger/test-log-recorder.js'

function startApp() {
  return new Promise((resolve, reject) => {
    app.listen(
      Settings.internal.clsi.port,
      Settings.internal.clsi.host,
      error => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      }
    )
  })
}

let appStartedPromise

async function ensureRunning() {
  if (!appStartedPromise) {
    appStartedPromise = startApp()
  }
  await appStartedPromise
}

if (process.env.CI === 'true') {
  beforeEach('record error logs in junit', testLogRecorder)
}

export default {
  ensureRunning,
}
