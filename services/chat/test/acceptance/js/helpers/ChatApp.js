import { server } from '../../../../app/js/server.js'

export { db } from '../../../../app/js/mongodb.js'

let serverPromise = null
function startServer(resolve, reject) {
  server.listen(3010, 'localhost', error => {
    if (error) {
      return reject(error)
    }
    resolve()
  })
}

export async function ensureRunning() {
  if (!serverPromise) {
    serverPromise = new Promise(startServer)
  }
  return serverPromise
}
