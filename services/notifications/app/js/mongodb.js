// @ts-check

const Metrics = require('@overleaf/metrics')
const MongoUtils = require('@overleaf/mongo-utils')
const Settings = require('@overleaf/settings')
const { MongoClient, ObjectId } = require('mongodb-legacy')

const mongoClient = new MongoClient(Settings.mongo.url, Settings.mongo.options)
const mongoDb = mongoClient.db()

const db = {
  notifications: mongoDb.collection('notifications'),
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
