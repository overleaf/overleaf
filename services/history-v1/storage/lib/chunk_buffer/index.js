'use strict'

/**
 * @module storage/lib/chunk_buffer
 */

const chunkStore = require('../chunk_store')
const redisBackend = require('../chunk_store/redis')
const metrics = require('@overleaf/metrics')
/**
 * Load the latest Chunk stored for a project, including blob metadata.
 *
 * @param {string} projectId
 * @return {Promise.<Chunk>}
 */
async function loadLatest(projectId) {
  const cachedChunk = await redisBackend.getCurrentChunk(projectId)
  const chunkRecord = await chunkStore.loadLatestRaw(projectId)
  const cachedChunkIsValid = redisBackend.checkCacheValidityWithMetadata(
    cachedChunk,
    chunkRecord
  )
  if (cachedChunkIsValid) {
    metrics.inc('chunk_buffer.loadLatest', 1, {
      status: 'cache-hit',
    })
    return cachedChunk
  } else {
    metrics.inc('chunk_buffer.loadLatest', 1, {
      status: 'cache-miss',
    })
    const chunk = await chunkStore.loadLatest(projectId)
    await redisBackend.setCurrentChunk(projectId, chunk)
    return chunk
  }
}

module.exports = {
  loadLatest,
}
