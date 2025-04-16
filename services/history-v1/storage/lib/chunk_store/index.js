// @ts-check

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
 * @param {Date} [earliestChangeTimestamp]
 */
async function create(projectId, chunk, earliestChangeTimestamp) {
  assert.projectId(projectId, 'bad projectId')
  assert.instance(chunk, Chunk, 'bad chunk')
  assert.maybe.date(earliestChangeTimestamp, 'bad timestamp')

  const backend = getBackend(projectId)
  const chunkStart = chunk.getStartVersion()
  const chunkId = await uploadChunk(projectId, chunk)

  const opts = {}
  if (chunkStart > 0) {
    opts.oldChunkId = await getChunkIdForVersion(projectId, chunkStart - 1)
  }
  if (earliestChangeTimestamp != null) {
    opts.earliestChangeTimestamp = earliestChangeTimestamp
  }

  await backend.confirmCreate(projectId, chunk, chunkId, opts)
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
 * @param {Date} [earliestChangeTimestamp]
 * @return {Promise}
 */
async function update(
  projectId,
  oldEndVersion,
  newChunk,
  earliestChangeTimestamp
) {
  assert.projectId(projectId, 'bad projectId')
  assert.integer(oldEndVersion, 'bad oldEndVersion')
  assert.instance(newChunk, Chunk, 'bad newChunk')
  assert.maybe.date(earliestChangeTimestamp, 'bad timestamp')

  const backend = getBackend(projectId)
  const oldChunkId = await getChunkIdForVersion(projectId, oldEndVersion)
  const newChunkId = await uploadChunk(projectId, newChunk)

  const opts = {}
  if (earliestChangeTimestamp != null) {
    opts.earliestChangeTimestamp = earliestChangeTimestamp
  }

  await backend.confirmUpdate(projectId, oldChunkId, newChunk, newChunkId, opts)
}

/**
 * Find the chunk ID for a given version of a project.
 *
 * @param {string} projectId
 * @param {number} version
 * @return {Promise.<string>}
 */
async function getChunkIdForVersion(projectId, version) {
  const backend = getBackend(projectId)
  const chunkRecord = await backend.getChunkForVersion(projectId, version)
  return chunkRecord.id
}

/**
 * Find the chunk metadata for a given version of a project.
 *
 * @param {string} projectId
 * @param {number} version
 * @return {Promise.<{id: string|number, startVersion: number, endVersion: number}>}
 */
async function getChunkMetadataForVersion(projectId, version) {
  const backend = getBackend(projectId)
  const chunkRecord = await backend.getChunkForVersion(projectId, version)
  return chunkRecord
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
 * Get all of a projects chunks directly
 */
async function getProjectChunks(projectId) {
  const backend = getBackend(projectId)
  const chunkIds = await backend.getProjectChunks(projectId)
  return chunkIds
}

/**
 * Load the chunk for a given chunk record, including blob metadata.
 */
async function loadByChunkRecord(projectId, chunkRecord) {
  const blobStore = new BlobStore(projectId)
  const batchBlobStore = new BatchBlobStore(blobStore)
  const { raw: rawHistory, buffer: chunkBuffer } =
    await historyStore.loadRawWithBuffer(projectId, chunkRecord.id)
  const history = History.fromRaw(rawHistory)
  await lazyLoadHistoryFiles(history, batchBlobStore)
  return {
    chunk: new Chunk(history, chunkRecord.endVersion - history.countChanges()),
    chunkBuffer,
  }
}

/**
 * Asynchronously retrieves project chunks starting from a specific version.
 *
 * This generator function yields chunk records for a given project starting from the specified version (inclusive).
 * It continues to fetch and yield subsequent chunk records until the end version of the latest chunk metadata is reached.
 * If you want to fetch all the chunks *after* a version V, call this function with V+1.
 *
 * @param {string} projectId - The ID of the project.
 * @param {number} version - The starting version to retrieve chunks from.
 * @returns {AsyncGenerator<Object, void, undefined>} An async generator that yields chunk records.
 */
async function* getProjectChunksFromVersion(projectId, version) {
  const backend = getBackend(projectId)
  const latestChunkMetadata = await loadLatestRaw(projectId)
  if (!latestChunkMetadata || version > latestChunkMetadata.endVersion) {
    return
  }
  let chunkRecord = await backend.getChunkForVersion(projectId, version)
  while (chunkRecord != null) {
    yield chunkRecord
    if (chunkRecord.endVersion >= latestChunkMetadata.endVersion) {
      break
    } else {
      chunkRecord = await backend.getChunkForVersion(
        projectId,
        chunkRecord.endVersion + 1
      )
    }
  }
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
 * @param {object} options
 * @param {number} [options.batchSize] - number of chunks to delete in each
 *                                       batch
 * @param {number} [options.maxBatches] - maximum number of batches to process
 * @param {number} [options.minAgeSecs] - minimum age of chunks to delete
 * @param {number} [options.timeout] - maximum time to spend deleting chunks
 *
 * @return {Promise<number>} number of chunks deleted
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
  loadByChunkRecord,
  create,
  update,
  destroy,
  getChunkIdForVersion,
  getChunkMetadataForVersion,
  getProjectChunkIds,
  getProjectChunks,
  getProjectChunksFromVersion,
  deleteProjectChunks,
  deleteOldChunks,
  AlreadyInitialized,
  ChunkVersionConflictError,
}
