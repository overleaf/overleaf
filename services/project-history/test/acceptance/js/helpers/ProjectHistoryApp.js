import { app } from '../../../../app/js/server.js'
import { mongoClient } from '../../../../app/js/mongodb.js'
import './MongoHelper.js'

let running = false
let initPromise = null

async function initialize() {
  try {
    await new Promise((resolve, reject) => {
      app.listen(3054, '127.0.0.1', error => {
        if (error) return reject(error)
        resolve()
      })
    })

    // Wait for mongo
    await mongoClient.connect()

    running = true
  } catch (error) {
    initPromise = null
    throw error
  }
}

export async function ensureRunning() {
  if (running) {
    return
  }

  if (initPromise) {
    return await initPromise
  }

  initPromise = initialize()
  return await initPromise
}
