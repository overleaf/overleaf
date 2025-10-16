const app = require('../../../../app')
require('./MongoHelper')

function startApp() {
  return new Promise((resolve, reject) => {
    app.listen(3003, '127.0.0.1', error => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
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
