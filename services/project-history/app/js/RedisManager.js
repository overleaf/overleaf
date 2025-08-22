import { callbackify, promisify } from 'node:util'
import { setTimeout } from 'node:timers/promises'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'
import metrics from '@overleaf/metrics'
import OError from '@overleaf/o-error'

/**
 * Maximum size taken from the redis queue, to prevent project history
 * consuming unbounded amounts of memory
 */
export const RAW_UPDATE_SIZE_THRESHOLD = 4 * 1024 * 1024

/**
 * Batch size when reading updates from Redis
 */
export const RAW_UPDATES_BATCH_SIZE = 50

/**
 * Maximum length of ops (insertion and deletions) to process in a single
 * iteration
 */
export const MAX_UPDATE_OP_LENGTH = 1024

/**
 * Warn if we exceed this raw update size, the final compressed updates we
 * send could be smaller than this
 */
const WARN_RAW_UPDATE_SIZE = 1024 * 1024

/**
 * Maximum number of new docs to process in a single iteration
 */
export const MAX_NEW_DOC_CONTENT_COUNT = 32

const CACHE_TTL_IN_SECONDS = 3600

const Keys = Settings.redis.project_history.key_schema
const rclient = redis.createClient(Settings.redis.project_history)

async function countUnprocessedUpdates(projectId) {
  const key = Keys.projectHistoryOps({ project_id: projectId })
  const updates = await rclient.llen(key)
  return updates
}

async function* getRawUpdates(projectId) {
  const key = Keys.projectHistoryOps({ project_id: projectId })
  let start = 0
  while (true) {
    const stop = start + RAW_UPDATES_BATCH_SIZE - 1
    const updates = await rclient.lrange(key, start, stop)
    for (const update of updates) {
      yield update
    }
    if (updates.length < RAW_UPDATES_BATCH_SIZE) {
      return
    }
    start += RAW_UPDATES_BATCH_SIZE
  }
}

async function getRawUpdatesBatch(projectId, batchSize) {
  const rawUpdates = []
  let totalRawUpdatesSize = 0
  let hasMore = false
  for await (const rawUpdate of getRawUpdates(projectId)) {
    totalRawUpdatesSize += rawUpdate.length
    if (
      rawUpdates.length > 0 &&
      totalRawUpdatesSize > RAW_UPDATE_SIZE_THRESHOLD
    ) {
      hasMore = true
      break
    }
    rawUpdates.push(rawUpdate)
    if (rawUpdates.length >= batchSize) {
      hasMore = true
      break
    }
  }
  metrics.timing('redis.incoming.bytes', totalRawUpdatesSize, 1)
  if (totalRawUpdatesSize > WARN_RAW_UPDATE_SIZE) {
    const rawUpdateSizes = rawUpdates.map(rawUpdate => rawUpdate.length)
    logger.warn(
      {
        projectId,
        totalRawUpdatesSize,
        rawUpdateSizes,
      },
      'large raw update size'
    )
  }
  return { rawUpdates, hasMore }
}

export function parseDocUpdates(jsonUpdates) {
  return jsonUpdates.map(update => JSON.parse(update))
}

async function getUpdatesInBatches(projectId, batchSize, runner) {
  let moreBatches = true
  while (moreBatches) {
    const redisBatch = await getRawUpdatesBatch(projectId, batchSize)
    if (redisBatch.rawUpdates.length === 0) {
      break
    }
    moreBatches = redisBatch.hasMore

    const rawUpdates = []
    const updates = []
    let totalOpLength = 0
    let totalDocContentCount = 0
    for (const rawUpdate of redisBatch.rawUpdates) {
      let update
      try {
        update = JSON.parse(rawUpdate)
      } catch (error) {
        throw OError.tag(error, 'failed to parse update', {
          projectId,
          update,
        })
      }

      totalOpLength += update?.op?.length || 1
      if (update.resyncDocContent) {
        totalDocContentCount += 1
      }

      if (
        updates.length > 0 &&
        (totalOpLength > MAX_UPDATE_OP_LENGTH ||
          totalDocContentCount > MAX_NEW_DOC_CONTENT_COUNT)
      ) {
        moreBatches = true
        break
      }
      if (update.resyncProjectStructureOnly) {
        update._raw = rawUpdate
      }

      rawUpdates.push(rawUpdate)
      updates.push(update)
    }

    await runner(updates)
    await deleteAppliedDocUpdates(projectId, rawUpdates)

    if (batchSize === 1) {
      // Special case for single stepping, don't process more batches
      break
    }
  }
}

/**
 * @param {string} projectId
 * @param {ResyncProjectStructureUpdate} update
 * @return {Promise<void>}
 */
async function deleteAppliedDocUpdate(projectId, update) {
  const raw = update._raw
  // Delete the first occurrence of the update with LREM KEY COUNT
  // VALUE by setting COUNT to 1 which 'removes COUNT elements equal to
  // value moving from head to tail.'
  //
  // If COUNT is 0 the entire list would be searched which would block
  // redis since it would be an O(N) operation where N is the length of
  // the queue, in a multi of the batch size.
  metrics.summary('redis.projectHistoryOps', raw.length, {
    status: 'lrem',
  })
  await rclient.lrem(Keys.projectHistoryOps({ project_id: projectId }), 1, raw)
}

async function deleteAppliedDocUpdates(projectId, updates) {
  const multi = rclient.multi()
  // Delete all the updates which have been applied (exact match)
  for (const update of updates) {
    // Delete the first occurrence of the update with LREM KEY COUNT
    // VALUE by setting COUNT to 1 which 'removes COUNT elements equal to
    // value moving from head to tail.'
    //
    // If COUNT is 0 the entire list would be searched which would block
    // redis since it would be an O(N) operation where N is the length of
    // the queue, in a multi of the batch size.
    metrics.summary('redis.projectHistoryOps', update.length, {
      status: 'lrem',
    })
    multi.lrem(Keys.projectHistoryOps({ project_id: projectId }), 1, update)
  }
  if (updates.length > 0) {
    multi.del(Keys.projectHistoryFirstOpTimestamp({ project_id: projectId }))
  }
  await multi.exec()
}

/**
 * Deletes the entire queue - use with caution
 */
async function destroyDocUpdatesQueue(projectId) {
  await rclient.del(
    Keys.projectHistoryOps({ project_id: projectId }),
    Keys.projectHistoryFirstOpTimestamp({ project_id: projectId })
  )
}

/**
 * Iterate over keys asynchronously using redis scan (non-blocking)
 *
 * handle all the cluster nodes or single redis server
 */
async function _getKeys(pattern, limit) {
  const nodes = rclient.nodes?.('master') || [rclient]
  const keysByNode = []
  for (const node of nodes) {
    const keys = await _getKeysFromNode(node, pattern, limit)
    keysByNode.push(keys)
  }
  return [].concat(...keysByNode)
}

async function _getKeysFromNode(node, pattern, limit) {
  let cursor = 0 // redis iterator
  const keySet = new Set() // avoid duplicate results
  const batchSize = limit != null ? Math.min(limit, 1000) : 1000

  // scan over all keys looking for pattern
  while (true) {
    const reply = await node.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize)
    const [newCursor, keys] = reply
    cursor = newCursor

    for (const key of keys) {
      keySet.add(key)
    }

    const noResults = cursor === '0' // redis returns string results not numeric
    const limitReached = limit != null && keySet.size >= limit
    if (noResults || limitReached) {
      return Array.from(keySet)
    }

    // avoid hitting redis too hard
    await setTimeout(10)
  }
}

/**
 * Extract ids from keys like DocsWithHistoryOps:57fd0b1f53a8396d22b2c24b
 * or DocsWithHistoryOps:{57fd0b1f53a8396d22b2c24b} (for redis cluster)
 */
function _extractIds(keyList) {
  return keyList.map(key => {
    const m = key.match(/:\{?([0-9a-f]{24})\}?/) // extract object id
    return m[1]
  })
}

async function getProjectIdsWithHistoryOps(limit) {
  const projectKeys = await _getKeys(
    Keys.projectHistoryOps({ project_id: '*' }),
    limit
  )
  const projectIds = _extractIds(projectKeys)
  return projectIds
}

async function getProjectIdsWithHistoryOpsCount() {
  const projectIds = await getProjectIdsWithHistoryOps()
  const queuedProjectsCount = projectIds.length
  metrics.globalGauge('queued-projects', queuedProjectsCount)
  return queuedProjectsCount
}

async function setFirstOpTimestamp(projectId) {
  const key = Keys.projectHistoryFirstOpTimestamp({ project_id: projectId })
  // store current time as an integer (string)
  await rclient.setnx(key, Date.now())
}

async function getFirstOpTimestamp(projectId) {
  const key = Keys.projectHistoryFirstOpTimestamp({ project_id: projectId })
  const result = await rclient.get(key)

  // convert stored time back to a numeric timestamp
  const timestamp = parseInt(result, 10)

  // check for invalid timestamp
  if (isNaN(timestamp)) {
    return null
  }

  // convert numeric timestamp to a date object
  const firstOpTimestamp = new Date(timestamp)

  return firstOpTimestamp
}

async function getFirstOpTimestamps(projectIds) {
  const keys = projectIds.map(projectId =>
    Keys.projectHistoryFirstOpTimestamp({ project_id: projectId })
  )
  const results = await rclient.mget(keys)
  const timestamps = results.map(result => {
    // convert stored time back to a numeric timestamp
    const timestamp = parseInt(result, 10)

    // check for invalid timestamp
    if (isNaN(timestamp)) {
      return null
    }

    // convert numeric timestamp to a date object
    return new Date(timestamp)
  })
  return timestamps
}

async function clearFirstOpTimestamp(projectId) {
  const key = Keys.projectHistoryFirstOpTimestamp({ project_id: projectId })
  await rclient.del(key)
}

async function getProjectIdsWithFirstOpTimestamps(limit) {
  const projectKeys = await _getKeys(
    Keys.projectHistoryFirstOpTimestamp({ project_id: '*' }),
    limit
  )
  const projectIds = _extractIds(projectKeys)
  return projectIds
}

async function clearDanglingFirstOpTimestamp(projectId) {
  const count = await rclient.exists(
    Keys.projectHistoryFirstOpTimestamp({ project_id: projectId }),
    Keys.projectHistoryOps({ project_id: projectId })
  )
  if (count === 2 || count === 0) {
    // both (or neither) keys are present, so don't delete the timestamp
    return 0
  }
  // only one key is present, which makes this a dangling record,
  // so delete the timestamp
  const cleared = await rclient.del(
    Keys.projectHistoryFirstOpTimestamp({ project_id: projectId })
  )
  return cleared
}

async function getCachedHistoryId(projectId) {
  const key = Keys.projectHistoryCachedHistoryId({ project_id: projectId })
  const historyId = await rclient.get(key)
  return historyId
}

async function setCachedHistoryId(projectId, historyId) {
  const key = Keys.projectHistoryCachedHistoryId({ project_id: projectId })
  await rclient.setex(key, CACHE_TTL_IN_SECONDS, historyId)
}

async function clearCachedHistoryId(projectId) {
  const key = Keys.projectHistoryCachedHistoryId({ project_id: projectId })
  await rclient.del(key)
}

async function cleanupTestRedis() {
  await redis.cleanupTestRedis(rclient)
}

// EXPORTS

const countUnprocessedUpdatesCb = callbackify(countUnprocessedUpdates)
const getRawUpdatesBatchCb = callbackify(getRawUpdatesBatch)
const deleteAppliedDocUpdatesCb = callbackify(deleteAppliedDocUpdates)
const destroyDocUpdatesQueueCb = callbackify(destroyDocUpdatesQueue)
const getProjectIdsWithHistoryOpsCb = callbackify(getProjectIdsWithHistoryOps)
const getProjectIdsWithHistoryOpsCountCb = callbackify(
  getProjectIdsWithHistoryOpsCount
)
const setFirstOpTimestampCb = callbackify(setFirstOpTimestamp)
const getFirstOpTimestampCb = callbackify(getFirstOpTimestamp)
const getFirstOpTimestampsCb = callbackify(getFirstOpTimestamps)
const clearFirstOpTimestampCb = callbackify(clearFirstOpTimestamp)
const getProjectIdsWithFirstOpTimestampsCb = callbackify(
  getProjectIdsWithFirstOpTimestamps
)
const clearDanglingFirstOpTimestampCb = callbackify(
  clearDanglingFirstOpTimestamp
)
const getCachedHistoryIdCb = callbackify(getCachedHistoryId)
const setCachedHistoryIdCb = callbackify(setCachedHistoryId)
const clearCachedHistoryIdCb = callbackify(clearCachedHistoryId)

const getUpdatesInBatchesCb = function (
  projectId,
  batchSize,
  runner,
  callback
) {
  const runnerPromises = promisify(runner)
  getUpdatesInBatches(projectId, batchSize, runnerPromises)
    .then(result => {
      callback(null, result)
    })
    .catch(err => {
      callback(err)
    })
}

export {
  countUnprocessedUpdatesCb as countUnprocessedUpdates,
  getRawUpdatesBatchCb as getRawUpdatesBatch,
  deleteAppliedDocUpdatesCb as deleteAppliedDocUpdates,
  destroyDocUpdatesQueueCb as destroyDocUpdatesQueue,
  getUpdatesInBatchesCb as getUpdatesInBatches,
  getProjectIdsWithHistoryOpsCb as getProjectIdsWithHistoryOps,
  getProjectIdsWithHistoryOpsCountCb as getProjectIdsWithHistoryOpsCount,
  setFirstOpTimestampCb as setFirstOpTimestamp,
  getFirstOpTimestampCb as getFirstOpTimestamp,
  getFirstOpTimestampsCb as getFirstOpTimestamps,
  clearFirstOpTimestampCb as clearFirstOpTimestamp,
  getProjectIdsWithFirstOpTimestampsCb as getProjectIdsWithFirstOpTimestamps,
  clearDanglingFirstOpTimestampCb as clearDanglingFirstOpTimestamp,
  getCachedHistoryIdCb as getCachedHistoryId,
  setCachedHistoryIdCb as setCachedHistoryId,
  clearCachedHistoryIdCb as clearCachedHistoryId,
}

export const promises = {
  countUnprocessedUpdates,
  getRawUpdatesBatch,
  deleteAppliedDocUpdates,
  deleteAppliedDocUpdate,
  destroyDocUpdatesQueue,
  getUpdatesInBatches,
  getProjectIdsWithHistoryOps,
  getProjectIdsWithHistoryOpsCount,
  setFirstOpTimestamp,
  getFirstOpTimestamp,
  getFirstOpTimestamps,
  clearFirstOpTimestamp,
  getProjectIdsWithFirstOpTimestamps,
  clearDanglingFirstOpTimestamp,
  getCachedHistoryId,
  setCachedHistoryId,
  clearCachedHistoryId,
  cleanupTestRedis,
}
