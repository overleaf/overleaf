const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const config = require('config')
const fetch = require('node-fetch')
const { knex, redis } = require('../storage')
const { exec } = require('node:child_process')
const { promisify } = require('node:util')
const testLogRecorder = require('@overleaf/logger/test-log-recorder')

// ensure every ObjectId has the id string as a property for correct comparisons
require('mongodb').ObjectId.cacheHexString = true

chai.use(chaiAsPromised)
chai.config.truncateThreshold = 0

async function setupPostgresDatabase() {
  this.timeout(60_000)
  await knex.migrate.latest()
}

async function setupMongoDatabase() {
  this.timeout(60_000)
  await promisify(exec)(
    // Run saas migrations for backup indexes
    `cd ../../tools/migrations && npm run migrations -- migrate -t saas`
  )
}

async function createGcsBuckets() {
  this.timeout(60_000)
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
  await redis.disconnect()
}

module.exports = {
  setupPostgresDatabase,
  createGcsBuckets,
  tearDownConnectionPool,
  mochaHooks: {
    beforeAll: [setupPostgresDatabase, setupMongoDatabase, createGcsBuckets],
    afterAll: [tearDownConnectionPool],
    beforeEach: process.env.CI === 'true' ? [testLogRecorder] : [],
  },
}
