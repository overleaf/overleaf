/* eslint-disable
    camelcase,
    handle-callback-err,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DocumentUpdaterManager
const request = require('request')
const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')

module.exports = DocumentUpdaterManager = {
  getDocument(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error, content, version) {}
    }
    const url = `${Settings.apis.documentupdater.url}/project/${project_id}/doc/${doc_id}`
    logger.log({ project_id, doc_id }, 'getting doc from document updater')
    return request.get(url, function (error, res, body) {
      if (error != null) {
        return callback(error)
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          body = JSON.parse(body)
        } catch (error1) {
          error = error1
          return callback(error)
        }
        logger.log(
          { project_id, doc_id, version: body.version },
          'got doc from document updater'
        )
        return callback(null, body.lines.join('\n'), body.version)
      } else {
        error = new Error(
          `doc updater returned a non-success status code: ${res.statusCode}`
        )
        logger.error(
          { err: error, project_id, doc_id, url },
          'error accessing doc updater'
        )
        return callback(error)
      }
    })
  },

  setDocument(project_id, doc_id, content, user_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const url = `${Settings.apis.documentupdater.url}/project/${project_id}/doc/${doc_id}`
    logger.log({ project_id, doc_id }, 'setting doc in document updater')
    return request.post(
      {
        url,
        json: {
          lines: content.split('\n'),
          source: 'restore',
          user_id,
          undoing: true
        }
      },
      function (error, res, body) {
        if (error != null) {
          return callback(error)
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null)
        } else {
          error = new Error(
            `doc updater returned a non-success status code: ${res.statusCode}`
          )
          logger.error(
            { err: error, project_id, doc_id, url },
            'error accessing doc updater'
          )
          return callback(error)
        }
      }
    )
  }
}
