// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import async from 'async'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import metrics from '@overleaf/metrics'
import _ from 'lodash'
import * as RedisManager from './RedisManager.js'
import * as UpdatesProcessor from './UpdatesProcessor.js'
import * as ErrorRecorder from './ErrorRecorder.js'

export function flushIfOld(projectId, cutoffTime, callback) {
  if (callback == null) {
    callback = function () {}
  }
  return RedisManager.getFirstOpTimestamp(
    projectId,
    function (err, firstOpTimestamp) {
      if (err != null) {
        return callback(OError.tag(err))
      }
      // In the normal case, the flush marker will be set with the
      // timestamp of the oldest operation in the queue by docupdater.
      // If the marker is not set for any reason, we flush it anyway
      // for safety.
      if (!firstOpTimestamp || firstOpTimestamp < cutoffTime) {
        logger.debug(
          { projectId, firstOpTimestamp, cutoffTime },
          'flushing old project'
        )
        metrics.inc('flush-old-updates', 1, { status: 'flushed' })
        return UpdatesProcessor.processUpdatesForProject(projectId, callback)
      } else {
        metrics.inc('flush-old-updates', 1, { status: 'skipped' })
        return callback()
      }
    }
  )
}

export function flushOldOps(options, callback) {
  if (callback == null) {
    callback = function () {}
  }
  logger.debug({ options }, 'starting flush of old ops')
  // allow running flush in background for cron jobs
  if (options.background) {
    // return immediate response to client, then discard callback
    callback(null, { message: 'running flush in background' })
    callback = function () {}
  }
  return RedisManager.getProjectIdsWithHistoryOps(
    null,
    function (error, projectIds) {
      if (error != null) {
        return callback(OError.tag(error))
      }
      return ErrorRecorder.getFailedProjects(
        function (error, projectHistoryFailures) {
          if (error != null) {
            return callback(OError.tag(error))
          }
          // exclude failed projects already in projectHistoryFailures
          const failedProjects = new Set()
          for (const entry of Array.from(projectHistoryFailures)) {
            failedProjects.add(entry.project_id)
          }
          // randomise order so we get different projects if there is a limit
          projectIds = _.shuffle(projectIds)
          const maxAge = options.maxAge || 6 * 3600 // default to 6 hours
          const cutoffTime = new Date(Date.now() - maxAge * 1000)
          const startTime = new Date()
          let count = 0
          const jobs = projectIds.map(
            projectId =>
              function (cb) {
                const timeTaken = new Date() - startTime
                count++
                if (
                  (options != null ? options.timeout : undefined) &&
                  timeTaken > options.timeout
                ) {
                  // finish early due to timeout, return an error to bail out of the async iteration
                  logger.debug('background retries timed out')
                  return cb(new OError('retries timed out'))
                }
                if (
                  (options != null ? options.limit : undefined) &&
                  count > options.limit
                ) {
                  // finish early due to reaching limit, return an error to bail out of the async iteration
                  logger.debug({ count }, 'background retries hit limit')
                  return cb(new OError('hit limit'))
                }
                if (failedProjects.has(projectId)) {
                  // skip failed projects
                  return setTimeout(cb, options.queueDelay || 100) // pause between flushes
                }
                return flushIfOld(projectId, cutoffTime, function (err) {
                  if (err != null) {
                    logger.warn(
                      { projectId, err },
                      'error flushing old project'
                    )
                  }
                  return setTimeout(cb, options.queueDelay || 100)
                })
              }
          ) // pause between flushes
          return async.series(
            async.reflectAll(jobs),
            function (error, results) {
              const success = []
              const failure = []
              results.forEach((result, i) => {
                if (
                  result.error != null &&
                  !['retries timed out', 'hit limit'].includes(
                    result?.error?.message
                  )
                ) {
                  // ignore expected errors
                  return failure.push(projectIds[i])
                } else {
                  return success.push(projectIds[i])
                }
              })
              return callback(error, { success, failure, failedProjects })
            }
          )
        }
      )
    }
  )
}
