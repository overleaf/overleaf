const Settings = require('@overleaf/settings')
const { MongoClient, ObjectId } = require('mongodb')

const clientPromise = MongoClient.connect(
  Settings.mongo.url,
  Settings.mongo.options
)

async function healthCheck() {
  const internalDb = (await clientPromise).db()
  const res = await internalDb.command({ ping: 1 })
  if (!res.ok) {
    throw new Error('failed mongo ping')
  }
}

let setupDbPromise
async function waitForDb() {
  if (!setupDbPromise) {
    setupDbPromise = setupDb()
  }
  await setupDbPromise
}

const db = {}
async function setupDb() {
  const internalDb = (await clientPromise).db()

  db.docSnapshots = internalDb.collection('docSnapshots')
}

module.exports = {
  db,
  ObjectId,
  healthCheck: require('util').callbackify(healthCheck),
  waitForDb,
}
