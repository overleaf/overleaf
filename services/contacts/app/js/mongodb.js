// @ts-check

import Metrics from '@overleaf/metrics'
import MongoUtils from '@overleaf/mongo-utils'
import Settings from '@overleaf/settings'
import { MongoClient } from 'mongodb'

export { ObjectId } from 'mongodb'

export const mongoClient = new MongoClient(
  Settings.mongo.url,
  Settings.mongo.options
)
const mongoDb = mongoClient.db()

export const db = {
  contacts: mongoDb.collection('contacts'),
}

Metrics.mongodb.monitor(mongoClient)

export async function cleanupTestDatabase() {
  await MongoUtils.cleanupTestDatabase(mongoClient)
}
