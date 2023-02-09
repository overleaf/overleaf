import Metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import { MongoClient } from 'mongodb'

export { ObjectId } from 'mongodb'

export const mongoClient = new MongoClient(Settings.mongo.url)
const mongoDb = mongoClient.db()

Metrics.mongodb.monitor(mongoClient)

export const db = {
  deletedProjects: mongoDb.collection('deletedProjects'),
  projects: mongoDb.collection('projects'),
  projectHistoryFailures: mongoDb.collection('projectHistoryFailures'),
  projectHistoryLabels: mongoDb.collection('projectHistoryLabels'),
  projectHistorySyncState: mongoDb.collection('projectHistorySyncState'),
}
