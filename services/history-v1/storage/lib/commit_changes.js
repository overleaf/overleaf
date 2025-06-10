// @ts-check

'use strict'

const metrics = require('@overleaf/metrics')
const redisBackend = require('./chunk_store/redis')
const logger = require('@overleaf/logger')
const queueChanges = require('./queue_changes')
const persistChanges = require('./persist_changes')

/**
 * @typedef {import('overleaf-editor-core').Change} Change
 */

/**
 * Handle incoming changes by processing them according to the specified options.
 * @param {string} projectId
 * @param {Change[]} changes
 * @param {Object} limits
 * @param {number} endVersion
 * @param {Object} options
 * @param {Boolean} [options.queueChangesInRedis]
 *   If true, queue the changes in Redis for testing purposes.
 * @return {Promise.<Object?>}
 */

async function commitChanges(
  projectId,
  changes,
  limits,
  endVersion,
  options = {}
) {
  if (options.queueChangesInRedis) {
    try {
      await queueChanges(projectId, changes, endVersion)
      await fakePersistRedisChanges(projectId, changes, endVersion)
    } catch (err) {
      logger.error({ err }, 'Chunk buffer verification failed')
    }
  }
  const result = await persistChanges(projectId, changes, limits, endVersion)
  return result
}

/**
 * Simulates the persistence of changes by verifying a given set of changes against
 * what is currently stored as non-persisted in Redis, and then updates the
 * persisted version number in Redis.
 *
 * @async
 * @param {string} projectId - The ID of the project.
 * @param {Change[]} changesToPersist - An array of changes that are expected to be
 *                                        persisted. These are used for verification
 *                                        against the changes currently in Redis.
 * @param {number} baseVersion - The base version number from which to calculate
 *                               the new persisted version.
 * @returns {Promise<void>} A promise that resolves when the persisted version
 *                          in Redis has been updated.
 */
async function fakePersistRedisChanges(
  projectId,
  changesToPersist,
  baseVersion
) {
  const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
    projectId,
    baseVersion
  )

  if (
    serializeChanges(nonPersistedChanges) === serializeChanges(changesToPersist)
  ) {
    metrics.inc('persist_redis_changes_verification', 1, { status: 'match' })
  } else {
    logger.warn({ projectId }, 'mismatch of non-persisted changes from Redis')
    metrics.inc('persist_redis_changes_verification', 1, {
      status: 'mismatch',
    })
  }

  const persistedVersion = baseVersion + nonPersistedChanges.length
  await redisBackend.setPersistedVersion(projectId, persistedVersion)
}

/**
 * @param {Change[]} changes
 */
function serializeChanges(changes) {
  return JSON.stringify(changes.map(change => change.toRaw()))
}

module.exports = commitChanges
