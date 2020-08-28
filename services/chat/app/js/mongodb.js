const Settings = require('settings-sharelatex')
const { MongoClient, ObjectId } = require('mongodb')

const clientPromise = MongoClient.connect(Settings.mongo.url)

async function waitForDb() {
  await clientPromise
}

const db = {}
waitForDb().then(async function () {
  const internalDb = (await clientPromise).db()

  db.messages = internalDb.collection('messages')
  db.rooms = internalDb.collection('rooms')
})

module.exports = {
  db,
  ObjectId,
  waitForDb
}
