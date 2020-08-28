const Settings = require('settings-sharelatex')
const { MongoClient, ObjectId } = require('mongodb')

const clientPromise = MongoClient.connect(Settings.mongo.url)

async function getCollection(name) {
  return (await clientPromise).db().collection(name)
}

async function waitForDb() {
  await clientPromise
}

module.exports = {
  ObjectId,
  getCollection,
  waitForDb
}
