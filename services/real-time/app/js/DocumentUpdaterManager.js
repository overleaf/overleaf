/* eslint-disable
    camelcase,
*/
const request = require('request')
const _ = require('underscore')
const OError = require('@overleaf/o-error')
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')
const metrics = require('metrics-sharelatex')

const rclient = require('redis-sharelatex').createClient(
  settings.redis.documentupdater
)
const Keys = settings.redis.documentupdater.key_schema

const DocumentUpdaterManager = {
  getDocument(project_id, doc_id, fromVersion, callback) {
    const timer = new metrics.Timer('get-document')
    const url = `${settings.apis.documentupdater.url}/project/${project_id}/doc/${doc_id}?fromVersion=${fromVersion}`
    logger.log(
      { project_id, doc_id, fromVersion },
      'getting doc from document updater'
    )
    request.get(url, function (err, res, body) {
      timer.done()
      if (err) {
        OError.tag(err, 'error getting doc from doc updater')
        return callback(err)
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logger.log(
          { project_id, doc_id },
          'got doc from document document updater'
        )
        try {
          body = JSON.parse(body)
        } catch (error) {
          OError.tag(error, 'error parsing doc updater response')
          return callback(error)
        }
        body = body || {}
        callback(null, body.lines, body.version, body.ranges, body.ops)
      } else if ([404, 422].includes(res.statusCode)) {
        err = new Error('doc updater could not load requested ops')
        err.statusCode = res.statusCode
        logger.warn(
          { err, project_id, doc_id, url, fromVersion },
          'doc updater could not load requested ops'
        )
        callback(err)
      } else {
        err = new Error(
          `doc updater returned a non-success status code: ${res.statusCode}`
        )
        err.statusCode = res.statusCode
        logger.error(
          { err, project_id, doc_id, url },
          `doc updater returned a non-success status code: ${res.statusCode}`
        )
        callback(err)
      }
    })
  },

  checkDocument(project_id, doc_id, callback) {
    // in this call fromVersion = -1 means get document without docOps
    DocumentUpdaterManager.getDocument(project_id, doc_id, -1, callback)
  },

  flushProjectToMongoAndDelete(project_id, callback) {
    // this method is called when the last connected user leaves the project
    logger.log({ project_id }, 'deleting project from document updater')
    const timer = new metrics.Timer('delete.mongo.project')
    // flush the project in the background when all users have left
    const url =
      `${settings.apis.documentupdater.url}/project/${project_id}?background=true` +
      (settings.shutDownInProgress ? '&shutdown=true' : '')
    request.del(url, function (err, res) {
      timer.done()
      if (err) {
        OError.tag(err, 'error deleting project from document updater')
        callback(err)
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        logger.log({ project_id }, 'deleted project from document updater')
        callback(null)
      } else {
        err = new Error(
          `document updater returned a failure status code: ${res.statusCode}`
        )
        err.statusCode = res.statusCode
        logger.error(
          { err, project_id },
          `document updater returned failure status code: ${res.statusCode}`
        )
        callback(err)
      }
    })
  },

  queueChange(project_id, doc_id, change, callback) {
    const allowedKeys = [
      'doc',
      'op',
      'v',
      'dupIfSource',
      'meta',
      'lastV',
      'hash'
    ]
    change = _.pick(change, allowedKeys)
    const jsonChange = JSON.stringify(change)
    if (jsonChange.indexOf('\u0000') !== -1) {
      // memory corruption check
      const error = new Error('null bytes found in op')
      logger.error(
        { err: error, project_id, doc_id, jsonChange },
        error.message
      )
      return callback(error)
    }

    const updateSize = jsonChange.length
    if (updateSize > settings.maxUpdateSize) {
      const error = new Error('update is too large')
      error.updateSize = updateSize
      return callback(error)
    }

    // record metric for each update added to queue
    metrics.summary('redis.pendingUpdates', updateSize, { status: 'push' })

    const doc_key = `${project_id}:${doc_id}`
    // Push onto pendingUpdates for doc_id first, because once the doc updater
    // gets an entry on pending-updates-list, it starts processing.
    rclient.rpush(Keys.pendingUpdates({ doc_id }), jsonChange, function (
      error
    ) {
      if (error) {
        OError.tag(error, 'error pushing update into redis')
        return callback(error)
      }
      rclient.rpush('pending-updates-list', doc_key, function (error) {
        if (error) {
          OError.tag(error, 'error pushing doc_id into redis')
        }
        callback(error)
      })
    })
  }
}

module.exports = DocumentUpdaterManager
