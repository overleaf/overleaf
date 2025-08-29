/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DeleteQueueManager
const Settings = require('@overleaf/settings')
const { promisifyAll } = require('@overleaf/promise-utils')
const RedisManager = require('./RedisManager')
const ProjectManager = require('./ProjectManager')
const logger = require('@overleaf/logger')
const metrics = require('./Metrics')

// Maintain a sorted set of project flushAndDelete requests, ordered by timestamp
// (ZADD), and process them from oldest to newest. A flushAndDelete request comes
// from real-time and is triggered when a user leaves a project.
//
// The aim is to remove the project from redis 5 minutes after the last request
// if there has been no activity (document updates) in that time.  If there is
// activity we can expect a further flushAndDelete request when the editing user
// leaves the project.
//
// If a new flushAndDelete request comes in while an existing request is already
// in the queue we update the timestamp as we can postpone flushing further.
//
// Documents are processed by checking the queue, seeing if the first entry is
// older than 5 minutes, and popping it from the queue in that case.

module.exports = DeleteQueueManager = {
  flushAndDeleteOldProjects(options, callback) {
    const startTime = Date.now()
    const cutoffTime =
      startTime - options.min_delete_age + 100 * (Math.random() - 0.5)
    let count = 0

    const flushProjectIfNotModified = (projectId, flushTimestamp, cb) =>
      ProjectManager.getProjectDocsTimestamps(
        projectId,
        function (err, timestamps) {
          if (err != null) {
            return callback(err)
          }
          if (timestamps.length === 0) {
            logger.debug(
              { projectId },
              'skipping flush of queued project - no timestamps'
            )
            return cb()
          }
          // are any of the timestamps newer than the time the project was flushed?
          for (const timestamp of Array.from(timestamps)) {
            if (timestamp > flushTimestamp) {
              metrics.inc('queued-delete-skipped')
              logger.debug(
                { projectId, timestamps, flushTimestamp },
                'found newer timestamp, will skip delete'
              )
              return cb()
            }
          }
          logger.debug({ projectId, flushTimestamp }, 'flushing queued project')
          return ProjectManager.flushAndDeleteProjectWithLocks(
            projectId,
            { skip_history_flush: false },
            function (err) {
              if (err != null) {
                logger.err({ projectId, err }, 'error flushing queued project')
              }
              metrics.inc('queued-delete-completed')
              return cb(null, true)
            }
          )
        }
      )

    function flushNextProject() {
      const now = Date.now()
      if (now - startTime > options.timeout) {
        logger.debug('hit time limit on flushing old projects')
        return callback(null, count)
      }
      if (count > options.limit) {
        logger.debug('hit count limit on flushing old projects')
        return callback(null, count)
      }
      return RedisManager.getNextProjectToFlushAndDelete(
        cutoffTime,
        function (err, projectId, flushTimestamp, queueLength) {
          if (err != null) {
            return callback(err, count)
          }
          if (projectId == null) {
            return callback(null, count)
          }
          logger.debug({ projectId, queueLength }, 'flushing queued project')
          metrics.globalGauge('queued-flush-backlog', queueLength)
          return flushProjectIfNotModified(
            projectId,
            flushTimestamp,
            function (err, flushed) {
              if (err) {
                // Do not stop processing the queue in case the flush fails.
                // Slowing down the processing can fill up redis.
                metrics.inc('queued-delete-error')
              }
              if (flushed) {
                count++
              }
              return flushNextProject()
            }
          )
        }
      )
    }

    return flushNextProject()
  },

  startBackgroundFlush() {
    const SHORT_DELAY = 10
    const LONG_DELAY = 1000
    function doFlush() {
      if (Settings.shuttingDown) {
        logger.info('discontinuing background flush due to shutdown')
        return
      }
      return DeleteQueueManager.flushAndDeleteOldProjects(
        {
          timeout: 1000,
          min_delete_age: 3 * 60 * 1000,
          limit: 1000, // high value, to ensure we always flush enough projects
        },
        (_err, flushed) =>
          setTimeout(doFlush, flushed > 10 ? SHORT_DELAY : LONG_DELAY)
      )
    }
    return doFlush()
  },
}

DeleteQueueManager.promises = promisifyAll(DeleteQueueManager)
