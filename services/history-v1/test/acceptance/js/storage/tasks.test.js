'use strict'

const { ObjectId } = require('mongodb')
const { expect } = require('chai')
const config = require('config')
const tasks = require('../../../../storage/tasks')
const {
  persistor,
  historyStore,
  knex,
  mongodb,
} = require('../../../../storage')
const cleanup = require('./support/cleanup')

const CHUNK_STORE_BUCKET = config.get('chunkStore.bucket')
const postgresProjectId = 1
const mongoProjectId = new ObjectId('abcdefabcdefabcdefabcdef')

describe('tasks', function () {
  beforeEach(cleanup.everything)

  const options = {
    batchSize: 3,
    timeout: 3000,
    minAgeSecs: 3600,
    maxBatches: 1000,
  }

  it('deletes old chunks', async function () {
    const postgresChunks = []
    const mongoChunks = []

    for (let i = 1; i <= 25; i++) {
      const deletedAt = new Date(Date.now() - 86400000)
      const startVersion = (i - 1) * 10
      const endVersion = i * 10
      postgresChunks.push({
        chunk_id: i,
        doc_id: postgresProjectId,
        start_version: startVersion,
        end_version: endVersion,
        deleted_at: deletedAt,
      })
      mongoChunks.push({
        _id: new ObjectId(i.toString().padStart(24, '0')),
        projectId: mongoProjectId,
        startVersion,
        endVersion,
        state: 'deleted',
        updatedAt: deletedAt,
      })
    }

    for (let i = 26; i <= 30; i++) {
      const deletedAt = new Date()
      const startVersion = (i - 1) * 10
      const endVersion = i * 10
      postgresChunks.push({
        chunk_id: i,
        doc_id: postgresProjectId,
        start_version: startVersion,
        end_version: endVersion,
        deleted_at: deletedAt,
      })
      mongoChunks.push({
        _id: new ObjectId(i.toString().padStart(24, '0')),
        projectId: mongoProjectId,
        startVersion,
        endVersion,
        state: 'deleted',
        updatedAt: deletedAt,
      })
    }

    await knex('old_chunks').insert(postgresChunks)
    await mongodb.chunks.insertMany(mongoChunks)
    await Promise.all([
      ...postgresChunks.map(chunk =>
        historyStore.storeRaw(
          postgresProjectId.toString(),
          chunk.chunk_id.toString(),
          {
            history: 'raw history',
          }
        )
      ),
      ...mongoChunks.map(chunk =>
        historyStore.storeRaw(mongoProjectId.toString(), chunk._id.toString(), {
          history: 'raw history',
        })
      ),
    ])
    await expectChunksExist(1, 30, true)
    await tasks.deleteOldChunks(options)
    await expectChunksExist(1, 25, false)
    await expectChunksExist(26, 30, true)
  })
})

async function expectChunksExist(minChunkId, maxChunkId, expected) {
  const keys = []
  for (let i = minChunkId; i <= maxChunkId; i++) {
    keys.push(`100/000/000/${i.toString().padStart(9, '0')}`)
    keys.push(`fed/cba/fedcbafedcbafedcba/${i.toString().padStart(24, '0')}`)
  }
  return await Promise.all(
    keys.map(async key => {
      const exists = await persistor.checkIfObjectExists(
        CHUNK_STORE_BUCKET,
        key
      )
      expect(exists).to.equal(expected)
    })
  )
}
