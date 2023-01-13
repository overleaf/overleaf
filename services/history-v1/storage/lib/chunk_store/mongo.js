const { ObjectId } = require('mongodb')
const { Chunk } = require('overleaf-editor-core')
const OError = require('@overleaf/o-error')
const assert = require('../assert')
const mongodb = require('../mongodb')
const { ChunkVersionConflictError } = require('./errors')

const DUPLICATE_KEY_ERROR_CODE = 11000

/**
 * Get the latest chunk's metadata from the database
 */
async function getLatestChunk(projectId) {
  assert.mongoId(projectId, 'bad projectId')

  const record = await mongodb.chunks.findOne(
    { projectId: ObjectId(projectId), state: 'active' },
    { sort: { startVersion: -1 } }
  )
  if (record == null) {
    return null
  }
  return chunkFromRecord(record)
}

/**
 * Get the metadata for the chunk that contains the given version.
 */
async function getChunkForVersion(projectId, version) {
  assert.mongoId(projectId, 'bad projectId')
  assert.integer(version, 'bad version')

  const record = await mongodb.chunks.findOne(
    {
      projectId: ObjectId(projectId),
      state: 'active',
      startVersion: { $lte: version },
      endVersion: { $gte: version },
    },
    { sort: { startVersion: 1 } }
  )
  if (record == null) {
    throw new Chunk.VersionNotFoundError(projectId, version)
  }
  return chunkFromRecord(record)
}

/**
 * Get the metadata for the chunk that contains the version that was current at
 * the given timestamp.
 */
async function getChunkForTimestamp(projectId, timestamp) {
  assert.mongoId(projectId, 'bad projectId')
  assert.date(timestamp, 'bad timestamp')

  const record = await mongodb.chunks.findOne(
    {
      projectId: ObjectId(projectId),
      state: 'active',
      endTimestamp: { $gte: timestamp },
    },
    // We use the index on the startVersion for sorting records. This assumes
    // that timestamps go up with each version.
    { sort: { startVersion: 1 } }
  )

  if (record == null) {
    // Couldn't find a chunk that had modifications after the given timestamp.
    // Fetch the latest chunk instead.
    const chunk = await getLatestChunk(projectId)
    if (chunk == null) {
      throw new Chunk.BeforeTimestampNotFoundError(projectId, timestamp)
    }
    return chunk
  }

  return chunkFromRecord(record)
}

/**
 * Get all of a project's chunk ids
 */
async function getProjectChunkIds(projectId) {
  assert.mongoId(projectId, 'bad projectId')

  const cursor = mongodb.chunks.find(
    { projectId: ObjectId(projectId), state: 'active' },
    { projection: { _id: 1 } }
  )
  return await cursor.map(record => record._id).toArray()
}

/**
 * Insert a pending chunk before sending it to object storage.
 */
async function insertPendingChunk(projectId, chunk) {
  assert.mongoId(projectId, 'bad projectId')
  assert.instance(chunk, Chunk, 'bad chunk')

  const chunkId = new ObjectId()
  await mongodb.chunks.insertOne({
    _id: chunkId,
    projectId: ObjectId(projectId),
    startVersion: chunk.getStartVersion(),
    endVersion: chunk.getEndVersion(),
    endTimestamp: chunk.getEndTimestamp(),
    state: 'pending',
    updatedAt: new Date(),
  })
  return chunkId.toString()
}

/**
 * Record that a new chunk was created.
 */
async function confirmCreate(projectId, chunk, chunkId) {
  assert.mongoId(projectId, 'bad projectId')
  assert.instance(chunk, Chunk, 'bad chunk')
  assert.mongoId(chunkId, 'bad chunkId')

  let result
  try {
    result = await mongodb.chunks.updateOne(
      {
        _id: ObjectId(chunkId),
        projectId: ObjectId(projectId),
        state: 'pending',
      },
      { $set: { state: 'active', updatedAt: new Date() } }
    )
  } catch (err) {
    if (err.code === DUPLICATE_KEY_ERROR_CODE) {
      throw new ChunkVersionConflictError('chunk start version is not unique', {
        projectId,
        chunkId,
      })
    } else {
      throw err
    }
  }
  if (result.matchedCount === 0) {
    throw new OError('pending chunk not found', { projectId, chunkId })
  }
}

/**
 * Record that a chunk was replaced by a new one.
 */
async function confirmUpdate(projectId, oldChunkId, newChunk, newChunkId) {
  assert.mongoId(projectId, 'bad projectId')
  assert.mongoId(oldChunkId, 'bad oldChunkId')
  assert.instance(newChunk, Chunk, 'bad newChunk')
  assert.mongoId(newChunkId, 'bad newChunkId')

  const session = mongodb.client.startSession()
  try {
    await session.withTransaction(async () => {
      await deleteChunk(projectId, oldChunkId)
      await confirmCreate(projectId, newChunk, newChunkId)
    })
  } finally {
    await session.endSession()
  }
}

/**
 * Delete a chunk.
 *
 * @param {number} projectId
 * @param {number} chunkId
 * @return {Promise}
 */
async function deleteChunk(projectId, chunkId) {
  assert.mongoId(projectId, 'bad projectId')
  assert.mongoId(chunkId, 'bad chunkId')

  await mongodb.chunks.updateOne(
    { _id: ObjectId(chunkId), projectId: ObjectId(projectId) },
    { $set: { state: 'deleted', updatedAt: new Date() } }
  )
}

/**
 * Delete all of a project's chunks
 */
async function deleteProjectChunks(projectId) {
  assert.mongoId(projectId, 'bad projectId')

  await mongodb.chunks.updateMany(
    { projectId: ObjectId(projectId) },
    { $set: { state: 'deleted', updatedAt: new Date() } }
  )
}

/**
 * Get a batch of old chunks for deletion
 */
async function getOldChunksBatch(count, minAgeSecs) {
  const maxUpdatedAt = new Date(Date.now() - minAgeSecs * 1000)
  const cursor = mongodb.chunks.find(
    {
      state: { $in: ['deleted', 'pending'] },
      updatedAt: { $lt: maxUpdatedAt },
    },
    {
      limit: count,
      projection: { _id: 1, projectId: 1 },
    }
  )
  return await cursor
    .map(record => ({
      chunkId: record._id,
      projectId: record.projectId,
    }))
    .toArray()
}

/**
 * Delete a batch of old chunks from the database
 */
async function deleteOldChunks(chunkIds) {
  await mongodb.chunks.deleteMany({ _id: { $in: chunkIds }, state: 'deleted' })
}

/**
 * Build a chunk metadata object from the database record
 */
function chunkFromRecord(record) {
  return {
    id: record._id.toString(),
    startVersion: record.startVersion,
    endVersion: record.endVersion,
  }
}

module.exports = {
  getLatestChunk,
  getChunkForVersion,
  getChunkForTimestamp,
  getProjectChunkIds,
  insertPendingChunk,
  confirmCreate,
  confirmUpdate,
  deleteChunk,
  deleteProjectChunks,
  getOldChunksBatch,
  deleteOldChunks,
}
