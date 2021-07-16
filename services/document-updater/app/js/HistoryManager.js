/* eslint-disable
    camelcase,
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let HistoryManager
const async = require('async')
const logger = require('logger-sharelatex')
const request = require('request')
const Settings = require('@overleaf/settings')
const HistoryRedisManager = require('./HistoryRedisManager')
const ProjectHistoryRedisManager = require('./ProjectHistoryRedisManager')
const RedisManager = require('./RedisManager')
const metrics = require('./Metrics')

module.exports = HistoryManager = {
  flushDocChangesAsync(project_id, doc_id) {
    if (
      (Settings.apis != null ? Settings.apis.trackchanges : undefined) == null
    ) {
      logger.warn(
        { doc_id },
        'track changes API is not configured, so not flushing'
      )
      return
    }
    return RedisManager.getHistoryType(
      doc_id,
      function (err, projectHistoryType) {
        if (err != null) {
          logger.warn({ err, doc_id }, 'error getting history type')
        }
        // if there's an error continue and flush to track-changes for safety
        if (
          Settings.disableDoubleFlush &&
          projectHistoryType === 'project-history'
        ) {
          return logger.debug(
            { doc_id, projectHistoryType },
            'skipping track-changes flush'
          )
        } else {
          metrics.inc('history-flush', 1, { status: 'track-changes' })
          const url = `${Settings.apis.trackchanges.url}/project/${project_id}/doc/${doc_id}/flush`
          logger.log(
            { project_id, doc_id, url, projectHistoryType },
            'flushing doc in track changes api'
          )
          return request.post(url, function (error, res, body) {
            if (error != null) {
              return logger.error(
                { error, doc_id, project_id },
                'track changes doc to track changes api'
              )
            } else if (res.statusCode < 200 && res.statusCode >= 300) {
              return logger.error(
                { doc_id, project_id },
                `track changes api returned a failure status code: ${res.statusCode}`
              )
            }
          })
        }
      }
    )
  },

  // flush changes in the background
  flushProjectChangesAsync(project_id) {
    if (
      !__guard__(
        Settings.apis != null ? Settings.apis.project_history : undefined,
        x => x.enabled
      )
    ) {
      return
    }
    return HistoryManager.flushProjectChanges(
      project_id,
      { background: true },
      function () {}
    )
  },

  // flush changes and callback (for when we need to know the queue is flushed)
  flushProjectChanges(project_id, options, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    if (
      !__guard__(
        Settings.apis != null ? Settings.apis.project_history : undefined,
        x => x.enabled
      )
    ) {
      return callback()
    }
    if (options.skip_history_flush) {
      logger.log({ project_id }, 'skipping flush of project history')
      return callback()
    }
    metrics.inc('history-flush', 1, { status: 'project-history' })
    const url = `${Settings.apis.project_history.url}/project/${project_id}/flush`
    const qs = {}
    if (options.background) {
      qs.background = true
    } // pass on the background flush option if present
    logger.log({ project_id, url, qs }, 'flushing doc in project history api')
    return request.post({ url, qs }, function (error, res, body) {
      if (error != null) {
        logger.error(
          { error, project_id },
          'project history doc to track changes api'
        )
        return callback(error)
      } else if (res.statusCode < 200 && res.statusCode >= 300) {
        logger.error(
          { project_id },
          `project history api returned a failure status code: ${res.statusCode}`
        )
        return callback(error)
      } else {
        return callback()
      }
    })
  },

  FLUSH_DOC_EVERY_N_OPS: 100,
  FLUSH_PROJECT_EVERY_N_OPS: 500,

  recordAndFlushHistoryOps(
    project_id,
    doc_id,
    ops,
    doc_ops_length,
    project_ops_length,
    callback
  ) {
    if (ops == null) {
      ops = []
    }
    if (callback == null) {
      callback = function (error) {}
    }
    if (ops.length === 0) {
      return callback()
    }

    // record updates for project history
    if (
      __guard__(
        Settings.apis != null ? Settings.apis.project_history : undefined,
        x => x.enabled
      )
    ) {
      if (
        HistoryManager.shouldFlushHistoryOps(
          project_ops_length,
          ops.length,
          HistoryManager.FLUSH_PROJECT_EVERY_N_OPS
        )
      ) {
        // Do this in the background since it uses HTTP and so may be too
        // slow to wait for when processing a doc update.
        logger.log(
          { project_ops_length, project_id },
          'flushing project history api'
        )
        HistoryManager.flushProjectChangesAsync(project_id)
      }
    }

    // if the doc_ops_length is undefined it means the project is not using track-changes
    // so we can bail out here
    if (typeof doc_ops_length === 'undefined') {
      logger.debug(
        { project_id, doc_id },
        'skipping flush to track-changes, only using project-history'
      )
      return callback()
    }

    // record updates for track-changes
    return HistoryRedisManager.recordDocHasHistoryOps(
      project_id,
      doc_id,
      ops,
      function (error) {
        if (error != null) {
          return callback(error)
        }
        if (
          HistoryManager.shouldFlushHistoryOps(
            doc_ops_length,
            ops.length,
            HistoryManager.FLUSH_DOC_EVERY_N_OPS
          )
        ) {
          // Do this in the background since it uses HTTP and so may be too
          // slow to wait for when processing a doc update.
          logger.log(
            { doc_ops_length, doc_id, project_id },
            'flushing track changes api'
          )
          HistoryManager.flushDocChangesAsync(project_id, doc_id)
        }
        return callback()
      }
    )
  },

  shouldFlushHistoryOps(length, ops_length, threshold) {
    if (!length) {
      return false
    } // don't flush unless we know the length
    // We want to flush every 100 ops, i.e. 100, 200, 300, etc
    // Find out which 'block' (i.e. 0-99, 100-199) we were in before and after pushing these
    // ops. If we've changed, then we've gone over a multiple of 100 and should flush.
    // (Most of the time, we will only hit 100 and then flushing will put us back to 0)
    const previousLength = length - ops_length
    const prevBlock = Math.floor(previousLength / threshold)
    const newBlock = Math.floor(length / threshold)
    return newBlock !== prevBlock
  },

  MAX_PARALLEL_REQUESTS: 4,

  resyncProjectHistory(project_id, projectHistoryId, docs, files, callback) {
    return ProjectHistoryRedisManager.queueResyncProjectStructure(
      project_id,
      projectHistoryId,
      docs,
      files,
      function (error) {
        if (error != null) {
          return callback(error)
        }
        const DocumentManager = require('./DocumentManager')
        const resyncDoc = (doc, cb) =>
          DocumentManager.resyncDocContentsWithLock(project_id, doc.doc, cb)
        return async.eachLimit(
          docs,
          HistoryManager.MAX_PARALLEL_REQUESTS,
          resyncDoc,
          callback
        )
      }
    )
  },
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
