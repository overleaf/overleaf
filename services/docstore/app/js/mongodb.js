// @ts-check

import Metrics from '@overleaf/metrics'

import Settings from '@overleaf/settings'
import MongoUtils from '@overleaf/mongo-utils'
import mongodb from 'mongodb-legacy'

const { MongoClient, ObjectId } = mongodb

const mongoClient = new MongoClient(Settings.mongo.url, Settings.mongo.options)
const mongoDb = mongoClient.db()

const db = {
  docs: mongoDb.collection('docs'),
}

Metrics.mongodb.monitor(mongoClient)

async function cleanupTestDatabase() {
  await MongoUtils.cleanupTestDatabase(mongoClient)
}

export default {
  db,
  mongoClient,
  ObjectId,
  cleanupTestDatabase,
}
