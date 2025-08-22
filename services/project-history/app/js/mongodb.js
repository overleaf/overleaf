import Metrics from '@overleaf/metrics'
import MongoUtils from '@overleaf/mongo-utils'
import Settings from '@overleaf/settings'
import mongodb from 'mongodb-legacy'
const { MongoClient, ObjectId } = mongodb

/**
 * @import { ProjectHistoryFailure } from './mongo-types'
 */

export { ObjectId }

export const mongoClient = new MongoClient(
  Settings.mongo.url,
  Settings.mongo.options
)
const mongoDb = mongoClient.db()

Metrics.mongodb.monitor(mongoClient)

async function cleanupTestDatabase() {
  await MongoUtils.cleanupTestDatabase(mongoClient)
}

export const db = {
  deletedProjects: mongoDb.collection('deletedProjects'),
  projects: mongoDb.collection('projects'),
  /** @type {mongodb.Collection<ProjectHistoryFailure>} */
  projectHistoryFailures: mongoDb.collection('projectHistoryFailures'),
  projectHistoryLabels: mongoDb.collection('projectHistoryLabels'),
  projectHistorySyncState: mongoDb.collection('projectHistorySyncState'),
  cleanupTestDatabase,
}
