const app = require('../../../../app')
const Settings = require('@overleaf/settings')

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

module.exports = {
  ensureRunning,
}
