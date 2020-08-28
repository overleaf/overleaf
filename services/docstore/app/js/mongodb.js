const Settings = require('settings-sharelatex')
const { MongoClient, ObjectId } = require('mongodb')

const clientPromise = MongoClient.connect(Settings.mongo.url)

async function waitForDb() {
  await clientPromise
}

const db = {}
waitForDb().then(async function () {
  const internalDb = (await clientPromise).db()

  db.docs = internalDb.collection('docs')
  db.docOps = internalDb.collection('docOps')
})

module.exports = {
  db,
  ObjectId,
  waitForDb
}
