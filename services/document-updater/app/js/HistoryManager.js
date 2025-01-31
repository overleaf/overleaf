const async = require('async')
const logger = require('@overleaf/logger')
const { promisifyAll } = require('@overleaf/promise-utils')
const request = require('request')
const Settings = require('@overleaf/settings')
const ProjectHistoryRedisManager = require('./ProjectHistoryRedisManager')
const metrics = require('./Metrics')

const HistoryManager = {
  // flush changes in the background
  flushProjectChangesAsync(projectId) {
    HistoryManager.flushProjectChanges(
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
    request.post({ url, qs }, function (error, res, body) {
      if (error) {
        logger.error({ error, projectId }, 'project history api request failed')
        callback(error)
      } else if (res.statusCode < 200 && res.statusCode >= 300) {
        logger.error(
          { projectId },
          `project history api returned a failure status code: ${res.statusCode}`
        )
        callback(error)
      } else {
        callback()
      }
    })
  },

  FLUSH_DOC_EVERY_N_OPS: 100,
  FLUSH_PROJECT_EVERY_N_OPS: 500,

  recordAndFlushHistoryOps(projectId, ops, projectOpsLength) {
    if (ops == null) {
      ops = []
    }
    if (ops.length === 0) {
      return
    }

    // record updates for project history
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

  resyncProjectHistory(
    projectId,
    projectHistoryId,
    docs,
    files,
    opts,
    callback
  ) {
    ProjectHistoryRedisManager.queueResyncProjectStructure(
      projectId,
      projectHistoryId,
      docs,
      files,
      opts,
      function (error) {
        if (error) {
          return callback(error)
        }
        if (opts.resyncProjectStructureOnly) return callback()
        const DocumentManager = require('./DocumentManager')
        const resyncDoc = (doc, cb) => {
          DocumentManager.resyncDocContentsWithLock(
            projectId,
            doc.doc,
            doc.path,
            opts,
            cb
          )
        }
        async.eachLimit(
          docs,
          HistoryManager.MAX_PARALLEL_REQUESTS,
          resyncDoc,
          callback
        )
      }
    )
  },
}

module.exports = HistoryManager
module.exports.promises = promisifyAll(HistoryManager, {
  without: [
    'flushProjectChangesAsync',
    'recordAndFlushHistoryOps',
    'shouldFlushHistoryOps',
  ],
})
