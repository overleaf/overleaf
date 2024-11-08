const crypto = require('node:crypto')
const benny = require('benny')
const { Blob } = require('overleaf-editor-core')
const mongoBackend = require('../storage/lib/blob_store/mongo')
const postgresBackend = require('../storage/lib/blob_store/postgres')
const cleanup = require('../test/acceptance/js/storage/support/cleanup')

const MONGO_PROJECT_ID = '637386deb4ce3c62acd3848e'
const POSTGRES_PROJECT_ID = '123'

async function run() {
  for (const blobCount of [1, 10, 100, 1000, 10000, 100000, 500000]) {
    await cleanup.everything()
    const blobs = createBlobs(blobCount)
    await insertBlobs(blobs)
    const randomHashes = getRandomHashes(blobs, 100)
    await benny.suite(
      `Read a blob in a project with ${blobCount} blobs`,
      benny.add('Mongo backend', async () => {
        await mongoBackend.findBlob(MONGO_PROJECT_ID, randomHashes[0])
      }),
      benny.add('Postgres backend', async () => {
        await postgresBackend.findBlob(POSTGRES_PROJECT_ID, randomHashes[0])
      }),
      benny.cycle(),
      benny.complete()
    )
    await benny.suite(
      `Read 100 blobs in a project with ${blobCount} blobs`,
      benny.add('Mongo backend', async () => {
        await mongoBackend.findBlobs(MONGO_PROJECT_ID, randomHashes)
      }),
      benny.add('Postgres backend', async () => {
        await postgresBackend.findBlobs(POSTGRES_PROJECT_ID, randomHashes)
      }),
      benny.cycle(),
      benny.complete()
    )
    await benny.suite(
      `Insert a blob in a project with ${blobCount} blobs`,
      benny.add('Mongo backend', async () => {
        const [newBlob] = createBlobs(1)
        await mongoBackend.insertBlob(MONGO_PROJECT_ID, newBlob)
      }),
      benny.add('Postgres backend', async () => {
        const [newBlob] = createBlobs(1)
        await postgresBackend.insertBlob(POSTGRES_PROJECT_ID, newBlob)
      }),
      benny.cycle(),
      benny.complete()
    )
  }
}

function createBlobs(blobCount) {
  const blobs = []
  for (let i = 0; i < blobCount; i++) {
    const hash = crypto.randomBytes(20).toString('hex')
    blobs.push(new Blob(hash, 42, 42))
  }
  return blobs
}

async function insertBlobs(blobs) {
  for (const blob of blobs) {
    await Promise.all([
      mongoBackend.insertBlob(MONGO_PROJECT_ID, blob),
      postgresBackend.insertBlob(POSTGRES_PROJECT_ID, blob),
    ])
  }
}

function getRandomHashes(blobs, count) {
  const hashes = []
  for (let i = 0; i < count; i++) {
    const index = Math.floor(Math.random() * blobs.length)
    hashes.push(blobs[index].getHash())
  }
  return hashes
}

module.exports = run
