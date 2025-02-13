const { Chunk } = require('overleaf-editor-core')
const assert = require('../assert')
const knex = require('../knex')
const knexReadOnly = require('../knex_read_only')
const { ChunkVersionConflictError } = require('./errors')
const { updateProjectRecord } = require('./mongo')

const DUPLICATE_KEY_ERROR_CODE = '23505'

/**
 * Get the latest chunk's metadata from the database
 * @param {string} projectId
 * @param {Object} [opts]
 * @param {boolean} [opts.readOnly]
 */
async function getLatestChunk(projectId, opts = {}) {
  assert.postgresId(projectId, `bad projectId ${projectId}`)
  projectId = parseInt(projectId, 10)
  const { readOnly = false } = opts

  const record = await (readOnly ? knexReadOnly : knex)('chunks')
    .where('doc_id', projectId)
    .orderBy('end_version', 'desc')
    .first()
  if (record == null) {
    return null
  }
  return chunkFromRecord(record)
}

/**
 * Get the metadata for the chunk that contains the given version.
 */
async function getChunkForVersion(projectId, version) {
  assert.postgresId(projectId, `bad projectId ${projectId}`)
  projectId = parseInt(projectId, 10)

  const record = await knex('chunks')
    .where('doc_id', projectId)
    .where('end_version', '>=', version)
    .orderBy('end_version')
    .first()
  if (!record) {
    throw new Chunk.VersionNotFoundError(projectId, version)
  }
  return chunkFromRecord(record)
}

/**
 * Get the metadata for the chunk that contains the version that was current at
 * the given timestamp.
 */
async function getChunkForTimestamp(projectId, timestamp) {
  assert.postgresId(projectId, `bad projectId ${projectId}`)
  projectId = parseInt(projectId, 10)

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
    [timestamp, projectId]
  )

  const record = await knex('chunks')
    .where('doc_id', projectId)
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
    id: record.id,
    startVersion: record.start_version,
    endVersion: record.end_version,
    endTimestamp: record.end_timestamp,
  }
}

/**
 * Get all of a project's chunk ids
 */
async function getProjectChunkIds(projectId) {
  assert.postgresId(projectId, `bad projectId ${projectId}`)
  projectId = parseInt(projectId, 10)

  const records = await knex('chunks').select('id').where('doc_id', projectId)
  return records.map(record => record.id)
}

/**
 * Insert a pending chunk before sending it to object storage.
 */
async function insertPendingChunk(projectId, chunk) {
  assert.postgresId(projectId, `bad projectId ${projectId}`)
  projectId = parseInt(projectId, 10)

  const result = await knex.first(
    knex.raw("nextval('chunks_id_seq'::regclass)::integer as chunkid")
  )
  const chunkId = result.chunkid
  await knex('pending_chunks').insert({
    id: chunkId,
    doc_id: projectId,
    end_version: chunk.getEndVersion(),
    start_version: chunk.getStartVersion(),
    end_timestamp: chunk.getEndTimestamp(),
  })
  return chunkId
}

/**
 * Record that a new chunk was created.
 */
async function confirmCreate(projectId, chunk, chunkId) {
  assert.postgresId(projectId, `bad projectId ${projectId}`)
  projectId = parseInt(projectId, 10)

  await knex.transaction(async tx => {
    await Promise.all([
      _deletePendingChunk(tx, projectId, chunkId),
      _insertChunk(tx, projectId, chunk, chunkId),
    ])
    await updateProjectRecord(projectId, chunk)
  })
}

/**
 * Record that a chunk was replaced by a new one.
 */
async function confirmUpdate(projectId, oldChunkId, newChunk, newChunkId) {
  assert.postgresId(projectId, `bad projectId ${projectId}`)
  projectId = parseInt(projectId, 10)

  await knex.transaction(async tx => {
    await _deleteChunks(tx, { doc_id: projectId, id: oldChunkId })
    await Promise.all([
      _deletePendingChunk(tx, projectId, newChunkId),
      _insertChunk(tx, projectId, newChunk, newChunkId),
    ])
    await updateProjectRecord(projectId, newChunk)
  })
}

async function _deletePendingChunk(tx, projectId, chunkId) {
  await tx('pending_chunks')
    .where({
      doc_id: projectId,
      id: chunkId,
    })
    .del()
}

async function _insertChunk(tx, projectId, chunk, chunkId) {
  const startVersion = chunk.getStartVersion()
  const endVersion = chunk.getEndVersion()
  try {
    await tx('chunks').insert({
      id: chunkId,
      doc_id: projectId,
      start_version: startVersion,
      end_version: endVersion,
      end_timestamp: chunk.getEndTimestamp(),
    })
  } catch (err) {
    if (err.code === DUPLICATE_KEY_ERROR_CODE) {
      throw new ChunkVersionConflictError(
        'chunk start or end version is not unique',
        { projectId, chunkId, startVersion, endVersion }
      )
    }
    throw err
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
  assert.postgresId(projectId, `bad projectId ${projectId}`)
  projectId = parseInt(projectId, 10)
  assert.integer(chunkId, 'bad chunkId')

  await _deleteChunks(knex, { doc_id: projectId, id: chunkId })
}

/**
 * Delete all of a project's chunks
 */
async function deleteProjectChunks(projectId) {
  assert.postgresId(projectId, `bad projectId ${projectId}`)
  projectId = parseInt(projectId, 10)

  await knex.transaction(async tx => {
    await _deleteChunks(knex, { doc_id: projectId })
  })
}

async function _deleteChunks(tx, whereClause) {
  const rows = await tx('chunks').returning('*').where(whereClause).del()
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
    chunkId: oldChunk.chunk_id,
  }))
}

/**
 * Delete a batch of old chunks from the database
 */
async function deleteOldChunks(chunkIds) {
  await knex('old_chunks').whereIn('chunk_id', chunkIds).del()
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
  generateProjectId,
}
