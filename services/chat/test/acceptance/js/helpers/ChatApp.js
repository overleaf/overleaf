const { db, waitForDb } = require('../../../../app/js/mongodb')
const app = require('../../../../app')

let serverPromise = null
function startServer(resolve, reject) {
  waitForDb()
    .then(() => {
      app.listen(3010, 'localhost', error => {
        if (error) {
          return reject(error)
        }
        resolve()
      })
    })
    .catch(reject)
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
