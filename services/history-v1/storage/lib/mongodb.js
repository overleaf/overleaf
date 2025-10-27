// @ts-check

const Metrics = require('@overleaf/metrics')
const MongoUtils = require('@overleaf/mongo-utils')

const config = require('config')
const { MongoClient } = require('mongodb')

const client = new MongoClient(config.mongo.uri)
const db = client.db()

const chunks = db.collection('projectHistoryChunks')
const blobs = db.collection('projectHistoryBlobs')
const globalBlobs = db.collection('projectHistoryGlobalBlobs')
const shardedBlobs = db.collection('projectHistoryShardedBlobs')
const projects = db.collection('projects')
const deletedProjects = db.collection('deletedProjects')
// Temporary collection for tracking progress of backed up old blobs (without a hash).
// The initial sync process will be able to skip over these.
// Schema: _id: projectId, blobs: [Binary]
const backedUpBlobs = db.collection('projectHistoryBackedUpBlobs')

Metrics.mongodb.monitor(client)

async function cleanupTestDatabase() {
  await MongoUtils.cleanupTestDatabase(client)
}

module.exports = {
  client,
  db,
  chunks,
  blobs,
  globalBlobs,
  projects,
  deletedProjects,
  shardedBlobs,
  backedUpBlobs,
  cleanupTestDatabase,
}
