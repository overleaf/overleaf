/* eslint-disable
    no-unused-vars,
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
const request = require('request')
const Settings = require('@overleaf/settings')
const RedisManager = require('./RedisManager')
const { rclient } = RedisManager
const docUpdaterKeys = Settings.redis.documentupdater.key_schema
const async = require('async')
const ProjectManager = require('./ProjectManager')
const _ = require('lodash')
const logger = require('@overleaf/logger')

const ProjectFlusher = {
  // iterate over keys asynchronously using redis scan (non-blocking)
  // handle all the cluster nodes or single redis server
  _getKeys(pattern, limit, callback) {
    const nodes = (typeof rclient.nodes === 'function'
      ? rclient.nodes('master')
      : undefined) || [rclient]
    const doKeyLookupForNode = (node, cb) =>
      ProjectFlusher._getKeysFromNode(node, pattern, limit, cb)
    return async.concatSeries(nodes, doKeyLookupForNode, callback)
  },

  _getKeysFromNode(node, pattern, limit, callback) {
    if (limit == null) {
      limit = 1000
    }
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
            return callback(error)
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
  },

  // extract ids from keys like DocsWithHistoryOps:57fd0b1f53a8396d22b2c24b
  // or docsInProject:{57fd0b1f53a8396d22b2c24b} (for redis cluster)
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

  flushAllProjects(options, callback) {
    logger.info({ options }, 'flushing all projects')
    return ProjectFlusher._getKeys(
      docUpdaterKeys.docsInProject({ project_id: '*' }),
      options.limit,
      function (error, projectKeys) {
        if (error != null) {
          logger.err({ err: error }, 'error getting keys for flushing')
          return callback(error)
        }
        const projectIds = ProjectFlusher._extractIds(projectKeys)
        if (options.dryRun) {
          return callback(null, projectIds)
        }
        const jobs = _.map(
          projectIds,
          projectId => cb =>
            ProjectManager.flushAndDeleteProjectWithLocks(
              projectId,
              { background: true },
              cb
            )
        )
        return async.parallelLimit(
          async.reflectAll(jobs),
          options.concurrency,
          function (error, results) {
            const success = []
            const failure = []
            _.each(results, function (result, i) {
              if (result.error != null) {
                return failure.push(projectIds[i])
              } else {
                return success.push(projectIds[i])
              }
            })
            logger.info(
              { successCount: success.length, failureCount: failure.length },
              'finished flushing all projects'
            )
            return callback(error, { success, failure })
          }
        )
      }
    )
  },
}

module.exports = ProjectFlusher
