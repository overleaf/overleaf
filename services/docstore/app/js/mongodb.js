const Settings = require('settings-sharelatex')
const { MongoClient, ObjectId } = require('mongodb')

const clientPromise = MongoClient.connect(Settings.mongo.url)
const dbPromise = clientPromise.then((client) => client.db())

async function getCollection(name) {
  return (await dbPromise).collection(name)
}

async function waitForDb() {
  await clientPromise
}

module.exports = {
  ObjectId,
  getCollection,
  waitForDb
}
