const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const config = require('config')
const fetch = require('node-fetch')
const { knex, mongodb } = require('../storage')

// ensure every ObjectId has the id string as a property for correct comparisons
require('mongodb').ObjectId.cacheHexString = true

chai.use(chaiAsPromised)

async function setupPostgresDatabase() {
  await knex.migrate.latest()
}

async function setupMongoDatabase() {
  await mongodb.db.collection('projectHistoryChunks').createIndexes([
    {
      key: { projectId: 1, startVersion: 1 },
      name: 'projectId_1_startVersion_1',
      partialFilterExpression: { state: 'active' },
      unique: true,
    },
    {
      key: { state: 1 },
      name: 'state_1',
      partialFilterExpression: { state: 'deleted' },
    },
  ])
}

async function createGcsBuckets() {
  for (const bucket of [
    config.get('blobStore.globalBucket'),
    config.get('blobStore.projectBucket'),
    config.get('chunkStore.bucket'),
    config.get('zipStore.bucket'),
    'fake-user-files-gcs',
  ]) {
    await fetch('http://gcs:9090/storage/v1/b', {
      method: 'POST',
      body: JSON.stringify({ name: bucket }),
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Tear down the connection pool after all the tests have run, so the process
// can exit.
async function tearDownConnectionPool() {
  await knex.destroy()
}

module.exports = {
  setupPostgresDatabase,
  createGcsBuckets,
  tearDownConnectionPool,
  mochaHooks: {
    beforeAll: [setupPostgresDatabase, setupMongoDatabase, createGcsBuckets],
    afterAll: [tearDownConnectionPool],
  },
}
