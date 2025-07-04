import Metrics from '@overleaf/metrics'
import MongoUtils from '@overleaf/mongo-utils'
import Settings from '@overleaf/settings'
import mongodb from 'mongodb-legacy'

export const mongoClient = new mongodb.MongoClient(
  Settings.mongo.url,
  Settings.mongo.options
)
const mongoDb = mongoClient.db()

export const db = {
  notifications: mongoDb.collection('notifications'),
}

export const ObjectId = mongodb.ObjectId

Metrics.mongodb.monitor(mongoClient)

export async function cleanupTestDatabase() {
  await MongoUtils.cleanupTestDatabase(mongoClient)
}
