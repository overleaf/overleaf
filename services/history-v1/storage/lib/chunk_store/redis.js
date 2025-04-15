const metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const redis = require('../redis')
const rclient = redis.rclientHistory //
const { Snapshot, Change, History, Chunk } = require('overleaf-editor-core')

const TEMPORARY_CACHE_LIFETIME = 300 // 5 minutes

const keySchema = {
  snapshot({ projectId }) {
    return `snapshot:{${projectId}}`
  },
  startVersion({ projectId }) {
    return `snapshot-version:{${projectId}}`
  },
  changes({ projectId }) {
    return `changes:{${projectId}}`
  },
}

rclient.defineCommand('get_current_chunk', {
  numberOfKeys: 3,
  lua: `
      local startVersionValue = redis.call('GET', KEYS[2])
      if not startVersionValue then
        return nil -- this is a cache-miss
      end
      local snapshotValue = redis.call('GET', KEYS[1])
      local changesValues = redis.call('LRANGE', KEYS[3], 0, -1)
      return {snapshotValue, startVersionValue, changesValues}
    `,
})

/**
 * Retrieves the current chunk of project history from Redis storage
 * @param {string} projectId - The unique identifier of the project
 * @returns {Promise<Chunk|null>} A Promise that resolves to a Chunk object containing project history,
 *                               or null if retrieval fails
 * @throws {Error} If Redis operations fail
 */
async function getCurrentChunk(projectId) {
  try {
    const result = await rclient.get_current_chunk(
      keySchema.snapshot({ projectId }),
      keySchema.startVersion({ projectId }),
      keySchema.changes({ projectId })
    )
    if (!result) {
      return null // cache-miss
    }
    const snapshot = Snapshot.fromRaw(JSON.parse(result[0]))
    const startVersion = JSON.parse(result[1])
    const changes = result[2].map(c => Change.fromRaw(JSON.parse(c)))
    const history = new History(snapshot, changes)
    const chunk = new Chunk(history, startVersion)
    metrics.inc('chunk_store.redis.get_current_chunk', 1, { status: 'success' })
    return chunk
  } catch (err) {
    logger.error({ err, projectId }, 'error getting current chunk from redis')
    metrics.inc('chunk_store.redis.get_current_chunk', 1, { status: 'error' })
    return null
  }
}

rclient.defineCommand('get_current_chunk_metadata', {
  numberOfKeys: 2,
  lua: `
      local startVersionValue = redis.call('GET', KEYS[1])
      local changesCount = redis.call('LLEN', KEYS[2])
      return {startVersionValue, changesCount}
    `,
})

/**
 * Retrieves the current chunk metadata for a given project from Redis
 * @param {string} projectId - The ID of the project to get metadata for
 * @returns {Promise<Object|null>} Object containing startVersion and changesCount if found, null on error or cache miss
 * @property {number} startVersion - The starting version information
 * @property {number} changesCount - The number of changes in the chunk
 */
async function getCurrentChunkMetadata(projectId) {
  try {
    const result = await rclient.get_current_chunk_metadata(
      keySchema.startVersion({ projectId }),
      keySchema.changes({ projectId })
    )
    if (!result) {
      return null // cache-miss
    }
    const startVersion = JSON.parse(result[0])
    const changesCount = parseInt(result[1], 10)
    return { startVersion, changesCount }
  } catch (err) {
    return null
  }
}

rclient.defineCommand('set_current_chunk', {
  numberOfKeys: 3,
  lua: `
      local snapshotValue = ARGV[1]
      local startVersionValue = ARGV[2]
      redis.call('SETEX', KEYS[1], ${TEMPORARY_CACHE_LIFETIME}, snapshotValue)
      redis.call('SETEX', KEYS[2], ${TEMPORARY_CACHE_LIFETIME}, startVersionValue)
      redis.call('DEL', KEYS[3]) -- clear the old changes list
      if #ARGV >= 3 then
        redis.call('RPUSH', KEYS[3], unpack(ARGV, 3))
        redis.call('EXPIRE', KEYS[3], ${TEMPORARY_CACHE_LIFETIME})
      end
    `,
})

/**
 * Stores the current chunk of project history in Redis
 * @param {string} projectId - The ID of the project
 * @param {Chunk} chunk - The chunk object containing history data
 * @returns {Promise<*>} Returns the result of the Redis operation, or null if an error occurs
 * @throws {Error} May throw Redis-related errors which are caught internally
 */
async function setCurrentChunk(projectId, chunk) {
  try {
    const snapshotKey = keySchema.snapshot({ projectId })
    const startVersionKey = keySchema.startVersion({ projectId })
    const changesKey = keySchema.changes({ projectId })

    const snapshot = chunk.history.snapshot
    const startVersion = chunk.startVersion
    const changes = chunk.history.changes

    await rclient.set_current_chunk(
      snapshotKey,
      startVersionKey,
      changesKey,
      JSON.stringify(snapshot.toRaw()),
      startVersion,
      ...changes.map(c => JSON.stringify(c.toRaw()))
    )
    metrics.inc('chunk_store.redis.set_current_chunk', 1, { status: 'success' })
  } catch (err) {
    logger.error(
      { err, projectId, chunk },
      'error setting current chunk inredis'
    )
    metrics.inc('chunk_store.redis.set_current_chunk', 1, { status: 'error' })
    return null // while testing we will suppress any errors
  }
}

/**
 * Checks whether a cached chunk's version metadata matches the current chunk's metadata
 * @param {Chunk} cachedChunk - The chunk retrieved from cache
 * @param {Chunk} currentChunk - The current chunk to compare against
 * @returns {boolean} - Returns true if the chunks have matching start and end versions, false otherwise
 */
function checkCacheValidity(cachedChunk, currentChunk) {
  return Boolean(
    cachedChunk &&
      cachedChunk.getStartVersion() === currentChunk.getStartVersion() &&
      cachedChunk.getEndVersion() === currentChunk.getEndVersion()
  )
}

/**
 * Validates if a cached chunk matches the current chunk metadata by comparing versions
 * @param {Object} cachedChunk - The cached chunk object to validate
 * @param {Object} currentChunkMetadata - The current chunk metadata to compare against
 * @param {number} currentChunkMetadata.startVersion - The starting version number
 * @param {number} currentChunkMetadata.endVersion - The ending version number
 * @returns {boolean} - True if the cached chunk is valid, false otherwise
 */
function checkCacheValidityWithMetadata(cachedChunk, currentChunkMetadata) {
  return Boolean(
    cachedChunk &&
      cachedChunk.getStartVersion() === currentChunkMetadata.startVersion &&
      cachedChunk.getEndVersion() === currentChunkMetadata.endVersion
  )
}

/**
 * Compares two chunks for equality using stringified JSON comparison
 * @param {string} projectId - The ID of the project
 * @param {Chunk} cachedChunk - The cached chunk to compare
 * @param {Chunk} currentChunk - The current chunk to compare against
 * @returns {boolean} - Returns false if either chunk is null/undefined, otherwise returns the comparison result
 */
function compareChunks(projectId, cachedChunk, currentChunk) {
  if (!cachedChunk || !currentChunk) {
    return false
  }
  const identical = JSON.stringify(cachedChunk) === JSON.stringify(currentChunk)
  if (!identical) {
    try {
      logger.error(
        {
          projectId,
          cachedChunkStartVersion: cachedChunk.getStartVersion(),
          cachedChunkEndVersion: cachedChunk.getEndVersion(),
          currentChunkStartVersion: currentChunk.getStartVersion(),
          currentChunkEndVersion: currentChunk.getEndVersion(),
        },
        'chunk cache mismatch'
      )
    } catch (err) {
      // ignore errors while logging
    }
  }
  metrics.inc('chunk_store.redis.compare_chunks', 1, {
    status: identical ? 'success' : 'fail',
  })
  return identical
}

// Define Lua script for atomic cache clearing
rclient.defineCommand('clear_chunk_cache', {
  numberOfKeys: 3,
  lua: `
    -- Delete all keys related to a project's chunk cache atomically
    redis.call('DEL', KEYS[1]) -- snapshot key
    redis.call('DEL', KEYS[2]) -- startVersion key
    redis.call('DEL', KEYS[3]) -- changes key
    return 1
  `,
})

/**
 * Clears all cache entries for a project's chunk data
 * @param {string} projectId - The ID of the project whose cache should be cleared
 * @returns {Promise<boolean>} A promise that resolves to true if successful, false on error
 */
async function clearCache(projectId) {
  try {
    const snapshotKey = keySchema.snapshot({ projectId })
    const startVersionKey = keySchema.startVersion({ projectId })
    const changesKey = keySchema.changes({ projectId })

    await rclient.clear_chunk_cache(snapshotKey, startVersionKey, changesKey)
    metrics.inc('chunk_store.redis.clear_cache', 1, { status: 'success' })
    return true
  } catch (err) {
    logger.error({ err, projectId }, 'error clearing chunk cache from redis')
    metrics.inc('chunk_store.redis.clear_cache', 1, { status: 'error' })
    return false
  }
}

module.exports = {
  getCurrentChunk,
  setCurrentChunk,
  getCurrentChunkMetadata,
  checkCacheValidity,
  checkCacheValidityWithMetadata,
  compareChunks,
  clearCache,
}
