// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { db, ObjectId } = require('./mongodb')
const request = require('request')
const async = require('async')
const _ = require('lodash')
const crypto = require('node:crypto')
const settings = require('@overleaf/settings')
const { port } = settings.internal.docstore
const logger = require('@overleaf/logger')

module.exports = {
  check(callback) {
    const docId = new ObjectId()
    const projectId = new ObjectId(settings.docstore.healthCheck.project_id)
    const url = `http://127.0.0.1:${port}/project/${projectId}/doc/${docId}`
    const lines = [
      'smoke test - delete me',
      `${crypto.randomBytes(32).toString('hex')}`,
    ]
    const getOpts = () => ({
      url,
      timeout: 3000,
    })
    logger.debug({ lines, url, docId, projectId }, 'running health check')
    const jobs = [
      function (cb) {
        const opts = getOpts()
        opts.json = { lines, version: 42, ranges: {} }
        return request.post(opts, cb)
      },
      function (cb) {
        const opts = getOpts()
        opts.json = true
        return request.get(opts, function (err, res, body) {
          if (err != null) {
            logger.err({ err }, 'docstore returned a error in health check get')
            return cb(err)
          } else if (res == null) {
            return cb(new Error('no response from docstore with get check'))
          } else if ((res != null ? res.statusCode : undefined) !== 200) {
            return cb(new Error(`status code not 200, its ${res.statusCode}`))
          } else if (
            _.isEqual(body != null ? body.lines : undefined, lines) &&
            (body != null ? body._id : undefined) === docId.toString()
          ) {
            return cb()
          } else {
            return cb(
              new Error(
                `health check lines not equal ${body.lines} != ${lines}`
              )
            )
          }
        })
      },
      cb => db.docs.deleteOne({ _id: docId, project_id: projectId }, cb),
    ]
    return async.series(jobs, callback)
  },
}
