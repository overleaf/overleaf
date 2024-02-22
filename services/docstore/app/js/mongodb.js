const Metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const { MongoClient, ObjectId } = require('mongodb-legacy')

const mongoClient = new MongoClient(Settings.mongo.url, Settings.mongo.options)
const mongoDb = mongoClient.db()

const db = {
  docs: mongoDb.collection('docs'),
}

Metrics.mongodb.monitor(mongoClient)

module.exports = {
  db,
  mongoClient,
  ObjectId,
}
