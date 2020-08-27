const Settings = require('settings-sharelatex')
const { MongoClient, ObjectId } = require('mongodb')

const clientPromise = MongoClient.connect(Settings.mongo.url)

async function getCollection(name) {
  return (await clientPromise).db().collection(name)
}

async function waitForDb() {
  await clientPromise
}

const db = {}
waitForDb().then(async function () {
  db.messages = await getCollection('messages')
  db.rooms = await getCollection('rooms')
})

module.exports = {
  db,
  ObjectId,
  getCollection,
  waitForDb
}
