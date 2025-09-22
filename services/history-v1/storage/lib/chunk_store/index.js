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
const metrics = require('@overleaf/metrics')
const { Chunk, History, Snapshot } = require('overleaf-editor-core')

const assert = require('../assert')
const BatchBlobStore = require('../batch_blob_store')
const { BlobStore } = require('../blob_store')
const { historyStore } = require('../history_store')
const mongoBackend = require('./mongo')
const postgresBackend = require('./postgres')
const redisBackend = require('./redis')
const {
  ChunkVersionConflictError,
  VersionOutOfBoundsError,
} = require('./errors')

/**
 * @import { Change } from 'overleaf-editor-core'
 */

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
async function getLatestChunkMetadata(projectId, opts) {
  assert.projectId(projectId, 'bad projectId')

  const backend = getBackend(projectId)
  const chunkMetadata = await backend.getLatestChunk(projectId, opts)
  if (chunkMetadata == null) {
    throw new Chunk.NotFoundError(projectId)
  }
  return chunkMetadata
}

/**
 * Load the latest Chunk stored for a project, including blob metadata.
 *
 * @param {string} projectId
 * @param {object} [opts]
 * @param {boolean} [opts.persistedOnly] - only include persisted changes
 * @return {Promise<Chunk>}
 */
async function loadLatest(projectId, opts = {}) {
  const chunkMetadata = await getLatestChunkMetadata(projectId)
  const rawHistory = await historyStore.loadRaw(projectId, chunkMetadata.id)
  const history = History.fromRaw(rawHistory)

  if (!opts.persistedOnly) {
    const nonPersistedChanges = await getChunkExtension(
      projectId,
      chunkMetadata.endVersion
    )
    history.pushChanges(nonPersistedChanges)
  }

  const blobStore = new BlobStore(projectId)
  const batchBlobStore = new BatchBlobStore(blobStore)
  await lazyLoadHistoryFiles(history, batchBlobStore)
  return new Chunk(history, chunkMetadata.startVersion)
}

/**
 * Load the the chunk that contains the given version, including blob metadata.
 *
 * @param {string} projectId
 * @param {number} version
 * @param {object} [opts]
 * @param {boolean} [opts.persistedOnly] - only include persisted changes
 * @param {boolean} [opts.preferNewer] - If the version is at the boundary of
 *        two chunks, return the newer chunk.
 */
async function loadAtVersion(projectId, version, opts = {}) {
  assert.projectId(projectId, 'bad projectId')
  assert.integer(version, 'bad version')

  const backend = getBackend(projectId)
  const blobStore = new BlobStore(projectId)
  const batchBlobStore = new BatchBlobStore(blobStore)
  const latestChunkMetadata = await getLatestChunkMetadata(projectId)

  // When loading a chunk for a version there are three cases to consider:
  // 1. If `persistedOnly` is true, we always use the requested version
  //  to fetch the chunk.
  // 2. If `persistedOnly` is false and the requested version is in the
  //  persisted chunk version range, we use the requested version.
  // 3. If `persistedOnly` is false and the requested version is ahead of
  //  the persisted chunk versions, we fetch the latest chunk and see if
  //  the non-persisted changes include the requested version.
  const targetChunkVersion = opts.persistedOnly
    ? version
    : Math.min(latestChunkMetadata.endVersion, version)

  const chunkRecord = await backend.getChunkForVersion(
    projectId,
    targetChunkVersion,
    {
      preferNewer: opts.preferNewer,
    }
  )
  const rawHistory = await historyStore.loadRaw(projectId, chunkRecord.id)
  const history = History.fromRaw(rawHistory)
  const startVersion = chunkRecord.endVersion - history.countChanges()

  if (!opts.persistedOnly) {
    // Try to extend the chunk with any non-persisted changes that
    // follow the chunk's end version.
    const nonPersistedChanges = await getChunkExtension(
      projectId,
      chunkRecord.endVersion
    )
    history.pushChanges(nonPersistedChanges)

    // Check that the changes do actually contain the requested version
    if (version > chunkRecord.endVersion + nonPersistedChanges.length) {
      throw new Chunk.VersionNotFoundError(projectId, version)
    }
  }

  await lazyLoadHistoryFiles(history, batchBlobStore)
  return new Chunk(history, startVersion)
}

/**
 * Load the chunk that contains the version that was current at the given
 * timestamp, including blob metadata.
 *
 * @param {string} projectId
 * @param {Date} timestamp
 * @param {object} [opts]
 * @param {boolean} [opts.persistedOnly] - only include persisted changes
 */
async function loadAtTimestamp(projectId, timestamp, opts = {}) {
  assert.projectId(projectId, 'bad projectId')
  assert.date(timestamp, 'bad timestamp')

  const backend = getBackend(projectId)
  const blobStore = new BlobStore(projectId)
  const batchBlobStore = new BatchBlobStore(blobStore)

  const chunkRecord = await backend.getChunkForTimestamp(projectId, timestamp)
  const rawHistory = await historyStore.loadRaw(projectId, chunkRecord.id)
  const history = History.fromRaw(rawHistory)
  const startVersion = chunkRecord.endVersion - history.countChanges()

  if (!opts.persistedOnly) {
    const nonPersistedChanges = await getChunkExtension(
      projectId,
      chunkRecord.endVersion
    )
    history.pushChanges(nonPersistedChanges)
  }

  await lazyLoadHistoryFiles(history, batchBlobStore)
  return new Chunk(history, startVersion)
}

/** Get the changes since a given version (since), including non-persisted changes.
 * Note that if there are multiple chunks since the given version, the changes from
 * the first chunk will be returned with a hasMore flag to indicate that there are
 * more changes available.   The 'since' version is exclusive.
 * @param {string} projectId
 * @param {number} since - version to get changes since (exclusive)
 * @return {Promise<{changes: Change[], hasMore: boolean}>} - object with array of changes and boolean indicating if there are more changes available
 */
async function getChangesSinceVersion(projectId, since) {
  assert.projectId(projectId, 'bad projectId')
  assert.integer(since, 'bad since version')

  // First try to get changes directly from Redis buffer
  const result = await redisBackend.getChangesSinceVersion(projectId, since)
  if (result.status === 'ok') {
    // Successfully got changes from Redis, no more changes available beyond what Redis has
    metrics.inc('chunk_store.get_changes_since_version', 1, {
      source: 'redis',
      hasMore: 'false',
      status: result.status,
    })
    return { changes: result.changes || [], hasMore: false }
  }

  // If status is 'not_found' or 'out_of_bounds', fall through to chunk-based approach
  const chunk = await loadAtVersion(projectId, since, {
    preferNewer: true,
  })

  // Validate that 'since' is within the bounds of the chunk
  if (since < chunk.getStartVersion()) {
    throw new VersionOutOfBoundsError('Chunk does not include since version', {
      projectId,
      since,
    })
  }
  // Extract the changes after 'since' from the chunk
  const changes = chunk.getChanges().slice(since - chunk.getStartVersion())

  // Check if there are more changes beyond the current chunk
  const latestChunkMetadata = await getLatestChunkMetadata(projectId)
  const hasMore = latestChunkMetadata.endVersion > chunk.getEndVersion()
  metrics.inc('chunk_store.get_changes_since_version', 1, {
    source: 'gcs',
    hasMore: hasMore ? 'true' : 'false',
    status: result.status,
  })
  return { changes, hasMore }
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

  const opts = {}
  if (chunkStart > 0) {
    const oldChunk = await backend.getChunkForVersion(projectId, chunkStart)

    if (oldChunk.endVersion !== chunkStart) {
      throw new ChunkVersionConflictError(
        'unexpected end version on chunk to be updated',
        {
          projectId,
          expectedVersion: chunkStart,
          actualVersion: oldChunk.endVersion,
        }
      )
    }

    opts.oldChunkId = oldChunk.id
  }
  if (earliestChangeTimestamp != null) {
    opts.earliestChangeTimestamp = earliestChangeTimestamp
  }

  const chunkId = await uploadChunk(projectId, chunk)
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
 * @param {Chunk} newChunk
 * @param {Date} [earliestChangeTimestamp]
 * @return {Promise}
 */
async function update(projectId, newChunk, earliestChangeTimestamp) {
  assert.projectId(projectId, 'bad projectId')
  assert.instance(newChunk, Chunk, 'bad newChunk')
  assert.maybe.date(earliestChangeTimestamp, 'bad timestamp')

  const backend = getBackend(projectId)
  const oldChunk = await backend.getChunkForVersion(
    projectId,
    newChunk.getStartVersion(),
    { preferNewer: true }
  )

  if (oldChunk.startVersion !== newChunk.getStartVersion()) {
    throw new ChunkVersionConflictError(
      'unexpected start version on chunk to be updated',
      {
        projectId,
        expectedVersion: newChunk.getStartVersion(),
        actualVersion: oldChunk.startVersion,
      }
    )
  }

  if (oldChunk.endVersion > newChunk.getEndVersion()) {
    throw new ChunkVersionConflictError(
      'chunk update would decrease chunk version',
      {
        projectId,
        currentVersion: oldChunk.endVersion,
        newVersion: newChunk.getEndVersion(),
      }
    )
  }

  const newChunkId = await uploadChunk(projectId, newChunk)

  const opts = {}
  if (earliestChangeTimestamp != null) {
    opts.earliestChangeTimestamp = earliestChangeTimestamp
  }

  await backend.confirmUpdate(
    projectId,
    oldChunk.id,
    newChunk,
    newChunkId,
    opts
  )
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
  const latestChunkMetadata = await getLatestChunkMetadata(projectId)
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

/**
 * Gets non-persisted changes that could extend a chunk
 *
 * @param {string} projectId
 * @param {number} chunkEndVersion - end version of the chunk to extend
 *
 * @return {Promise<Change[]>}
 */
async function getChunkExtension(projectId, chunkEndVersion) {
  try {
    const changes = await redisBackend.getNonPersistedChanges(
      projectId,
      chunkEndVersion
    )
    return changes
  } catch (err) {
    if (err instanceof VersionOutOfBoundsError) {
      // If we can't extend the chunk, simply return an empty list
      return []
    } else {
      throw err
    }
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
  getLatestChunkMetadata,
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
  getChangesSinceVersion,
  deleteProjectChunks,
  deleteOldChunks,
  AlreadyInitialized,
  ChunkVersionConflictError,
}
