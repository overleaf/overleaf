const Settings = require('settings-sharelatex')
const { MongoClient, ObjectId } = require('mongodb')

const clientPromise = MongoClient.connect(Settings.mongo.url)

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

  db.messages = internalDb.collection('messages')
  db.rooms = internalDb.collection('rooms')
}

module.exports = {
  db,
  ObjectId,
  waitForDb
}
