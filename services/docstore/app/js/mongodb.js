const Settings = require('@overleaf/settings')
const { MongoClient, ObjectId } = require('mongodb')

const clientPromise = MongoClient.connect(
  Settings.mongo.url,
  Settings.mongo.options
)

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

  db.docs = internalDb.collection('docs')
  db.docOps = internalDb.collection('docOps')
}
async function addCollection(name) {
  await waitForDb()
  const internalDb = (await clientPromise).db()

  db[name] = internalDb.collection(name)
}

module.exports = {
  db,
  ObjectId,
  addCollection,
  waitForDb,
}
