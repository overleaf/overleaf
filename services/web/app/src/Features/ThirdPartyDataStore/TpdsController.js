/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let parseParams
const tpdsUpdateHandler = require('./TpdsUpdateHandler')
const UpdateMerger = require('./UpdateMerger')
const logger = require('logger-sharelatex')
const Path = require('path')
const metrics = require('metrics-sharelatex')

module.exports = {
  // mergeUpdate and deleteUpdate are used by Dropbox, where the project is only passed as the name, as the
  // first part of the file path. They have to check the project exists, find it, and create it if not.
  // They also ignore 'noisy' files like .DS_Store, .gitignore, etc.
  mergeUpdate(req, res) {
    metrics.inc('tpds.merge-update')
    const { filePath, user_id, projectName } = parseParams(req)
    const source = req.headers['x-sl-update-source'] || 'unknown'

    return tpdsUpdateHandler.newUpdate(
      user_id,
      projectName,
      filePath,
      req,
      source,
      function(err) {
        if (err != null) {
          if (err.name === 'TooManyRequestsError') {
            logger.warn(
              { err, user_id, filePath },
              'tpds update failed to be processed, too many requests'
            )
            return res.sendStatus(429)
          } else {
            logger.err(
              { err, user_id, filePath },
              'error reciving update from tpds'
            )
            return res.sendStatus(500)
          }
        } else {
          return res.sendStatus(200)
        }
      }
    )
  },

  deleteUpdate(req, res) {
    metrics.inc('tpds.delete-update')
    const { filePath, user_id, projectName } = parseParams(req)
    const source = req.headers['x-sl-update-source'] || 'unknown'
    return tpdsUpdateHandler.deleteUpdate(
      user_id,
      projectName,
      filePath,
      source,
      function(err) {
        if (err != null) {
          logger.err(
            { err, user_id, filePath },
            'error reciving update from tpds'
          )
          return res.sendStatus(500)
        } else {
          return res.sendStatus(200)
        }
      }
    )
  },

  // updateProjectContents and deleteProjectContents are used by GitHub. The project_id is known so we
  // can skip right ahead to creating/updating/deleting the file. These methods will not ignore noisy
  // files like .DS_Store, .gitignore, etc because people are generally more explicit with the files they
  // want in git.
  updateProjectContents(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const { project_id } = req.params
    const path = `/${req.params[0]}` // UpdateMerger expects leading slash
    const source = req.headers['x-sl-update-source'] || 'unknown'
    return UpdateMerger.mergeUpdate(
      null,
      project_id,
      path,
      req,
      source,
      function(error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(200)
      }
    )
  },

  deleteProjectContents(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const { project_id } = req.params
    const path = `/${req.params[0]}` // UpdateMerger expects leading slash
    const source = req.headers['x-sl-update-source'] || 'unknown'

    return UpdateMerger.deleteUpdate(null, project_id, path, source, function(
      error
    ) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(200)
    })
  },

  parseParams: (parseParams = function(req) {
    let filePath, projectName
    let path = req.params[0]
    const { user_id } = req.params

    path = Path.join('/', path)
    if (path.substring(1).indexOf('/') === -1) {
      filePath = '/'
      projectName = path.substring(1)
    } else {
      filePath = path.substring(path.indexOf('/', 1))
      projectName = path.substring(0, path.indexOf('/', 1))
      projectName = projectName.replace('/', '')
    }

    return { filePath, user_id, projectName }
  })
}
