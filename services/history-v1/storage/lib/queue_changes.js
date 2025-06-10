// @ts-check

'use strict'

const redisBackend = require('./chunk_store/redis')
const { BlobStore } = require('./blob_store')
const chunkStore = require('./chunk_store')
const core = require('overleaf-editor-core')
const Chunk = core.Chunk

/**
 * Queues an incoming set of changes after validating them against the current snapshot.
 *
 * @async
 * @function queueChanges
 * @param {string} projectId - The project to queue changes for.
 * @param {Array<Object>} changesToQueue - An array of change objects to be applied and queued.
 * @param {number} endVersion - The expected version of the project before these changes are applied.
 *                              This is used for optimistic concurrency control.
 * @param {Object} [opts] - Additional options for queuing changes.
 * @throws {Chunk.ConflictingEndVersion} If the provided `endVersion` does not match the
 *                                       current version of the project.
 * @returns {Promise<any>} A promise that resolves with the status returned by the
 *                         `redisBackend.queueChanges` operation.
 */
async function queueChanges(projectId, changesToQueue, endVersion, opts) {
  const result = await redisBackend.getHeadSnapshot(projectId)
  let currentSnapshot = null
  let currentVersion = null
  if (result) {
    // If we have a snapshot in redis, we can use it to check the current state
    // of the project and apply changes to it.
    currentSnapshot = result.snapshot
    currentVersion = result.version
  } else {
    // Otherwise, load the latest chunk from the chunk store.
    const latestChunk = await chunkStore.loadLatest(projectId, {
      persistedOnly: true,
    })
    // Throw an error if no latest chunk is found, indicating the project has not been initialised.
    if (!latestChunk) {
      throw new Chunk.NotFoundError(projectId)
    }
    currentSnapshot = latestChunk.getSnapshot()
    currentSnapshot.applyAll(latestChunk.getChanges())
    currentVersion = latestChunk.getEndVersion()
  }

  // Ensure the endVersion matches the current version of the project.
  if (endVersion !== currentVersion) {
    throw new Chunk.ConflictingEndVersion(endVersion, currentVersion)
  }

  // Compute the new hollow snapshot to be saved to redis.
  const hollowSnapshot = currentSnapshot
  const blobStore = new BlobStore(projectId)
  await hollowSnapshot.loadFiles('hollow', blobStore)
  // Clone the changes to avoid modifying the original ones when computing the hollow snapshot.
  const hollowChanges = changesToQueue.map(change => change.clone())
  for (const change of hollowChanges) {
    await change.loadFiles('hollow', blobStore)
  }
  hollowSnapshot.applyAll(hollowChanges, { strict: true })
  const baseVersion = currentVersion
  const status = await redisBackend.queueChanges(
    projectId,
    hollowSnapshot,
    baseVersion,
    changesToQueue,
    opts
  )
  return status
}

module.exports = queueChanges
