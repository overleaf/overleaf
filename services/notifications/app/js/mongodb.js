const Settings = require('settings-sharelatex')
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

  db.notifications = internalDb.collection('notifications')
}

module.exports = {
  db,
  ObjectId,
  waitForDb
}
