/* eslint-disable
    camelcase,
    handle-callback-err,
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
let RedisManager
const Settings = require('@overleaf/settings')
const redis = require('@overleaf/redis-wrapper')
const rclient = redis.createClient(Settings.redis.history)
const Keys = Settings.redis.history.key_schema
const async = require('async')

module.exports = RedisManager = {
  getOldestDocUpdates(doc_id, batchSize, callback) {
    if (callback == null) {
      callback = function (error, jsonUpdates) {}
    }
    const key = Keys.uncompressedHistoryOps({ doc_id })
    return rclient.lrange(key, 0, batchSize - 1, callback)
  },

  expandDocUpdates(jsonUpdates, callback) {
    let rawUpdates
    if (callback == null) {
      callback = function (error, rawUpdates) {}
    }
    try {
      rawUpdates = Array.from(jsonUpdates || []).map((update) =>
        JSON.parse(update)
      )
    } catch (e) {
      return callback(e)
    }
    return callback(null, rawUpdates)
  },

  deleteAppliedDocUpdates(project_id, doc_id, docUpdates, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const multi = rclient.multi()
    // Delete all the updates which have been applied (exact match)
    for (const update of Array.from(docUpdates || [])) {
      multi.lrem(Keys.uncompressedHistoryOps({ doc_id }), 1, update)
    }
    return multi.exec(function (error, results) {
      if (error != null) {
        return callback(error)
      }
      // It's ok to delete the doc_id from the set here. Even though the list
      // of updates may not be empty, we will continue to process it until it is.
      return rclient.srem(
        Keys.docsWithHistoryOps({ project_id }),
        doc_id,
        function (error) {
          if (error != null) {
            return callback(error)
          }
          return callback(null)
        }
      )
    })
  },

  getDocIdsWithHistoryOps(project_id, callback) {
    if (callback == null) {
      callback = function (error, doc_ids) {}
    }
    return rclient.smembers(Keys.docsWithHistoryOps({ project_id }), callback)
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
    var doIteration = (cb) =>
      node.scan(cursor, 'MATCH', pattern, 'COUNT', 1000, function (
        error,
        reply
      ) {
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
      })
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
      callback = function (error, project_ids) {}
    }
    return RedisManager._getKeys(
      Keys.docsWithHistoryOps({ project_id: '*' }),
      function (error, project_keys) {
        if (error != null) {
          return callback(error)
        }
        const project_ids = RedisManager._extractIds(project_keys)
        return callback(error, project_ids)
      }
    )
  },

  getAllDocIdsWithHistoryOps(callback) {
    // return all the docids, to find dangling history entries after
    // everything is flushed.
    if (callback == null) {
      callback = function (error, doc_ids) {}
    }
    return RedisManager._getKeys(
      Keys.uncompressedHistoryOps({ doc_id: '*' }),
      function (error, doc_keys) {
        if (error != null) {
          return callback(error)
        }
        const doc_ids = RedisManager._extractIds(doc_keys)
        return callback(error, doc_ids)
      }
    )
  }
}
