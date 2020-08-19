const Settings = require('settings-sharelatex')
const { MongoClient, ObjectId } = require('mongodb')

const clientConnecting = MongoClient.connect(Settings.mongo.url)
const dbPromise = clientConnecting.then((client) => client.db())

async function getCollection(name) {
  return (await dbPromise).collection(name)
}

module.exports = {
  clientConnecting,
  ObjectId,
  getCollection
}
