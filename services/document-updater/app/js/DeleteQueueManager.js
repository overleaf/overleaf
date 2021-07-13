/* eslint-disable
    camelcase,
    handle-callback-err,
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
const RedisManager = require('./RedisManager')
const ProjectManager = require('./ProjectManager')
const logger = require('logger-sharelatex')
const metrics = require('./Metrics')
const async = require('async')

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

    const flushProjectIfNotModified = (project_id, flushTimestamp, cb) =>
      ProjectManager.getProjectDocsTimestamps(
        project_id,
        function (err, timestamps) {
          if (err != null) {
            return callback(err)
          }
          if (timestamps.length === 0) {
            logger.log(
              { project_id },
              'skipping flush of queued project - no timestamps'
            )
            return cb()
          }
          // are any of the timestamps newer than the time the project was flushed?
          for (const timestamp of Array.from(timestamps)) {
            if (timestamp > flushTimestamp) {
              metrics.inc('queued-delete-skipped')
              logger.debug(
                { project_id, timestamps, flushTimestamp },
                'found newer timestamp, will skip delete'
              )
              return cb()
            }
          }
          logger.log({ project_id, flushTimestamp }, 'flushing queued project')
          return ProjectManager.flushAndDeleteProjectWithLocks(
            project_id,
            { skip_history_flush: false },
            function (err) {
              if (err != null) {
                logger.err({ project_id, err }, 'error flushing queued project')
              }
              metrics.inc('queued-delete-completed')
              return cb(null, true)
            }
          )
        }
      )

    var flushNextProject = function () {
      const now = Date.now()
      if (now - startTime > options.timeout) {
        logger.log('hit time limit on flushing old projects')
        return callback(null, count)
      }
      if (count > options.limit) {
        logger.log('hit count limit on flushing old projects')
        return callback(null, count)
      }
      return RedisManager.getNextProjectToFlushAndDelete(
        cutoffTime,
        function (err, project_id, flushTimestamp, queueLength) {
          if (err != null) {
            return callback(err)
          }
          if (project_id == null) {
            return callback(null, count)
          }
          logger.log({ project_id, queueLength }, 'flushing queued project')
          metrics.globalGauge('queued-flush-backlog', queueLength)
          return flushProjectIfNotModified(
            project_id,
            flushTimestamp,
            function (err, flushed) {
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
    var doFlush = function () {
      if (Settings.shuttingDown) {
        logger.warn('discontinuing background flush due to shutdown')
        return
      }
      return DeleteQueueManager.flushAndDeleteOldProjects(
        {
          timeout: 1000,
          min_delete_age: 3 * 60 * 1000,
          limit: 1000, // high value, to ensure we always flush enough projects
        },
        (err, flushed) =>
          setTimeout(doFlush, flushed > 10 ? SHORT_DELAY : LONG_DELAY)
      )
    }
    return doFlush()
  },
}
