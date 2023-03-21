/* eslint-disable
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
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const Errors = require('./Errors')

module.exports = DocumentUpdaterManager = {
  _requestDocument(projectId, docId, url, callback) {
    if (callback == null) {
      callback = function () {}
    }

    logger.debug({ projectId, docId }, 'getting doc from document updater')
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
        logger.debug(
          { projectId, docId, version: body.version },
          'got doc from document updater'
        )
        return callback(null, body.lines.join('\n'), body.version)
      } else {
        error = new Error(
          `doc updater returned a non-success status code: ${res.statusCode}`
        )
        logger.error(
          { err: error, projectId, docId, url },
          'error accessing doc updater'
        )
        if (res.statusCode === 404) {
          return callback(
            new Errors.NotFoundError('doc not found', {
              projectId,
              docId,
            })
          )
        } else {
          return callback(error)
        }
      }
    })
  },

  getDocument(projectId, docId, callback) {
    const url = `${Settings.apis.documentupdater.url}/project/${projectId}/doc/${docId}`
    DocumentUpdaterManager._requestDocument(projectId, docId, url, callback)
  },

  peekDocument(projectId, docId, callback) {
    const url = `${Settings.apis.documentupdater.url}/project/${projectId}/doc/${docId}/peek`
    DocumentUpdaterManager._requestDocument(projectId, docId, url, callback)
  },

  setDocument(projectId, docId, content, userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const url = `${Settings.apis.documentupdater.url}/project/${projectId}/doc/${docId}`
    logger.debug({ projectId, docId }, 'setting doc in document updater')
    return request.post(
      {
        url,
        json: {
          lines: content.split('\n'),
          source: 'restore',
          user_id: userId,
          undoing: true,
        },
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
            { err: error, projectId, docId, url },
            'error accessing doc updater'
          )
          return callback(error)
        }
      }
    )
  },
}

module.exports.promises = {
  // peekDocument returns two arguments so we can't use util.promisify, which only handles a single argument, we need
  // to treat this it as a special case.
  peekDocument: (projectId, docId) => {
    return new Promise((resolve, reject) => {
      DocumentUpdaterManager.peekDocument(
        projectId,
        docId,
        (err, content, version) => {
          if (err) {
            reject(err)
          } else {
            resolve([content, version])
          }
        }
      )
    })
  },
}
