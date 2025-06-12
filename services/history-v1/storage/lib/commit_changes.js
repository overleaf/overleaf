// @ts-check

'use strict'

const metrics = require('@overleaf/metrics')
const redisBackend = require('./chunk_store/redis')
const logger = require('@overleaf/logger')
const queueChanges = require('./queue_changes')
const persistChanges = require('./persist_changes')
const persistBuffer = require('./persist_buffer')

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
 * @param {number} [options.historyBufferLevel] - The history buffer level to use for processing changes.
 * @param {Boolean} [options.forcePersistBuffer] - If true, forces the buffer to be persisted before any operation.
 * @return {Promise.<Object?>}
 */

async function commitChanges(
  projectId,
  changes,
  limits,
  endVersion,
  options = {}
) {
  const { historyBufferLevel, forcePersistBuffer } = options

  // Force the buffer to be persisted if specified.
  if (forcePersistBuffer) {
    try {
      const status = await redisBackend.expireProject(projectId) // clear the project from Redis if it is persisted, returns 'not-persisted' if it was not persisted
      if (status === 'not-persisted') {
        await persistBuffer(projectId, limits)
        await redisBackend.expireProject(projectId) // clear the project from Redis after persisting
        metrics.inc('persist_buffer_force', 1, { status: 'persisted' })
      }
    } catch (err) {
      metrics.inc('persist_buffer_force', 1, { status: 'error' })
      logger.error(
        { err, projectId },
        'failed to persist buffer before committing changes'
      )
    }
  }

  metrics.inc('commit_changes', 1, {
    history_buffer_level: historyBufferLevel || 0,
  })

  // Now handle the changes based on the configured history buffer level.
  switch (historyBufferLevel) {
    case 4: // Queue changes and only persist them in the background
      await queueChanges(projectId, changes, endVersion)
      return {}
    case 3: // Queue changes and immediately persist with persistBuffer
      await queueChanges(projectId, changes, endVersion)
      return await persistBuffer(projectId, limits)
    case 2: // Equivalent to queueChangesInRedis:true
      await queueChangesFake(projectId, changes, endVersion)
      return await persistChanges(projectId, changes, limits, endVersion)
    case 1: // Queue changes with fake persist only for projects in redis already
      await queueChangesFakeOnlyIfExists(projectId, changes, endVersion)
      return await persistChanges(projectId, changes, limits, endVersion)
    case 0: // Persist changes directly to the chunk store
      return await persistChanges(projectId, changes, limits, endVersion)
    default:
      throw new Error(`Invalid history buffer level: ${historyBufferLevel}`)
  }
}

/**
 * Queues a set of changes in redis as if they had been persisted, ignoring any errors.
 * @param {string} projectId
 * @param {Change[]} changes
 * @param {number} endVersion
 * @param {Object} [options]
 * @param {boolean} [options.onlyIfExists] - If true, only queue changes if the project
 * already exists in Redis.
 */

async function queueChangesFake(projectId, changes, endVersion, options = {}) {
  try {
    await queueChanges(projectId, changes, endVersion)
    await fakePersistRedisChanges(projectId, changes, endVersion)
  } catch (err) {
    logger.error({ err }, 'Chunk buffer verification failed')
  }
}

/**
 * Queues changes in Redis, simulating persistence, but only if the project already exists.
 * @param {string} projectId - The ID of the project.
 * @param {Change[]} changes - An array of changes to be queued.
 * @param {number} endVersion - The expected version of the project before these changes are applied.
 */

async function queueChangesFakeOnlyIfExists(projectId, changes, endVersion) {
  await queueChangesFake(projectId, changes, endVersion, {
    onlyIfExists: true,
  })
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
