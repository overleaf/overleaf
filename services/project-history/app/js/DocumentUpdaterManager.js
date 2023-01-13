/* eslint-disable
    camelcase,
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
import request from 'request'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import OError from '@overleaf/o-error'

export function getDocument(project_id, doc_id, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const url = `${Settings.apis.documentupdater.url}/project/${project_id}/doc/${doc_id}`
  logger.debug({ project_id, doc_id }, 'getting doc from document updater')
  return request.get(url, function (error, res, body) {
    if (error != null) {
      return callback(OError.tag(error))
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        body = JSON.parse(body)
      } catch (error1) {
        error = error1
        return callback(error)
      }
      logger.debug(
        { project_id, doc_id, version: body.version },
        'got doc from document updater'
      )
      return callback(null, body.lines.join('\n'), body.version)
    } else {
      error = new OError(
        `doc updater returned a non-success status code: ${res.statusCode}`,
        { project_id, doc_id, url }
      )
      return callback(error)
    }
  })
}

export function setDocument(project_id, doc_id, content, user_id, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const url = `${Settings.apis.documentupdater.url}/project/${project_id}/doc/${doc_id}`
  logger.debug({ project_id, doc_id }, 'setting doc in document updater')
  return request.post(
    {
      url,
      json: {
        lines: content.split('\n'),
        source: 'restore',
        user_id,
        undoing: true,
      },
    },
    function (error, res, body) {
      if (error != null) {
        return callback(OError.tag(error))
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return callback(null)
      } else {
        error = new OError(
          `doc updater returned a non-success status code: ${res.statusCode}`,
          { project_id, doc_id, url }
        )
        return callback(error)
      }
    }
  )
}
