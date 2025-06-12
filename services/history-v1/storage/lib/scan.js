// @ts-check

'use strict'

const logger = require('@overleaf/logger')
const { JobNotFoundError, JobNotReadyError } = require('./chunk_store/errors')
const BATCH_SIZE = 1000 // Default batch size for SCAN

/**
 * Asynchronously scans a Redis instance or cluster for keys matching a pattern.
 *
 * This function handles both standalone Redis instances and Redis clusters.
 * For clusters, it iterates over all master nodes. It yields keys in batches
 * as they are found by the SCAN command.
 *
 * @param {object} redisClient - The Redis client instance (from @overleaf/redis-wrapper).
 * @param {string} pattern - The pattern to match keys against (e.g., 'user:*').
 * @param {number} [count=BATCH_SIZE] - Optional hint for Redis SCAN count per iteration.
 * @yields {string[]} A batch of matching keys.
 */
async function* scanRedisCluster(redisClient, pattern, count = BATCH_SIZE) {
  const nodes = redisClient.nodes ? redisClient.nodes('master') : [redisClient]

  for (const node of nodes) {
    let cursor = '0'
    do {
      // redisClient from @overleaf/redis-wrapper uses ioredis style commands
      const [nextCursor, keys] = await node.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        count
      )
      cursor = nextCursor
      if (keys.length > 0) {
        yield keys
      }
    } while (cursor !== '0')
  }
}

/**
 * Extracts the content within the first pair of curly braces {} from a string.
 * This is used to extract a user ID or project ID from a Redis key.
 *
 * @param {string} key - The input string containing content within curly braces.
 * @returns {string | null} The extracted content (the key ID) if found, otherwise null.
 */
function extractKeyId(key) {
  const match = key.match(/\{(.*?)\}/)
  if (match && match[1]) {
    return match[1]
  }
  return null
}

/**
 * Fetches timestamps for a list of project IDs based on a given key name.
 *
 * @param {string[]} projectIds - Array of project identifiers.
 * @param {object} rclient - The Redis client instance.
 * @param {string} keyName - The base name for the Redis keys storing the timestamps (e.g., "expire-time", "persist-time").
 * @param {number} currentTime - The current time (timestamp in milliseconds) to compare against.
 * @returns {Promise<Array<{projectId: string, timestampValue: string}>>}
 *           A promise that resolves to an array of objects, each containing a projectId and
 *           its corresponding timestampValue, for due projects only.
 */
async function fetchOverdueProjects(projectIds, rclient, keyName, currentTime) {
  if (!projectIds || projectIds.length === 0) {
    return []
  }
  const timestampKeys = projectIds.map(id => `${keyName}:{${id}}`)
  const timestamps = await rclient.mget(timestampKeys)

  const dueProjects = []
  for (let i = 0; i < projectIds.length; i++) {
    const projectId = projectIds[i]
    const timestampValue = timestamps[i]

    if (timestampValue !== null) {
      const timestamp = parseInt(timestampValue, 10)
      if (!isNaN(timestamp) && currentTime > timestamp) {
        dueProjects.push({ projectId, timestampValue })
      }
    }
  }
  return dueProjects
}

/**
 * Scans Redis for keys matching a pattern derived from keyName, identifies items that are "due" based on a timestamp,
 * and performs a specified action on them.
 *
 * @param {object} rclient - The Redis client instance.
 * @param {string} taskName - A descriptive name for the task (used in logging).
 * @param {string} keyName - The base name for the Redis keys (e.g., "expire-time", "persist-time").
 *                           The function will derive the key prefix as `${keyName}:` and scan pattern as `${keyName}:{*}`.
 * @param {function(string): Promise<void>} actionFn - An async function that takes a projectId and performs an action.
 * @param {boolean} DRY_RUN - If true, logs actions that would be taken without performing them.
 * @returns {Promise<{scannedKeyCount: number, processedKeyCount: number}>} Counts of scanned and processed keys.
 */
async function scanAndProcessDueItems(
  rclient,
  taskName,
  keyName,
  actionFn,
  DRY_RUN
) {
  let scannedKeyCount = 0
  let processedKeyCount = 0
  const START_TIME = Date.now()
  const logContext = { taskName, dryRun: DRY_RUN }

  const scanPattern = `${keyName}:{*}`

  if (DRY_RUN) {
    logger.info(logContext, `Starting ${taskName} scan in DRY RUN mode`)
  } else {
    logger.info(logContext, `Starting ${taskName} scan`)
  }

  for await (const keysBatch of scanRedisCluster(rclient, scanPattern)) {
    scannedKeyCount += keysBatch.length
    const projectIds = keysBatch.map(extractKeyId).filter(id => id != null)

    if (projectIds.length === 0) {
      continue
    }

    const currentTime = Date.now()
    const overdueProjects = await fetchOverdueProjects(
      projectIds,
      rclient,
      keyName,
      currentTime
    )

    for (const project of overdueProjects) {
      const { projectId } = project
      if (DRY_RUN) {
        logger.info(
          { ...logContext, projectId },
          `[Dry Run] Would perform ${taskName} for project`
        )
      } else {
        try {
          await actionFn(projectId)
          logger.debug(
            { ...logContext, projectId },
            `Successfully performed ${taskName} for project`
          )
        } catch (err) {
          if (err instanceof JobNotReadyError) {
            // the project has been touched since the job was created
            logger.info(
              { ...logContext, projectId },
              `Job not ready for ${taskName} for project`
            )
          } else if (err instanceof JobNotFoundError) {
            // the project has been expired already by another worker
            logger.info(
              { ...logContext, projectId },
              `Job not found for ${taskName} for project`
            )
          } else {
            logger.error(
              { ...logContext, projectId, err },
              `Error performing ${taskName} for project`
            )
          }
          continue
        }
      }
      processedKeyCount++

      if (processedKeyCount % 1000 === 0 && processedKeyCount > 0) {
        logger.info(
          { ...logContext, scannedKeyCount, processedKeyCount },
          `${taskName} scan progress`
        )
      }
    }
  }

  logger.info(
    {
      ...logContext,
      scannedKeyCount,
      processedKeyCount,
      elapsedTimeInSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    },
    `${taskName} scan complete`
  )
  return { scannedKeyCount, processedKeyCount }
}

module.exports = {
  scanRedisCluster,
  extractKeyId,
  scanAndProcessDueItems,
}
