// @ts-check
'use strict'

const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const OError = require('@overleaf/o-error')
const assert = require('./assert')
const chunkStore = require('./chunk_store')
const { BlobStore } = require('./blob_store')
const BatchBlobStore = require('./batch_blob_store')
const persistChanges = require('./persist_changes')
const resyncProject = require('./resync_project')
const redisBackend = require('./chunk_store/redis')

const PERSIST_BATCH_SIZE = 50

/**
 * Persist the changes from Redis buffer to the main storage
 *
 * Algorithm Outline:
 * 1. Get the latest chunk's endVersion from the database
 * 2. Get non-persisted changes from Redis that are after this endVersion.
 * 3. If no such changes, exit.
 * 4. Load file blobs for these Redis changes.
 * 5. Run the persistChanges() algorithm to store these changes into a new chunk(s) in GCS.
 *    - This must not decrease the endVersion. If changes were processed, it must advance.
 * 6. Set the new persisted version (endVersion of the latest persisted chunk) in Redis.
 *
 * @param {string} projectId
 * @param {Object} limits
 * @throws {Error | OError} If a critical error occurs during persistence.
 */
async function persistBuffer(projectId, limits) {
  assert.projectId(projectId)
  logger.debug({ projectId }, 'starting persistBuffer operation')

  // 1. Get the latest chunk's endVersion from GCS/main store
  let endVersion
  const latestChunkMetadata = await chunkStore.getLatestChunkMetadata(projectId)

  if (latestChunkMetadata) {
    endVersion = latestChunkMetadata.endVersion
  } else {
    endVersion = 0 // No chunks found, start from version 0
    logger.debug({ projectId }, 'no existing chunks found in main storage')
  }
  const originalEndVersion = endVersion

  logger.debug({ projectId, endVersion }, 'got latest persisted chunk')

  // Process changes in batches
  let numberOfChangesPersisted = 0
  let currentChunk = null
  let resyncNeeded = false
  let resyncChangesWerePersisted = false
  while (true) {
    // 2. Get non-persisted changes from Redis
    const changesToPersist = await redisBackend.getNonPersistedChanges(
      projectId,
      endVersion,
      { maxChanges: PERSIST_BATCH_SIZE }
    )

    if (changesToPersist.length === 0) {
      break
    }

    logger.debug(
      {
        projectId,
        endVersion,
        count: changesToPersist.length,
      },
      'found changes in Redis to persist'
    )

    // 4. Load file blobs for these Redis changes. Errors will propagate.
    const blobStore = new BlobStore(projectId)
    const batchBlobStore = new BatchBlobStore(blobStore)

    const blobHashes = new Set()
    for (const change of changesToPersist) {
      change.findBlobHashes(blobHashes)
    }
    if (blobHashes.size > 0) {
      await batchBlobStore.preload(Array.from(blobHashes))
    }
    for (const change of changesToPersist) {
      await change.loadFiles('lazy', blobStore)
    }

    // 5. Run the persistChanges() algorithm. Errors will propagate.
    logger.debug(
      {
        projectId,
        endVersion,
        changeCount: changesToPersist.length,
      },
      'calling persistChanges'
    )

    const persistResult = await persistChanges(
      projectId,
      changesToPersist,
      limits,
      endVersion
    )

    if (!persistResult || !persistResult.currentChunk) {
      metrics.inc('persist_buffer', 1, { status: 'no-chunk-error' })
      throw new OError(
        'persistChanges did not produce a new chunk for non-empty changes',
        {
          projectId,
          endVersion,
          changeCount: changesToPersist.length,
        }
      )
    }

    currentChunk = persistResult.currentChunk
    const newEndVersion = currentChunk.getEndVersion()

    if (newEndVersion <= endVersion) {
      metrics.inc('persist_buffer', 1, { status: 'chunk-version-mismatch' })
      throw new OError(
        'persisted chunk endVersion must be greater than current persisted chunk end version for non-empty changes',
        {
          projectId,
          newEndVersion,
          endVersion,
          changeCount: changesToPersist.length,
        }
      )
    }

    logger.debug(
      {
        projectId,
        oldVersion: endVersion,
        newVersion: newEndVersion,
      },
      'successfully persisted changes from Redis to main storage'
    )

    // 6. Set the persisted version in Redis. Errors will propagate.
    const status = await redisBackend.setPersistedVersion(
      projectId,
      newEndVersion
    )

    if (status !== 'ok') {
      metrics.inc('persist_buffer', 1, { status: 'error-on-persisted-version' })
      throw new OError('failed to update persisted version in Redis', {
        projectId,
        newEndVersion,
        status,
      })
    }

    logger.debug(
      { projectId, newEndVersion },
      'updated persisted version in Redis'
    )
    numberOfChangesPersisted += persistResult.numberOfChangesPersisted
    endVersion = newEndVersion

    // Check if a resync might be needed
    if (persistResult.resyncNeeded) {
      resyncNeeded = true
    }

    if (
      changesToPersist.some(
        change => change.getOrigin()?.getKind() === 'history-resync'
      )
    ) {
      resyncChangesWerePersisted = true
    }

    if (persistResult.numberOfChangesPersisted < PERSIST_BATCH_SIZE) {
      // We reached the end of available changes
      break
    }
  }

  if (numberOfChangesPersisted === 0) {
    logger.debug(
      { projectId, endVersion },
      'no new changes in Redis buffer to persist'
    )
    metrics.inc('persist_buffer', 1, { status: 'no_changes' })
    // No changes to persist, update the persisted version in Redis
    // to match the current endVersion.  This shouldn't be needed
    // unless a worker failed to update the persisted version.
    await redisBackend.setPersistedVersion(projectId, endVersion)
  } else {
    logger.debug(
      { projectId, finalPersistedVersion: endVersion },
      'persistBuffer operation completed successfully'
    )
    metrics.inc('persist_buffer', 1, { status: 'persisted' })
  }

  if (limits.autoResync && resyncNeeded) {
    if (resyncChangesWerePersisted) {
      // To avoid an infinite loop, do not resync if the current batch of
      // changes contains a history resync.
      logger.warn(
        { projectId },
        'content hash validation failed while persisting a history resync, skipping additional resync'
      )
    } else {
      const backend = chunkStore.getBackend(projectId)
      const mongoProjectId =
        await backend.resolveHistoryIdToMongoProjectId(projectId)
      await resyncProject(mongoProjectId)
    }
  }

  if (currentChunk == null) {
    const { chunk } = await chunkStore.loadByChunkRecord(
      projectId,
      latestChunkMetadata
    )
    currentChunk = chunk
  }

  return {
    numberOfChangesPersisted,
    originalEndVersion,
    currentChunk,
    resyncNeeded,
  }
}

module.exports = persistBuffer
