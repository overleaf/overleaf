const { ObjectId, ReadPreference } = require('mongodb')
const { Chunk } = require('overleaf-editor-core')
const OError = require('@overleaf/o-error')
const assert = require('../assert')
const mongodb = require('../mongodb')
const { ChunkVersionConflictError } = require('./errors')

const DUPLICATE_KEY_ERROR_CODE = 11000

/**
 * Get the latest chunk's metadata from the database
 * @param {string} projectId
 * @param {Object} [opts]
 * @param {boolean} [opts.readOnly]
 */
async function getLatestChunk(projectId, opts = {}) {
  assert.mongoId(projectId, 'bad projectId')
  const { readOnly = false } = opts

  const record = await mongodb.chunks.findOne(
    { projectId: new ObjectId(projectId), state: 'active' },
    {
      sort: { startVersion: -1 },
      readPreference: readOnly
        ? ReadPreference.secondaryPreferred
        : ReadPreference.primary,
    }
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
      projectId: new ObjectId(projectId),
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
      projectId: new ObjectId(projectId),
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
    { projectId: new ObjectId(projectId), state: 'active' },
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
    projectId: new ObjectId(projectId),
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
async function confirmCreate(projectId, chunk, chunkId, mongoOpts = {}) {
  assert.mongoId(projectId, 'bad projectId')
  assert.instance(chunk, Chunk, 'bad chunk')
  assert.mongoId(chunkId, 'bad chunkId')

  let result
  try {
    result = await mongodb.chunks.updateOne(
      {
        _id: new ObjectId(chunkId),
        projectId: new ObjectId(projectId),
        state: 'pending',
      },
      { $set: { state: 'active', updatedAt: new Date() } },
      mongoOpts
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
  await updateProjectRecord(projectId, chunk, mongoOpts)
}

/**
 * Write the metadata to the project record
 */
async function updateProjectRecord(projectId, chunk, mongoOpts = {}) {
  // record the end version against the project
  await mongodb.projects.updateOne(
    {
      'overleaf.history.id': projectId, // string for Object ids, number for postgres ids
    },
    {
      // always store the latest end version and timestamp for the chunk
      $max: {
        'overleaf.history.currentEndVersion': chunk.getEndVersion(),
        'overleaf.history.currentEndTimestamp': chunk.getEndTimestamp(),
        'overleaf.history.updatedAt': new Date(),
      },
      // store the first pending change timestamp for the chunk, this will
      // be cleared every time a backup is completed.
      $min: {
        'overleaf.backup.pendingChangeAt':
          chunk.getEndTimestamp() || new Date(),
      },
    },
    mongoOpts
  )
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
      await deleteChunk(projectId, oldChunkId, { session })
      await confirmCreate(projectId, newChunk, newChunkId, { session })
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
async function deleteChunk(projectId, chunkId, mongoOpts = {}) {
  assert.mongoId(projectId, 'bad projectId')
  assert.mongoId(chunkId, 'bad chunkId')

  await mongodb.chunks.updateOne(
    { _id: new ObjectId(chunkId), projectId: new ObjectId(projectId) },
    { $set: { state: 'deleted', updatedAt: new Date() } },
    mongoOpts
  )
}

/**
 * Delete all of a project's chunks
 */
async function deleteProjectChunks(projectId) {
  assert.mongoId(projectId, 'bad projectId')

  await mongodb.chunks.updateMany(
    { projectId: new ObjectId(projectId), state: 'active' },
    { $set: { state: 'deleted', updatedAt: new Date() } }
  )
}

/**
 * Get a batch of old chunks for deletion
 */
async function getOldChunksBatch(count, minAgeSecs) {
  const maxUpdatedAt = new Date(Date.now() - minAgeSecs * 1000)
  const batch = []

  // We need to fetch one state at a time to take advantage of the partial
  // indexes on the chunks collection.
  //
  // Mongo 6.0 allows partial indexes that use the $in operator. When we reach
  // that Mongo version, we can create a partial index on both the deleted and
  // pending states and simplify this logic a bit.
  for (const state of ['deleted', 'pending']) {
    if (count === 0) {
      // There's no more space in the batch
      break
    }

    const cursor = mongodb.chunks
      .find(
        { state, updatedAt: { $lt: maxUpdatedAt } },
        {
          limit: count,
          projection: { _id: 1, projectId: 1 },
        }
      )
      .map(record => ({
        chunkId: record._id.toString(),
        projectId: record.projectId.toString(),
      }))

    for await (const record of cursor) {
      batch.push(record)
      count -= 1
    }
  }
  return batch
}

/**
 * Delete a batch of old chunks from the database
 */
async function deleteOldChunks(chunkIds) {
  await mongodb.chunks.deleteMany({
    _id: { $in: chunkIds.map(id => new ObjectId(id)) },
    state: { $in: ['deleted', 'pending'] },
  })
}

/**
 * Build a chunk metadata object from the database record
 */
function chunkFromRecord(record) {
  return {
    id: record._id.toString(),
    startVersion: record.startVersion,
    endVersion: record.endVersion,
    endTimestamp: record.endTimestamp,
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
  updateProjectRecord,
  deleteChunk,
  deleteProjectChunks,
  getOldChunksBatch,
  deleteOldChunks,
}
