// @ts-check

const { ObjectId, ReadPreference, MongoError } = require('mongodb')
const { Chunk } = require('overleaf-editor-core')
const OError = require('@overleaf/o-error')
const config = require('config')
const assert = require('../assert')
const mongodb = require('../mongodb')
const { ChunkVersionConflictError } = require('./errors')

const DUPLICATE_KEY_ERROR_CODE = 11000

/**
 * @import { ClientSession } from 'mongodb'
 */

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
    {
      projectId: new ObjectId(projectId),
      state: { $in: ['active', 'closed'] },
    },
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
 *
 * @param {string} projectId
 * @param {number} version
 * @param {object} [opts]
 * @param {boolean} [opts.preferNewer] - If the version is at the boundary of
 *        two chunks, return the newer chunk.
 */
async function getChunkForVersion(projectId, version, opts = {}) {
  assert.mongoId(projectId, 'bad projectId')
  assert.integer(version, 'bad version')

  const record = await mongodb.chunks.findOne(
    {
      projectId: new ObjectId(projectId),
      state: { $in: ['active', 'closed'] },
      startVersion: { $lte: version },
      endVersion: { $gte: version },
    },
    { sort: { startVersion: opts.preferNewer ? -1 : 1 } }
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
      state: { $in: ['active', 'closed'] },
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
    {
      projectId: new ObjectId(projectId),
      state: { $in: ['active', 'closed'] },
    },
    { projection: { _id: 1 } }
  )
  return await cursor.map(record => record._id).toArray()
}

/**
 * Get all of a projects chunks directly
 */
async function getProjectChunks(projectId) {
  assert.mongoId(projectId, 'bad projectId')

  const cursor = mongodb.chunks
    .find(
      {
        projectId: new ObjectId(projectId),
        state: { $in: ['active', 'closed'] },
      },
      { projection: { state: 0 } }
    )
    .sort({ startVersion: 1 })
  return await cursor.map(chunkFromRecord).toArray()
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
 *
 * @param {string} projectId
 * @param {Chunk} chunk
 * @param {string} chunkId
 * @param {object} opts
 * @param {Date} [opts.earliestChangeTimestamp]
 * @param {string} [opts.oldChunkId]
 */
async function confirmCreate(projectId, chunk, chunkId, opts = {}) {
  assert.mongoId(projectId, 'bad projectId')
  assert.instance(chunk, Chunk, 'bad newChunk')
  assert.mongoId(chunkId, 'bad newChunkId')

  await mongodb.client.withSession(async session => {
    await session.withTransaction(async () => {
      if (opts.oldChunkId != null) {
        await closeChunk(projectId, opts.oldChunkId, { session })
      }

      await activateChunk(projectId, chunkId, { session })

      await updateProjectRecord(
        projectId,
        chunk,
        opts.earliestChangeTimestamp,
        { session }
      )
    })
  })
}

/**
 * Write the metadata to the project record
 */
async function updateProjectRecord(
  projectId,
  chunk,
  earliestChangeTimestamp,
  mongoOpts = {}
) {
  if (!config.has('backupStore')) {
    return
  }
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
          earliestChangeTimestamp || chunk.getEndTimestamp() || new Date(),
      },
    },
    mongoOpts
  )
}

/**
 * @param {number} historyId
 * @return {Promise<string>}
 */
async function lookupMongoProjectIdFromHistoryId(historyId) {
  const project = await mongodb.projects.findOne(
    // string for Object ids, number for postgres ids
    { 'overleaf.history.id': historyId },
    { projection: { _id: 1 } }
  )
  if (!project) {
    // should not happen: We flush before allowing a project to be soft-deleted.
    throw new OError('mongo project not found by history id', { historyId })
  }
  return project._id.toString()
}

async function resolveHistoryIdToMongoProjectId(projectId) {
  return projectId
}

/**
 * Record that a chunk was replaced by a new one.
 *
 * @param {string} projectId
 * @param {string} oldChunkId
 * @param {Chunk} newChunk
 * @param {string} newChunkId
 * @param {object} [opts]
 * @param {Date} [opts.earliestChangeTimestamp]
 */
async function confirmUpdate(
  projectId,
  oldChunkId,
  newChunk,
  newChunkId,
  opts = {}
) {
  assert.mongoId(projectId, 'bad projectId')
  assert.mongoId(oldChunkId, 'bad oldChunkId')
  assert.instance(newChunk, Chunk, 'bad newChunk')
  assert.mongoId(newChunkId, 'bad newChunkId')

  await mongodb.client.withSession(async session => {
    await session.withTransaction(async () => {
      await deleteActiveChunk(projectId, oldChunkId, { session })

      await activateChunk(projectId, newChunkId, { session })

      await updateProjectRecord(
        projectId,
        newChunk,
        opts.earliestChangeTimestamp,
        { session }
      )
    })
  })
}

/**
 * Activate a pending chunk
 *
 * @param {string} projectId
 * @param {string} chunkId
 * @param {object} [opts]
 * @param {ClientSession} [opts.session]
 */
async function activateChunk(projectId, chunkId, opts = {}) {
  assert.mongoId(projectId, 'bad projectId')
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
      opts
    )
  } catch (err) {
    if (err instanceof MongoError && err.code === DUPLICATE_KEY_ERROR_CODE) {
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
 * Close a chunk
 *
 * A closed chunk is one that can't be extended anymore.
 *
 * @param {string} projectId
 * @param {string} chunkId
 * @param {object} [opts]
 * @param {ClientSession} [opts.session]
 */
async function closeChunk(projectId, chunkId, opts = {}) {
  const result = await mongodb.chunks.updateOne(
    {
      _id: new ObjectId(chunkId),
      projectId: new ObjectId(projectId),
      state: 'active',
    },
    { $set: { state: 'closed' } },
    opts
  )

  if (result.matchedCount === 0) {
    throw new ChunkVersionConflictError('unable to close chunk', {
      projectId,
      chunkId,
    })
  }
}

/**
 * Delete an active chunk
 *
 * This is used to delete chunks that are in the process of being extended. It
 * will refuse to delete chunks that are already closed and can therefore not be
 * extended.
 *
 * @param {string} projectId
 * @param {string} chunkId
 * @param {object} [opts]
 * @param {ClientSession} [opts.session]
 */
async function deleteActiveChunk(projectId, chunkId, opts = {}) {
  const updateResult = await mongodb.chunks.updateOne(
    {
      _id: new ObjectId(chunkId),
      projectId: new ObjectId(projectId),
      state: 'active',
    },
    { $set: { state: 'deleted', updatedAt: new Date() } },
    opts
  )

  if (updateResult.matchedCount === 0) {
    throw new ChunkVersionConflictError('unable to delete active chunk', {
      projectId,
      chunkId,
    })
  }
}

/**
 * Delete a chunk.
 *
 * @param {string} projectId
 * @param {string} chunkId
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
    {
      projectId: new ObjectId(projectId),
      state: { $in: ['active', 'closed'] },
    },
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
  getProjectChunks,
  insertPendingChunk,
  confirmCreate,
  confirmUpdate,
  updateProjectRecord,
  deleteChunk,
  deleteProjectChunks,
  getOldChunksBatch,
  deleteOldChunks,
  lookupMongoProjectIdFromHistoryId,
  resolveHistoryIdToMongoProjectId,
}
