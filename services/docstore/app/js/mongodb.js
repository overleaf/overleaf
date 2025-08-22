// @ts-check

const Metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const MongoUtils = require('@overleaf/mongo-utils')
const { MongoClient, ObjectId } = require('mongodb-legacy')

const mongoClient = new MongoClient(Settings.mongo.url, Settings.mongo.options)
const mongoDb = mongoClient.db()

const db = {
  docs: mongoDb.collection('docs'),
}

Metrics.mongodb.monitor(mongoClient)

async function cleanupTestDatabase() {
  await MongoUtils.cleanupTestDatabase(mongoClient)
}

module.exports = {
  db,
  mongoClient,
  ObjectId,
  cleanupTestDatabase,
}
