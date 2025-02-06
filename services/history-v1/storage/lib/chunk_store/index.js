'use strict'

/**
 * Manage {@link Chunk} and {@link History} storage.
 *
 * For storage, chunks are immutable. If we want to update a project with new
 * changes, we create a new chunk record and History object and delete the old
 * ones. If we compact a project's history, we similarly destroy the old chunk
 * (or chunks) and replace them with a new one. This is helpful when using S3,
 * because it guarantees only eventual consistency for updates but provides
 * stronger consistency guarantees for object creation.
 *
 * When a chunk record in the database is removed, we save its ID for later
 * in the `old_chunks` table, rather than deleting it immediately. This lets us
 * use batch deletion to reduce the number of delete requests to S3.
 *
 * The chunk store also caches data about which blobs are referenced by each
 * chunk, which allows us to find unused blobs without loading all of the data
 * for all projects from S3. Whenever we create a chunk, we also insert records
 * into the `chunk_blobs` table, to help with this bookkeeping.
 */

const config = require('config')
const OError = require('@overleaf/o-error')
const { Chunk, History, Snapshot } = require('overleaf-editor-core')

const assert = require('../assert')
const BatchBlobStore = require('../batch_blob_store')
const { BlobStore } = require('../blob_store')
const { historyStore } = require('../history_store')
const mongoBackend = require('./mongo')
const postgresBackend = require('./postgres')
const { ChunkVersionConflictError } = require('./errors')

const DEFAULT_DELETE_BATCH_SIZE = parseInt(config.get('maxDeleteKeys'), 10)
const DEFAULT_DELETE_TIMEOUT_SECS = 3000 // 50 minutes
const DEFAULT_DELETE_MIN_AGE_SECS = 86400 // 1 day

/**
 * Create the initial chunk for a project.
 */
async function initializeProject(projectId, snapshot) {
  if (projectId != null) {
    assert.projectId(projectId, 'bad projectId')
  } else {
    projectId = await postgresBackend.generateProjectId()
  }

  if (snapshot != null) {
    assert.instance(snapshot, Snapshot, 'bad snapshot')
  } else {
    snapshot = new Snapshot()
  }

  const blobStore = new BlobStore(projectId)
  await blobStore.initialize()

  const backend = getBackend(projectId)
  const chunkRecord = await backend.getLatestChunk(projectId)
  if (chunkRecord != null) {
    throw new AlreadyInitialized(projectId)
  }

  const history = new History(snapshot, [])
  const chunk = new Chunk(history, 0)
  await create(projectId, chunk)
  return projectId
}

/**
 * Load the blobs referenced in the given history
 */
async function lazyLoadHistoryFiles(history, batchBlobStore) {
  const blobHashes = new Set()
  history.findBlobHashes(blobHashes)

  await batchBlobStore.preload(Array.from(blobHashes))
  await history.loadFiles('lazy', batchBlobStore)
}

/**
 * Load the latest Chunk stored for a project, including blob metadata.
 *
 * @param {string} projectId
 * @param {Object} [opts]
 * @param {boolean} [opts.readOnly]
 * @return {Promise<{id: string, startVersion: number, endVersion: number, endTimestamp: Date}>}
 */
async function loadLatestRaw(projectId, opts) {
  assert.projectId(projectId, 'bad projectId')

  const backend = getBackend(projectId)
  const chunkRecord = await backend.getLatestChunk(projectId, opts)
  if (chunkRecord == null) {
    throw new Chunk.NotFoundError(projectId)
  }
  return chunkRecord
}

/**
 * Load the latest Chunk stored for a project, including blob metadata.
 *
 * @param {string} projectId
 * @return {Promise.<Chunk>}
 */
async function loadLatest(projectId) {
  const chunkRecord = await loadLatestRaw(projectId)
  const rawHistory = await historyStore.loadRaw(projectId, chunkRecord.id)
  const history = History.fromRaw(rawHistory)
  const blobStore = new BlobStore(projectId)
  const batchBlobStore = new BatchBlobStore(blobStore)
  await lazyLoadHistoryFiles(history, batchBlobStore)
  return new Chunk(history, chunkRecord.startVersion)
}

/**
 * Load the the chunk that contains the given version, including blob metadata.
 */
async function loadAtVersion(projectId, version) {
  assert.projectId(projectId, 'bad projectId')
  assert.integer(version, 'bad version')

  const backend = getBackend(projectId)
  const blobStore = new BlobStore(projectId)
  const batchBlobStore = new BatchBlobStore(blobStore)

  const chunkRecord = await backend.getChunkForVersion(projectId, version)
  const rawHistory = await historyStore.loadRaw(projectId, chunkRecord.id)
  const history = History.fromRaw(rawHistory)
  await lazyLoadHistoryFiles(history, batchBlobStore)
  return new Chunk(history, chunkRecord.endVersion - history.countChanges())
}

/**
 * Load the chunk that contains the version that was current at the given
 * timestamp, including blob metadata.
 */
async function loadAtTimestamp(projectId, timestamp) {
  assert.projectId(projectId, 'bad projectId')
  assert.date(timestamp, 'bad timestamp')

  const backend = getBackend(projectId)
  const blobStore = new BlobStore(projectId)
  const batchBlobStore = new BatchBlobStore(blobStore)

  const chunkRecord = await backend.getChunkForTimestamp(projectId, timestamp)
  const rawHistory = await historyStore.loadRaw(projectId, chunkRecord.id)
  const history = History.fromRaw(rawHistory)
  await lazyLoadHistoryFiles(history, batchBlobStore)
  return new Chunk(history, chunkRecord.endVersion - history.countChanges())
}

/**
 * Store the chunk and insert corresponding records in the database.
 *
 * @param {string} projectId
 * @param {Chunk} chunk
 * @return {Promise.<number>} for the chunkId of the inserted chunk
 */
async function create(projectId, chunk) {
  assert.projectId(projectId, 'bad projectId')
  assert.instance(chunk, Chunk, 'bad chunk')

  const backend = getBackend(projectId)
  const chunkId = await uploadChunk(projectId, chunk)
  await backend.confirmCreate(projectId, chunk, chunkId)
}

/**
 * Upload the given chunk to object storage.
 *
 * This is used by the create and update methods.
 */
async function uploadChunk(projectId, chunk) {
  const backend = getBackend(projectId)
  const blobStore = new BlobStore(projectId)

  const historyStoreConcurrency = parseInt(
    config.get('chunkStore.historyStoreConcurrency'),
    10
  )

  const rawHistory = await chunk
    .getHistory()
    .store(blobStore, historyStoreConcurrency)
  const chunkId = await backend.insertPendingChunk(projectId, chunk)
  await historyStore.storeRaw(projectId, chunkId, rawHistory)
  return chunkId
}

/**
 * Extend the project's history by replacing the latest chunk with a new
 * chunk.
 *
 * @param {string} projectId
 * @param {number} oldEndVersion
 * @param {Chunk} newChunk
 * @return {Promise}
 */
async function update(projectId, oldEndVersion, newChunk) {
  assert.projectId(projectId, 'bad projectId')
  assert.integer(oldEndVersion, 'bad oldEndVersion')
  assert.instance(newChunk, Chunk, 'bad newChunk')

  const backend = getBackend(projectId)
  const oldChunkId = await getChunkIdForVersion(projectId, oldEndVersion)
  const newChunkId = await uploadChunk(projectId, newChunk)

  await backend.confirmUpdate(projectId, oldChunkId, newChunk, newChunkId)
}

/**
 * Find the chunk ID for a given version of a project.
 *
 * @param {string} projectId
 * @param {number} version
 * @return {Promise.<number>}
 */
async function getChunkIdForVersion(projectId, version) {
  const backend = getBackend(projectId)
  const chunkRecord = await backend.getChunkForVersion(projectId, version)
  return chunkRecord.id
}

/**
 * Get all of a project's chunk ids
 */
async function getProjectChunkIds(projectId) {
  const backend = getBackend(projectId)
  const chunkIds = await backend.getProjectChunkIds(projectId)
  return chunkIds
}

/**
 * Delete the given chunk from the database.
 *
 * This doesn't delete the chunk from object storage yet. The old chunks
 * collection will do that.
 */
async function destroy(projectId, chunkId) {
  const backend = getBackend(projectId)
  await backend.deleteChunk(projectId, chunkId)
}

/**
 * Delete all of a project's chunks from the database.
 */
async function deleteProjectChunks(projectId) {
  const backend = getBackend(projectId)
  await backend.deleteProjectChunks(projectId)
}

/**
 * Delete a given number of old chunks from both the database
 * and from object storage.
 *
 * @param {number} count - number of chunks to delete
 * @param {number} minAgeSecs - how many seconds ago must chunks have been
 *                              deleted
 * @return {Promise}
 */
async function deleteOldChunks(options = {}) {
  const batchSize = options.batchSize ?? DEFAULT_DELETE_BATCH_SIZE
  const maxBatches = options.maxBatches ?? Number.MAX_SAFE_INTEGER
  const minAgeSecs = options.minAgeSecs ?? DEFAULT_DELETE_MIN_AGE_SECS
  const timeout = options.timeout ?? DEFAULT_DELETE_TIMEOUT_SECS
  assert.greater(batchSize, 0)
  assert.greater(timeout, 0)
  assert.greater(maxBatches, 0)
  assert.greaterOrEqual(minAgeSecs, 0)

  const timeoutAfter = Date.now() + timeout * 1000
  let deletedChunksTotal = 0
  for (const backend of [postgresBackend, mongoBackend]) {
    for (let i = 0; i < maxBatches; i++) {
      if (Date.now() > timeoutAfter) {
        break
      }
      const deletedChunks = await deleteOldChunksBatch(
        backend,
        batchSize,
        minAgeSecs
      )
      deletedChunksTotal += deletedChunks.length
      if (deletedChunks.length !== batchSize) {
        // Last batch was incomplete. There probably are no old chunks left
        break
      }
    }
  }
  return deletedChunksTotal
}

async function deleteOldChunksBatch(backend, count, minAgeSecs) {
  assert.greater(count, 0, 'bad count')
  assert.greaterOrEqual(minAgeSecs, 0, 'bad minAgeSecs')

  const oldChunks = await backend.getOldChunksBatch(count, minAgeSecs)
  if (oldChunks.length === 0) {
    return []
  }
  await historyStore.deleteChunks(oldChunks)
  await backend.deleteOldChunks(oldChunks.map(chunk => chunk.chunkId))
  return oldChunks
}

/**
 * Returns the appropriate backend for the given project id
 *
 * Numeric ids use the Postgres backend.
 * Strings of 24 characters use the Mongo backend.
 */
function getBackend(projectId) {
  if (assert.POSTGRES_ID_REGEXP.test(projectId)) {
    return postgresBackend
  } else if (assert.MONGO_ID_REGEXP.test(projectId)) {
    return mongoBackend
  } else {
    throw new OError('bad project id', { projectId })
  }
}

class AlreadyInitialized extends OError {
  constructor(projectId) {
    super('Project is already initialized', { projectId })
  }
}

module.exports = {
  getBackend,
  initializeProject,
  loadLatest,
  loadLatestRaw,
  loadAtVersion,
  loadAtTimestamp,
  create,
  update,
  destroy,
  getChunkIdForVersion,
  getProjectChunkIds,
  deleteProjectChunks,
  deleteOldChunks,
  AlreadyInitialized,
  ChunkVersionConflictError,
}
