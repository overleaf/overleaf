// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { ObjectId } from './mongodb.js'
import request from 'request'
import async from 'async'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import * as LockManager from './LockManager.js'

const { port } = settings.internal.history

export function check(callback) {
  const projectId = new ObjectId(settings.history.healthCheck.project_id)
  const url = `http://127.0.0.1:${port}/project/${projectId}`
  logger.debug({ projectId }, 'running health check')
  const jobs = [
    cb =>
      request.get(
        { url: `http://127.0.0.1:${port}/check_lock`, timeout: 3000 },
        function (err, res, body) {
          if (err != null) {
            OError.tag(err, 'error checking lock for health check', {
              project_id: projectId,
            })
            return cb(err)
          } else if ((res != null ? res.statusCode : undefined) !== 200) {
            return cb(new Error(`status code not 200, it's ${res.statusCode}`))
          } else {
            return cb()
          }
        }
      ),
    cb =>
      request.post(
        { url: `${url}/flush`, timeout: 10000 },
        function (err, res, body) {
          if (err != null) {
            OError.tag(err, 'error flushing for health check', {
              project_id: projectId,
            })
            return cb(err)
          } else if ((res != null ? res.statusCode : undefined) !== 204) {
            return cb(new Error(`status code not 204, it's ${res.statusCode}`))
          } else {
            return cb()
          }
        }
      ),
    cb =>
      request.get(
        { url: `${url}/updates`, timeout: 10000 },
        function (err, res, body) {
          if (err != null) {
            OError.tag(err, 'error getting updates for health check', {
              project_id: projectId,
            })
            return cb(err)
          } else if ((res != null ? res.statusCode : undefined) !== 200) {
            return cb(new Error(`status code not 200, it's ${res.statusCode}`))
          } else {
            return cb()
          }
        }
      ),
  ]
  return async.series(jobs, callback)
}

export function checkLock(callback) {
  return LockManager.healthCheck(callback)
}
