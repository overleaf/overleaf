const Metrics = require('@overleaf/metrics')

const config = require('config')
const { MongoClient } = require('mongodb')

const client = new MongoClient(config.mongo.uri)
const db = client.db()

const chunks = db.collection('projectHistoryChunks')
const blobs = db.collection('projectHistoryBlobs')
const globalBlobs = db.collection('projectHistoryGlobalBlobs')
const shardedBlobs = db.collection('projectHistoryShardedBlobs')

Metrics.mongodb.monitor(client)

module.exports = { client, db, chunks, blobs, globalBlobs, shardedBlobs }
