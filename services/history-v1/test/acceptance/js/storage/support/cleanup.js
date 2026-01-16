const config = require('config')

const { knex, persistor, mongodb, redis } = require('../../../../../storage')
const { S3Persistor } = require('@overleaf/object-persistor/src/S3Persistor')

const POSTGRES_TABLES = [
  'chunks',
  'project_blobs',
  'old_chunks',
  'pending_chunks',
]

const MONGO_COLLECTIONS = [
  'projectHistoryGlobalBlobs',
  'projectHistoryBlobs',
  'projectHistoryShardedBlobs',
  'projectHistoryChunks',

  // back_fill_file_hash.test.mjs
  'deletedProjects',
  'projects',
  'projectHistoryBackedUpBlobs',
  'migrations',
]

// make sure we don't delete the wrong data by accident
if (process.env.NODE_ENV !== 'test') {
  throw new Error('test cleanup can only be loaded in a test environment')
}

async function cleanupPostgres() {
  for (const table of POSTGRES_TABLES) {
    await knex(table).del()
  }
}

async function cleanupMongo() {
  const collections = await mongodb.db.listCollections().map(c => c.name)
  for await (const collection of collections) {
    if (MONGO_COLLECTIONS.includes(collection)) {
      await mongodb.db.collection(collection).deleteMany({})
    }
  }
}

async function cleanupRedis() {
  await redis.rclientHistory.flushdb()
  await redis.rclientLock.flushdb()
}

async function cleanupPersistor() {
  await Promise.all([
    clearBucket(config.get('blobStore.globalBucket')),
    clearBucket(config.get('blobStore.projectBucket')),
    clearBucket(config.get('chunkStore.bucket')),
    clearBucket(config.get('zipStore.bucket')),
  ])
}

async function clearBucket(name) {
  await persistor.deleteDirectory(name, '')
}

let s3PersistorForBackupCleanup

async function cleanupBackup() {
  if (!config.has('backupStore')) {
    return
  }

  // The backupPersistor refuses to delete short prefixes. Use a low-level S3 persistor.
  if (!s3PersistorForBackupCleanup) {
    const { backupPersistor } =
      await import('../../../../../storage/lib/backupPersistor.mjs')
    s3PersistorForBackupCleanup = new S3Persistor(backupPersistor.settings)
  }
  await Promise.all(
    Object.values(config.get('backupStore')).map(name =>
      s3PersistorForBackupCleanup.deleteDirectory(name, '')
    )
  )
}

async function cleanupEverything() {
  // Set the timeout when called in a Mocha test. This function is also called
  // in benchmarks where it is not passed a Mocha context.
  this.timeout?.(5000)
  await Promise.all([
    cleanupPostgres(),
    cleanupMongo(),
    cleanupPersistor(),
    cleanupBackup(),
    cleanupRedis(),
  ])
}

module.exports = {
  postgres: cleanupPostgres,
  mongo: cleanupMongo,
  persistor: cleanupPersistor,
  backup: cleanupBackup,
  redis: cleanupRedis,
  everything: cleanupEverything,
}
