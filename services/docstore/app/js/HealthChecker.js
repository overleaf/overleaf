/* eslint-disable
    camelcase,
    standard/no-callback-literal,
*/
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
const _ = require('underscore')
const crypto = require('crypto')
const settings = require('settings-sharelatex')
const { port } = settings.internal.docstore
const logger = require('logger-sharelatex')

module.exports = {
  check(callback) {
    const doc_id = ObjectId()
    const project_id = ObjectId(settings.docstore.healthCheck.project_id)
    const url = `http://localhost:${port}/project/${project_id}/doc/${doc_id}`
    const lines = [
      'smoke test - delete me',
      `${crypto.randomBytes(32).toString('hex')}`
    ]
    const getOpts = () => ({
      url,
      timeout: 3000
    })
    logger.log({ lines, url, doc_id, project_id }, 'running health check')
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
            return cb('no response from docstore with get check')
          } else if ((res != null ? res.statusCode : undefined) !== 200) {
            return cb(`status code not 200, its ${res.statusCode}`)
          } else if (
            _.isEqual(body != null ? body.lines : undefined, lines) &&
            (body != null ? body._id : undefined) === doc_id.toString()
          ) {
            return cb()
          } else {
            return cb(`health check lines not equal ${body.lines} != ${lines}`)
          }
        })
      },
      (cb) => db.docs.deleteOne({ _id: doc_id, project_id }, cb),
      (cb) => db.docOps.deleteOne({ doc_id }, cb)
    ]
    return async.series(jobs, callback)
  }
}
