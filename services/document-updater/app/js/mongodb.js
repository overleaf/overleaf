// @ts-check

const Metrics = require('@overleaf/metrics')
const MongoUtils = require('@overleaf/mongo-utils')
const Settings = require('@overleaf/settings')
const { MongoClient, ObjectId, ReadPreference } = require('mongodb-legacy')

const READ_PREFERENCE_SECONDARY = Settings.mongo.hasSecondaries
  ? ReadPreference.secondary.mode
  : ReadPreference.secondaryPreferred.mode

const mongoClient = new MongoClient(Settings.mongo.url, Settings.mongo.options)
const mongoDb = mongoClient.db()

const db = {
  docs: mongoDb.collection('docs'),
  docSnapshots: mongoDb.collection('docSnapshots'),
  projects: mongoDb.collection('projects'),
}

async function healthCheck() {
  const res = await mongoDb.command({ ping: 1 })
  if (!res.ok) {
    throw new Error('failed mongo ping')
  }
}

Metrics.mongodb.monitor(mongoClient)

async function cleanupTestDatabase() {
  await MongoUtils.cleanupTestDatabase(mongoClient)
}

module.exports = {
  db,
  ObjectId,
  mongoClient,
  healthCheck: require('node:util').callbackify(healthCheck),
  cleanupTestDatabase,
  READ_PREFERENCE_SECONDARY,
}
