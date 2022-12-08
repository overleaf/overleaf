const { db } = require('../../../../app/js/mongodb')
const app = require('../../../../app')

let serverPromise = null
function startServer(resolve, reject) {
  app.listen(3010, 'localhost', error => {
    if (error) {
      return reject(error)
    }
    resolve()
  })
}

async function ensureRunning() {
  if (!serverPromise) {
    serverPromise = new Promise(startServer)
  }
  return serverPromise
}

module.exports = {
  db,
  ensureRunning,
}
