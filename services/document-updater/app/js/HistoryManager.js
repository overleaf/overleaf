// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let HistoryManager
const async = require('async')
const logger = require('@overleaf/logger')
const request = require('request')
const Settings = require('@overleaf/settings')
const HistoryRedisManager = require('./HistoryRedisManager')
const ProjectHistoryRedisManager = require('./ProjectHistoryRedisManager')
const RedisManager = require('./RedisManager')
const metrics = require('./Metrics')

module.exports = HistoryManager = {
  flushDocChangesAsync(projectId, docId) {
    if (
      (Settings.apis != null ? Settings.apis.trackchanges : undefined) == null
    ) {
      logger.warn(
        { docId },
        'track changes API is not configured, so not flushing'
      )
      return
    }
    if (Settings.disableTrackChanges) {
      logger.debug({ docId }, 'track changes is disabled, so not flushing')
      return
    }
    return RedisManager.getHistoryType(
      docId,
      function (err, projectHistoryType) {
        if (err != null) {
          logger.warn({ err, docId }, 'error getting history type')
        }
        // if there's an error continue and flush to track-changes for safety
        if (
          Settings.disableDoubleFlush &&
          projectHistoryType === 'project-history'
        ) {
          return logger.debug(
            { docId, projectHistoryType },
            'skipping track-changes flush'
          )
        } else {
          metrics.inc('history-flush', 1, { status: 'track-changes' })
          const url = `${Settings.apis.trackchanges.url}/project/${projectId}/doc/${docId}/flush`
          logger.debug(
            { projectId, docId, url, projectHistoryType },
            'flushing doc in track changes api'
          )
          return request.post(url, function (error, res, body) {
            if (error != null) {
              return logger.error(
                { error, docId, projectId },
                'track changes doc to track changes api'
              )
            } else if (res.statusCode < 200 && res.statusCode >= 300) {
              return logger.error(
                { docId, projectId },
                `track changes api returned a failure status code: ${res.statusCode}`
              )
            }
          })
        }
      }
    )
  },

  // flush changes in the background
  flushProjectChangesAsync(projectId) {
    if (!Settings.apis?.project_history?.enabled) {
      return
    }
    return HistoryManager.flushProjectChanges(
      projectId,
      { background: true },
      function () {}
    )
  },

  // flush changes and callback (for when we need to know the queue is flushed)
  flushProjectChanges(projectId, options, callback) {
    if (callback == null) {
      callback = function () {}
    }
    if (!Settings.apis?.project_history?.enabled) {
      return callback()
    }
    if (options.skip_history_flush) {
      logger.debug({ projectId }, 'skipping flush of project history')
      return callback()
    }
    metrics.inc('history-flush', 1, { status: 'project-history' })
    const url = `${Settings.apis.project_history.url}/project/${projectId}/flush`
    const qs = {}
    if (options.background) {
      qs.background = true
    } // pass on the background flush option if present
    logger.debug({ projectId, url, qs }, 'flushing doc in project history api')
    return request.post({ url, qs }, function (error, res, body) {
      if (error != null) {
        logger.error(
          { error, projectId },
          'project history doc to track changes api'
        )
        return callback(error)
      } else if (res.statusCode < 200 && res.statusCode >= 300) {
        logger.error(
          { projectId },
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
    projectId,
    docId,
    ops,
    docOpsLength,
    projectOpsLength,
    callback
  ) {
    if (ops == null) {
      ops = []
    }
    if (callback == null) {
      callback = function () {}
    }
    if (ops.length === 0) {
      return callback()
    }

    // record updates for project history
    if (Settings.apis?.project_history?.enabled) {
      if (
        HistoryManager.shouldFlushHistoryOps(
          projectOpsLength,
          ops.length,
          HistoryManager.FLUSH_PROJECT_EVERY_N_OPS
        )
      ) {
        // Do this in the background since it uses HTTP and so may be too
        // slow to wait for when processing a doc update.
        logger.debug(
          { projectOpsLength, projectId },
          'flushing project history api'
        )
        HistoryManager.flushProjectChangesAsync(projectId)
      }
    }

    // if the doc_ops_length is undefined it means the project is not using track-changes
    // so we can bail out here
    if (Settings.disableTrackChanges || typeof docOpsLength === 'undefined') {
      logger.debug(
        { projectId, docId },
        'skipping flush to track-changes, only using project-history'
      )
      return callback()
    }

    // record updates for track-changes
    return HistoryRedisManager.recordDocHasHistoryOps(
      projectId,
      docId,
      ops,
      function (error) {
        if (error != null) {
          return callback(error)
        }
        if (
          HistoryManager.shouldFlushHistoryOps(
            docOpsLength,
            ops.length,
            HistoryManager.FLUSH_DOC_EVERY_N_OPS
          )
        ) {
          // Do this in the background since it uses HTTP and so may be too
          // slow to wait for when processing a doc update.
          logger.debug(
            { docOpsLength, docId, projectId },
            'flushing track changes api'
          )
          HistoryManager.flushDocChangesAsync(projectId, docId)
        }
        return callback()
      }
    )
  },

  shouldFlushHistoryOps(length, opsLength, threshold) {
    if (!length) {
      return false
    } // don't flush unless we know the length
    // We want to flush every 100 ops, i.e. 100, 200, 300, etc
    // Find out which 'block' (i.e. 0-99, 100-199) we were in before and after pushing these
    // ops. If we've changed, then we've gone over a multiple of 100 and should flush.
    // (Most of the time, we will only hit 100 and then flushing will put us back to 0)
    const previousLength = length - opsLength
    const prevBlock = Math.floor(previousLength / threshold)
    const newBlock = Math.floor(length / threshold)
    return newBlock !== prevBlock
  },

  MAX_PARALLEL_REQUESTS: 4,

  resyncProjectHistory(projectId, projectHistoryId, docs, files, callback) {
    return ProjectHistoryRedisManager.queueResyncProjectStructure(
      projectId,
      projectHistoryId,
      docs,
      files,
      function (error) {
        if (error != null) {
          return callback(error)
        }
        const DocumentManager = require('./DocumentManager')
        const resyncDoc = (doc, cb) => {
          DocumentManager.resyncDocContentsWithLock(
            projectId,
            doc.doc,
            doc.path,
            cb
          )
        }
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
