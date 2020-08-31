const Settings = require('settings-sharelatex')
const { MongoClient, ObjectId } = require('mongodb')

const clientPromise = MongoClient.connect(Settings.mongo.url)

async function waitForDb() {
  await clientPromise
}

const db = {}
waitForDb().then(async function () {
  const internalDb = (await clientPromise).db()

  db.notifications = internalDb.collection('notifications')
})

module.exports = {
  db,
  ObjectId,
  waitForDb
}
