const Settings = require('settings-sharelatex')
const { MongoClient, ObjectId } = require('mongodb')

const clientPromise = MongoClient.connect(Settings.mongo.url)

async function healthCheck() {
  const internalDb = (await clientPromise).db()
  const res = await internalDb.command({ ping: 1 })
  if (!res.ok) {
    throw new Error('failed mongo ping')
  }
}

async function waitForDb() {
  await clientPromise
}

const db = {}
waitForDb().then(async function () {
  const internalDb = (await clientPromise).db()

  db.docSnapshots = internalDb.collection('docSnapshots')
})

module.exports = {
  db,
  ObjectId,
  healthCheck: require('util').callbackify(healthCheck),
  waitForDb
}
