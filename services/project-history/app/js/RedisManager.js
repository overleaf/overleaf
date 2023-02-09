/* eslint-disable
    camelcase,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { promisify } from 'util'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import async from 'async'
import redis from '@overleaf/redis-wrapper'
import metrics from '@overleaf/metrics'
import OError from '@overleaf/o-error'

// maximum size taken from the redis queue, to prevent project history
// consuming unbounded amounts of memory
let RAW_UPDATE_SIZE_THRESHOLD = 4 * 1024 * 1024

// maximum length of ops (insertion and deletions) to process in a single
// iteration
let MAX_UPDATE_OP_LENGTH = 1024

// warn if we exceed this raw update size, the final compressed updates we send
// could be smaller than this
const WARN_RAW_UPDATE_SIZE = 1024 * 1024

// maximum number of new docs to process in a single iteration
let MAX_NEW_DOC_CONTENT_COUNT = 32

const CACHE_TTL_IN_SECONDS = 3600

const Keys = Settings.redis.project_history.key_schema
const rclient = redis.createClient(Settings.redis.project_history)

/**
 * Container for functions that need to be mocked in tests
 *
 * TODO: Rewrite tests in terms of exported functions only
 */
export const _mocks = {}

export function countUnprocessedUpdates(project_id, callback) {
  const key = Keys.projectHistoryOps({ project_id })
  return rclient.llen(key, callback)
}

_mocks.getOldestDocUpdates = (project_id, batch_size, callback) => {
  if (callback == null) {
    callback = function () {}
  }
  const key = Keys.projectHistoryOps({ project_id })
  rclient.lrange(key, 0, batch_size - 1, callback)
}

export function getOldestDocUpdates(...args) {
  _mocks.getOldestDocUpdates(...args)
}

_mocks.parseDocUpdates = (json_updates, callback) => {
  let parsed_updates
  if (callback == null) {
    callback = function () {}
  }
  try {
    parsed_updates = Array.from(json_updates || []).map(update =>
      JSON.parse(update)
    )
  } catch (e) {
    return callback(e)
  }
  callback(null, parsed_updates)
}

export function parseDocUpdates(...args) {
  _mocks.parseDocUpdates(...args)
}

export function getUpdatesInBatches(project_id, batch_size, runner, callback) {
  let moreBatches = true
  let lastResults = []

  const processBatch = cb =>
    getOldestDocUpdates(project_id, batch_size, function (error, raw_updates) {
      let raw_update
      if (error != null) {
        return cb(OError.tag(error))
      }
      moreBatches = raw_updates.length === batch_size
      if (raw_updates.length === 0) {
        return cb()
      }
      // don't process any more batches if we are single stepping
      if (batch_size === 1) {
        moreBatches = false
      }

      // consume the updates up to a maximum total number of bytes
      // ensuring that at least one update will be processed (we may
      // exceed RAW_UPDATE_SIZE_THRESHOLD is the first update is bigger
      // than that).
      let total_raw_updates_size = 0
      const updates_to_process = []
      for (raw_update of Array.from(raw_updates)) {
        const next_total_size = total_raw_updates_size + raw_update.length
        if (
          updates_to_process.length > 0 &&
          next_total_size > RAW_UPDATE_SIZE_THRESHOLD
        ) {
          // stop consuming updates if we have at least one and the
          // next update would exceed the size threshold
          break
        } else {
          updates_to_process.push(raw_update)
          total_raw_updates_size += raw_update.length
        }
      }

      // if we hit the size limit above, only process the updates up to that point
      if (updates_to_process.length < raw_updates.length) {
        moreBatches = true // process remaining raw updates in the next iteration
        raw_updates = updates_to_process
      }

      metrics.timing('redis.incoming.bytes', total_raw_updates_size, 1)
      if (total_raw_updates_size > WARN_RAW_UPDATE_SIZE) {
        const raw_update_sizes = (() => {
          const result = []
          for (raw_update of Array.from(raw_updates)) {
            result.push(raw_update.length)
          }
          return result
        })()
        logger.warn(
          { project_id, total_raw_updates_size, raw_update_sizes },
          'large raw update size'
        )
      }

      return parseDocUpdates(raw_updates, function (error, updates) {
        if (error != null) {
          OError.tag(error, 'failed to parse updates', {
            project_id,
            updates,
          })
          return cb(error)
        }

        // consume the updates up to a maximum number of ops (insertions and deletions)
        let total_op_length = 0
        let updates_to_process_count = 0
        let total_doc_content_count = 0
        for (const parsed_update of Array.from(updates)) {
          if (parsed_update.resyncDocContent) {
            total_doc_content_count++
          }
          if (total_doc_content_count > MAX_NEW_DOC_CONTENT_COUNT) {
            break
          }
          const next_total_op_length =
            total_op_length + (parsed_update?.op?.length || 1)
          if (
            updates_to_process_count > 0 &&
            next_total_op_length > MAX_UPDATE_OP_LENGTH
          ) {
            break
          } else {
            total_op_length = next_total_op_length
            updates_to_process_count++
          }
        }

        // if we hit the op limit above, only process the updates up to that point
        if (updates_to_process_count < updates.length) {
          logger.debug(
            {
              project_id,
              updates_to_process_count,
              updates_count: updates.length,
              total_op_length,
            },
            'restricting number of ops to be processed'
          )
          moreBatches = true
          // there is a 1:1 mapping between raw_updates and updates
          // which we need to preserve here to ensure we only
          // delete the updates that are actually processed
          raw_updates = raw_updates.slice(0, updates_to_process_count)
          updates = updates.slice(0, updates_to_process_count)
        }

        logger.debug({ project_id }, 'retrieved raw updates from redis')
        return runner(updates, function (error, ...args) {
          lastResults = args
          if (error != null) {
            return cb(OError.tag(error))
          }
          return deleteAppliedDocUpdates(project_id, raw_updates, cb)
        })
      })
    })

  const hasMoreBatches = (...args) => {
    const cb = args[args.length - 1]
    return cb(null, moreBatches)
  }

  return async.doWhilst(processBatch, hasMoreBatches, error =>
    callback(error, ...Array.from(lastResults))
  )
}

_mocks.deleteAppliedDocUpdates = (project_id, updates, callback) => {
  if (callback == null) {
    callback = function () {}
  }
  const multi = rclient.multi()
  // Delete all the updates which have been applied (exact match)
  for (const update of Array.from(updates || [])) {
    // Delete the first occurrence of the update with LREM KEY COUNT
    // VALUE by setting COUNT to 1 which 'removes COUNT elements equal to
    // value moving from head to tail.'
    //
    // If COUNT is 0 the entire list would be searched which would block
    // redis snce it would be an O(N) operation where N is the length of
    // the queue, in a multi of the batch size.
    metrics.summary('redis.projectHistoryOps', update.length, {
      status: 'lrem',
    })
    multi.lrem(Keys.projectHistoryOps({ project_id }), 1, update)
    multi.del(Keys.projectHistoryFirstOpTimestamp({ project_id }))
  }
  multi.exec(callback)
}

export function deleteAppliedDocUpdates(...args) {
  _mocks.deleteAppliedDocUpdates(...args)
}

export function destroyDocUpdatesQueue(project_id, callback) {
  // deletes the entire queue - use with caution
  if (callback == null) {
    callback = function () {}
  }
  return rclient.del(
    Keys.projectHistoryOps({ project_id }),
    Keys.projectHistoryFirstOpTimestamp({ project_id }),
    callback
  )
}

// iterate over keys asynchronously using redis scan (non-blocking)
// handle all the cluster nodes or single redis server
function _getKeys(pattern, limit, callback) {
  const nodes = (typeof rclient.nodes === 'function'
    ? rclient.nodes('master')
    : undefined) || [rclient]
  const doKeyLookupForNode = (node, cb) =>
    _getKeysFromNode(node, pattern, limit, cb)
  return async.concatSeries(nodes, doKeyLookupForNode, callback)
}

function _getKeysFromNode(node, pattern, limit, callback) {
  let cursor = 0 // redis iterator
  const keySet = {} // use hash to avoid duplicate results
  const batchSize = limit != null ? Math.min(limit, 1000) : 1000
  // scan over all keys looking for pattern
  const doIteration = (
    cb // avoid hitting redis too hard
  ) =>
    node.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      batchSize,
      function (error, reply) {
        let keys
        if (error != null) {
          return callback(OError.tag(error))
        }
        ;[cursor, keys] = Array.from(reply)
        for (const key of Array.from(keys)) {
          keySet[key] = true
        }
        keys = Object.keys(keySet)
        const noResults = cursor === '0' // redis returns string results not numeric
        const limitReached = limit != null && keys.length >= limit
        if (noResults || limitReached) {
          return callback(null, keys)
        } else {
          return setTimeout(doIteration, 10)
        }
      }
    )
  return doIteration()
}

// extract ids from keys like DocsWithHistoryOps:57fd0b1f53a8396d22b2c24b
// or DocsWithHistoryOps:{57fd0b1f53a8396d22b2c24b} (for redis cluster)
function _extractIds(keyList) {
  const ids = (() => {
    const result = []
    for (const key of Array.from(keyList)) {
      const m = key.match(/:\{?([0-9a-f]{24})\}?/) // extract object id
      result.push(m[1])
    }
    return result
  })()
  return ids
}

export function getProjectIdsWithHistoryOps(limit, callback) {
  if (callback == null) {
    callback = function () {}
  }
  return _getKeys(
    Keys.projectHistoryOps({ project_id: '*' }),
    limit,
    function (error, project_keys) {
      if (error != null) {
        return callback(OError.tag(error))
      }
      const project_ids = _extractIds(project_keys)
      return callback(error, project_ids)
    }
  )
}

export function getProjectIdsWithHistoryOpsCount(callback) {
  if (callback == null) {
    callback = function () {}
  }
  return getProjectIdsWithHistoryOps(null, function (error, projectIds) {
    if (error != null) {
      return callback(OError.tag(error))
    }
    const queuedProjectsCount = projectIds.length
    metrics.globalGauge('queued-projects', queuedProjectsCount)
    return callback(null, queuedProjectsCount)
  })
}

export function setFirstOpTimestamp(project_id, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const key = Keys.projectHistoryFirstOpTimestamp({ project_id })
  // store current time as an integer (string)
  return rclient.setnx(key, Date.now(), callback)
}

export function getFirstOpTimestamp(project_id, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const key = Keys.projectHistoryFirstOpTimestamp({ project_id })
  return rclient.get(key, function (err, result) {
    if (err != null) {
      return callback(OError.tag(err))
    }
    // convert stored time back to a numeric timestamp
    const timestamp = parseInt(result, 10)
    // check for invalid timestamp
    if (isNaN(timestamp)) {
      return callback()
    }
    // convert numeric timestamp to a date object
    const firstOpTimestamp = new Date(timestamp)
    return callback(null, firstOpTimestamp)
  })
}

export function clearFirstOpTimestamp(project_id, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const key = Keys.projectHistoryFirstOpTimestamp({ project_id })
  return rclient.del(key, callback)
}

export function getProjectIdsWithFirstOpTimestamps(limit, callback) {
  return _getKeys(
    Keys.projectHistoryFirstOpTimestamp({ project_id: '*' }),
    limit,
    function (error, project_keys) {
      if (error != null) {
        return callback(OError.tag(error))
      }
      const project_ids = _extractIds(project_keys)
      return callback(error, project_ids)
    }
  )
}

export function clearDanglingFirstOpTimestamp(project_id, callback) {
  rclient.exists(
    Keys.projectHistoryFirstOpTimestamp({ project_id }),
    Keys.projectHistoryOps({ project_id }),
    function (error, count) {
      if (error) {
        return callback(error)
      }
      if (count === 2 || count === 0) {
        // both (or neither) keys are present, so don't delete the timestamp
        return callback(null, 0)
      }
      // only one key is present, which makes this a dangling record,
      // so delete the timestamp
      rclient.del(Keys.projectHistoryFirstOpTimestamp({ project_id }), callback)
    }
  )
}

export function getCachedHistoryId(project_id, callback) {
  const key = Keys.projectHistoryCachedHistoryId({ project_id })
  rclient.get(key, function (err, historyId) {
    if (err) {
      return callback(OError.tag(err))
    }
    callback(null, historyId)
  })
}

export function setCachedHistoryId(project_id, historyId, callback) {
  const key = Keys.projectHistoryCachedHistoryId({ project_id })
  rclient.setex(key, CACHE_TTL_IN_SECONDS, historyId, callback)
}

export function clearCachedHistoryId(project_id, callback) {
  const key = Keys.projectHistoryCachedHistoryId({ project_id })
  rclient.del(key, callback)
}

// for tests
export function setMaxUpdateOpLength(value) {
  MAX_UPDATE_OP_LENGTH = value
}

export function setRawUpdateSizeThreshold(value) {
  RAW_UPDATE_SIZE_THRESHOLD = value
}

export function setMaxNewDocContentCount(value) {
  MAX_NEW_DOC_CONTENT_COUNT = value
}

export const promises = {
  countUnprocessedUpdates: promisify(countUnprocessedUpdates),
  getProjectIdsWithFirstOpTimestamps: promisify(
    getProjectIdsWithFirstOpTimestamps
  ),
  clearDanglingFirstOpTimestamp: promisify(clearDanglingFirstOpTimestamp),
}
