// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { ObjectId } = require('./mongodb')
const request = require('request')
const async = require('async')
const settings = require('@overleaf/settings')
const { port } = settings.internal.trackchanges
const logger = require('@overleaf/logger')
const LockManager = require('./LockManager')

module.exports = {
  check(callback) {
    const projectId = ObjectId(settings.trackchanges.healthCheck.project_id)
    const url = `http://localhost:${port}/project/${projectId}`
    logger.debug({ projectId }, 'running health check')
    const jobs = [
      cb =>
        request.get(
          { url: `http://localhost:${port}/check_lock`, timeout: 3000 },
          function (err, res, body) {
            if (err != null) {
              logger.err(
                { err, projectId },
                'error checking lock for health check'
              )
              return cb(err)
            } else if ((res != null ? res.statusCode : undefined) !== 200) {
              return cb(
                new Error(`status code not 200, it's ${res.statusCode}`)
              )
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
              logger.err({ err, projectId }, 'error flushing for health check')
              return cb(err)
            } else if ((res != null ? res.statusCode : undefined) !== 204) {
              return cb(
                new Error(`status code not 204, it's ${res.statusCode}`)
              )
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
              logger.err(
                { err, projectId },
                'error getting updates for health check'
              )
              return cb(err)
            } else if ((res != null ? res.statusCode : undefined) !== 200) {
              return cb(
                new Error(`status code not 200, it's ${res.statusCode}`)
              )
            } else {
              return cb()
            }
          }
        ),
    ]
    return async.series(jobs, callback)
  },

  checkLock(callback) {
    return LockManager.healthCheck(callback)
  },
}
