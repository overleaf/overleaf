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
let RedisManager
const Settings = require('@overleaf/settings')
const redis = require('@overleaf/redis-wrapper')
const rclient = redis.createClient(Settings.redis.history)
const Keys = Settings.redis.history.key_schema
const async = require('async')

module.exports = RedisManager = {
  getOldestDocUpdates(docId, batchSize, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const key = Keys.uncompressedHistoryOps({ doc_id: docId })
    return rclient.lrange(key, 0, batchSize - 1, callback)
  },

  expandDocUpdates(jsonUpdates, callback) {
    let rawUpdates
    if (callback == null) {
      callback = function () {}
    }
    try {
      rawUpdates = Array.from(jsonUpdates || []).map(update =>
        JSON.parse(update)
      )
    } catch (e) {
      return callback(e)
    }
    return callback(null, rawUpdates)
  },

  deleteAppliedDocUpdates(projectId, docId, docUpdates, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const multi = rclient.multi()
    // Delete all the updates which have been applied (exact match)
    for (const update of Array.from(docUpdates || [])) {
      multi.lrem(Keys.uncompressedHistoryOps({ doc_id: docId }), 1, update)
    }
    return multi.exec(function (error, results) {
      if (error != null) {
        return callback(error)
      }
      // It's ok to delete the doc_id from the set here. Even though the list
      // of updates may not be empty, we will continue to process it until it is.
      return rclient.srem(
        Keys.docsWithHistoryOps({ project_id: projectId }),
        docId,
        function (error) {
          if (error != null) {
            return callback(error)
          }
          return callback(null)
        }
      )
    })
  },

  getDocIdsWithHistoryOps(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return rclient.smembers(
      Keys.docsWithHistoryOps({ project_id: projectId }),
      callback
    )
  },

  // iterate over keys asynchronously using redis scan (non-blocking)
  // handle all the cluster nodes or single redis server
  _getKeys(pattern, callback) {
    const nodes = (typeof rclient.nodes === 'function'
      ? rclient.nodes('master')
      : undefined) || [rclient]
    const doKeyLookupForNode = (node, cb) =>
      RedisManager._getKeysFromNode(node, pattern, cb)
    return async.concatSeries(nodes, doKeyLookupForNode, callback)
  },

  _getKeysFromNode(node, pattern, callback) {
    let cursor = 0 // redis iterator
    const keySet = {} // use hash to avoid duplicate results
    // scan over all keys looking for pattern
    const doIteration = cb =>
      node.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        1000,
        function (error, reply) {
          let keys
          if (error != null) {
            return callback(error)
          }
          ;[cursor, keys] = Array.from(reply)
          for (const key of Array.from(keys)) {
            keySet[key] = true
          }
          if (cursor === '0') {
            // note redis returns string result not numeric
            return callback(null, Object.keys(keySet))
          } else {
            return doIteration()
          }
        }
      )
    return doIteration()
  },

  // extract ids from keys like DocsWithHistoryOps:57fd0b1f53a8396d22b2c24b
  // or DocsWithHistoryOps:{57fd0b1f53a8396d22b2c24b} (for redis cluster)
  _extractIds(keyList) {
    const ids = (() => {
      const result = []
      for (const key of Array.from(keyList)) {
        const m = key.match(/:\{?([0-9a-f]{24})\}?/) // extract object id
        result.push(m[1])
      }
      return result
    })()
    return ids
  },

  getProjectIdsWithHistoryOps(callback) {
    if (callback == null) {
      callback = function () {}
    }
    return RedisManager._getKeys(
      Keys.docsWithHistoryOps({ project_id: '*' }),
      function (error, projectKeys) {
        if (error != null) {
          return callback(error)
        }
        const projectIds = RedisManager._extractIds(projectKeys)
        return callback(error, projectIds)
      }
    )
  },

  getAllDocIdsWithHistoryOps(callback) {
    // return all the docids, to find dangling history entries after
    // everything is flushed.
    if (callback == null) {
      callback = function () {}
    }
    return RedisManager._getKeys(
      Keys.uncompressedHistoryOps({ doc_id: '*' }),
      function (error, docKeys) {
        if (error != null) {
          return callback(error)
        }
        const docIds = RedisManager._extractIds(docKeys)
        return callback(error, docIds)
      }
    )
  },
}
