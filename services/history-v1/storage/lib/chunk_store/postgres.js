// @ts-check

const { Chunk } = require('overleaf-editor-core')
const assert = require('../assert')
const knex = require('../knex')
const knexReadOnly = require('../knex_read_only')
const { ChunkVersionConflictError } = require('./errors')
const {
  updateProjectRecord,
  lookupMongoProjectIdFromHistoryId,
} = require('./mongo')

const DUPLICATE_KEY_ERROR_CODE = '23505'

/**
 * @import { Knex } from 'knex'
 */

/**
 * Get the latest chunk's metadata from the database
 * @param {string} projectId
 * @param {Object} [opts]
 * @param {boolean} [opts.readOnly]
 */
async function getLatestChunk(projectId, opts = {}) {
  assert.postgresId(projectId, 'bad projectId')
  const { readOnly = false } = opts

  const record = await (readOnly ? knexReadOnly : knex)('chunks')
    .where('doc_id', parseInt(projectId, 10))
    .orderBy('end_version', 'desc')
    .first()
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
  assert.postgresId(projectId, 'bad projectId')

  const record = await knex('chunks')
    .where('doc_id', parseInt(projectId, 10))
    .where('start_version', '<=', version)
    .where('end_version', '>=', version)
    .orderBy('end_version', opts.preferNewer ? 'desc' : 'asc')
    .first()
  if (!record) {
    throw new Chunk.VersionNotFoundError(projectId, version)
  }
  return chunkFromRecord(record)
}

/**
 * Get the metadata for the chunk that contains the version that was current at
 * the given timestamp.
 *
 * @param {string} projectId
 * @param {Date} timestamp
 */
async function getChunkForTimestamp(projectId, timestamp) {
  assert.postgresId(projectId, 'bad projectId')

  // This query will find the latest chunk after the timestamp (query orders
  // in reverse chronological order), OR the latest chunk
  // This accounts for the case where the timestamp is ahead of the chunk's
  // timestamp and therefore will not return any results
  const whereAfterEndTimestampOrLatestChunk = knex.raw(
    'end_timestamp >= ? ' +
      'OR id = ( ' +
      'SELECT id FROM chunks ' +
      'WHERE doc_id = ? ' +
      'ORDER BY end_version desc LIMIT 1' +
      ')',
    [timestamp, parseInt(projectId, 10)]
  )

  const record = await knex('chunks')
    .where('doc_id', parseInt(projectId, 10))
    .where(whereAfterEndTimestampOrLatestChunk)
    .orderBy('end_version')
    .first()
  if (!record) {
    throw new Chunk.BeforeTimestampNotFoundError(projectId, timestamp)
  }
  return chunkFromRecord(record)
}

/**
 * Build a chunk metadata object from the database record
 */
function chunkFromRecord(record) {
  return {
    id: record.id.toString(),
    startVersion: record.start_version,
    endVersion: record.end_version,
    endTimestamp: record.end_timestamp,
  }
}

/**
 * Get all of a project's chunk ids
 *
 * @param {string} projectId
 */
async function getProjectChunkIds(projectId) {
  assert.postgresId(projectId, 'bad projectId')

  const records = await knex('chunks')
    .select('id')
    .where('doc_id', parseInt(projectId, 10))
  return records.map(record => record.id)
}

/**
 * Get all of a projects chunks directly
 *
 * @param {string} projectId
 */
async function getProjectChunks(projectId) {
  assert.postgresId(projectId, 'bad projectId')

  const records = await knex('chunks')
    .select()
    .where('doc_id', parseInt(projectId, 10))
    .orderBy('end_version')
  return records.map(chunkFromRecord)
}

/**
 * Insert a pending chunk before sending it to object storage.
 *
 * @param {string} projectId
 * @param {Chunk} chunk
 */
async function insertPendingChunk(projectId, chunk) {
  assert.postgresId(projectId, 'bad projectId')

  const result = await knex.first(
    knex.raw("nextval('chunks_id_seq'::regclass)::integer as chunkid")
  )
  const chunkId = result.chunkid
  await knex('pending_chunks').insert({
    id: chunkId,
    doc_id: parseInt(projectId, 10),
    end_version: chunk.getEndVersion(),
    start_version: chunk.getStartVersion(),
    end_timestamp: chunk.getEndTimestamp(),
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
  assert.postgresId(projectId, 'bad projectId')

  await knex.transaction(async tx => {
    if (opts.oldChunkId != null) {
      await _assertChunkIsNotClosed(tx, projectId, opts.oldChunkId)
      await _closeChunk(tx, projectId, opts.oldChunkId)
    }
    await Promise.all([
      _deletePendingChunk(tx, projectId, chunkId),
      _insertChunk(tx, projectId, chunk, chunkId),
    ])
    await updateProjectRecord(
      // The history id in Mongo is an integer for Postgres projects
      parseInt(projectId, 10),
      chunk,
      opts.earliestChangeTimestamp
    )
  })
}

/**
 * Record that a chunk was replaced by a new one.
 *
 * @param {string} projectId
 * @param {string} oldChunkId
 * @param {Chunk} newChunk
 * @param {string} newChunkId
 */
async function confirmUpdate(
  projectId,
  oldChunkId,
  newChunk,
  newChunkId,
  opts = {}
) {
  assert.postgresId(projectId, 'bad projectId')

  await knex.transaction(async tx => {
    await _assertChunkIsNotClosed(tx, projectId, oldChunkId)
    await _deleteChunks(tx, { doc_id: projectId, id: oldChunkId })
    await Promise.all([
      _deletePendingChunk(tx, projectId, newChunkId),
      _insertChunk(tx, projectId, newChunk, newChunkId),
    ])
    await updateProjectRecord(
      // The history id in Mongo is an integer for Postgres projects
      parseInt(projectId, 10),
      newChunk,
      opts.earliestChangeTimestamp
    )
  })
}

/**
 * Delete a pending chunk
 *
 * @param {Knex} tx
 * @param {string} projectId
 * @param {string} chunkId
 */
async function _deletePendingChunk(tx, projectId, chunkId) {
  await tx('pending_chunks')
    .where({
      doc_id: parseInt(projectId, 10),
      id: parseInt(chunkId, 10),
    })
    .del()
}

/**
 * Adds an active chunk
 *
 * @param {Knex} tx
 * @param {string} projectId
 * @param {Chunk} chunk
 * @param {string} chunkId
 */
async function _insertChunk(tx, projectId, chunk, chunkId) {
  const startVersion = chunk.getStartVersion()
  const endVersion = chunk.getEndVersion()
  try {
    await tx('chunks').insert({
      id: parseInt(chunkId, 10),
      doc_id: parseInt(projectId, 10),
      start_version: startVersion,
      end_version: endVersion,
      end_timestamp: chunk.getEndTimestamp(),
    })
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      err.code === DUPLICATE_KEY_ERROR_CODE
    ) {
      throw new ChunkVersionConflictError(
        'chunk start or end version is not unique',
        { projectId, chunkId, startVersion, endVersion }
      )
    }
    throw err
  }
}

/**
 * Check that a chunk is not closed
 *
 * This is used to synchronize chunk creations and extensions.
 *
 * @param {Knex} tx
 * @param {string} projectId
 * @param {string} chunkId
 */
async function _assertChunkIsNotClosed(tx, projectId, chunkId) {
  const record = await tx('chunks')
    .forUpdate()
    .select('closed')
    .where('doc_id', parseInt(projectId, 10))
    .where('id', parseInt(chunkId, 10))
    .first()
  if (!record) {
    throw new ChunkVersionConflictError('unable to close chunk: not found', {
      projectId,
      chunkId,
    })
  }
  if (record.closed) {
    throw new ChunkVersionConflictError(
      'unable to close chunk: already closed',
      {
        projectId,
        chunkId,
      }
    )
  }
}

/**
 * Close a chunk
 *
 * A closed chunk can no longer be extended.
 *
 * @param {Knex} tx
 * @param {string} projectId
 * @param {string} chunkId
 */
async function _closeChunk(tx, projectId, chunkId) {
  await tx('chunks')
    .update({ closed: true })
    .where('doc_id', parseInt(projectId, 10))
    .where('id', parseInt(chunkId, 10))
}

/**
 * Delete a chunk.
 *
 * @param {string} projectId
 * @param {string} chunkId
 */
async function deleteChunk(projectId, chunkId) {
  assert.postgresId(projectId, 'bad projectId')
  assert.integer(chunkId, 'bad chunkId')

  await _deleteChunks(knex, {
    doc_id: parseInt(projectId, 10),
    id: parseInt(chunkId, 10),
  })
}

/**
 * Delete all of a project's chunks
 *
 * @param {string} projectId
 */
async function deleteProjectChunks(projectId) {
  assert.postgresId(projectId, 'bad projectId')

  await knex.transaction(async tx => {
    await _deleteChunks(knex, { doc_id: parseInt(projectId, 10) })
  })
}

/**
 * Delete many chunks
 *
 * @param {Knex} tx
 * @param {any} whereClause
 */
async function _deleteChunks(tx, whereClause) {
  const rows = await tx('chunks').where(whereClause).del().returning('*')
  if (rows.length === 0) {
    return
  }

  const oldChunks = rows.map(row => ({
    doc_id: row.doc_id,
    chunk_id: row.id,
    start_version: row.start_version,
    end_version: row.end_version,
    end_timestamp: row.end_timestamp,
    deleted_at: tx.fn.now(),
  }))
  await tx('old_chunks').insert(oldChunks)
}

/**
 * Get a batch of old chunks for deletion
 *
 * @param {number} count
 * @param {number} minAgeSecs
 */
async function getOldChunksBatch(count, minAgeSecs) {
  const maxDeletedAt = new Date(Date.now() - minAgeSecs * 1000)
  const records = await knex('old_chunks')
    .whereNull('deleted_at')
    .orWhere('deleted_at', '<', maxDeletedAt)
    .orderBy('chunk_id')
    .limit(count)
  return records.map(oldChunk => ({
    projectId: oldChunk.doc_id.toString(),
    chunkId: oldChunk.chunk_id.toString(),
  }))
}

/**
 * Delete a batch of old chunks from the database
 *
 * @param {string[]} chunkIds
 */
async function deleteOldChunks(chunkIds) {
  await knex('old_chunks')
    .whereIn(
      'chunk_id',
      chunkIds.map(id => parseInt(id, 10))
    )
    .del()
}

/**
 * Generate a new project id
 */
async function generateProjectId() {
  const record = await knex.first(
    knex.raw("nextval('docs_id_seq'::regclass)::integer as doc_id")
  )
  return record.doc_id.toString()
}

async function resolveHistoryIdToMongoProjectId(projectId) {
  return await lookupMongoProjectIdFromHistoryId(parseInt(projectId, 10))
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
  deleteChunk,
  deleteProjectChunks,
  getOldChunksBatch,
  deleteOldChunks,
  generateProjectId,
  resolveHistoryIdToMongoProjectId,
}
