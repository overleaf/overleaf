let parseParams

const TpdsUpdateHandler = require('./TpdsUpdateHandler')
const UpdateMerger = require('./UpdateMerger')
const Errors = require('../Errors/Errors')
const logger = require('@overleaf/logger')
const Path = require('path')
const metrics = require('@overleaf/metrics')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const SessionManager = require('../Authentication/SessionManager')
const TpdsQueueManager = require('./TpdsQueueManager').promises

module.exports = {
  // mergeUpdate and deleteUpdate are used by Dropbox, where the project is only passed as the name, as the
  // first part of the file path. They have to check the project exists, find it, and create it if not.
  // They also ignore 'noisy' files like .DS_Store, .gitignore, etc.
  mergeUpdate(req, res) {
    metrics.inc('tpds.merge-update')
    const { filePath, userId, projectName } = parseParams(req)
    const source = req.headers['x-sl-update-source'] || 'unknown'

    TpdsUpdateHandler.newUpdate(
      userId,
      projectName,
      filePath,
      req,
      source,
      err => {
        if (err) {
          if (err.name === 'TooManyRequestsError') {
            logger.warn(
              { err, userId, filePath },
              'tpds update failed to be processed, too many requests'
            )
            res.sendStatus(429)
          } else if (err.message === 'project_has_too_many_files') {
            logger.warn(
              { err, userId, filePath },
              'tpds trying to append to project over file limit'
            )
            NotificationsBuilder.tpdsFileLimit(userId).create(projectName)
            res.sendStatus(400)
          } else {
            logger.err(
              { err, userId, filePath },
              'error receiving update from tpds'
            )
            res.sendStatus(500)
          }
        } else {
          res.sendStatus(200)
        }
      }
    )
  },

  deleteUpdate(req, res) {
    metrics.inc('tpds.delete-update')
    const { filePath, userId, projectName } = parseParams(req)
    const source = req.headers['x-sl-update-source'] || 'unknown'
    TpdsUpdateHandler.deleteUpdate(
      userId,
      projectName,
      filePath,
      source,
      err => {
        if (err) {
          logger.err(
            { err, userId, filePath },
            'error receiving update from tpds'
          )
          res.sendStatus(500)
        } else {
          res.sendStatus(200)
        }
      }
    )
  },

  // updateProjectContents and deleteProjectContents are used by GitHub. The project_id is known so we
  // can skip right ahead to creating/updating/deleting the file. These methods will not ignore noisy
  // files like .DS_Store, .gitignore, etc because people are generally more explicit with the files they
  // want in git.
  updateProjectContents(req, res, next) {
    const projectId = req.params.project_id
    const path = `/${req.params[0]}` // UpdateMerger expects leading slash
    const source = req.headers['x-sl-update-source'] || 'unknown'
    UpdateMerger.mergeUpdate(null, projectId, path, req, source, error => {
      if (error) {
        if (error.constructor === Errors.InvalidNameError) {
          return res.sendStatus(422)
        } else {
          return next(error)
        }
      }
      res.sendStatus(200)
    })
  },

  deleteProjectContents(req, res, next) {
    const projectId = req.params.project_id
    const path = `/${req.params[0]}` // UpdateMerger expects leading slash
    const source = req.headers['x-sl-update-source'] || 'unknown'

    UpdateMerger.deleteUpdate(null, projectId, path, source, error => {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    })
  },

  async getQueues(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    try {
      res.json(await TpdsQueueManager.getQueues(userId))
    } catch (err) {
      next(err)
    }
  },

  parseParams: (parseParams = function (req) {
    let filePath, projectName
    let path = req.params[0]
    const userId = req.params.user_id

    path = Path.join('/', path)
    if (path.substring(1).indexOf('/') === -1) {
      filePath = '/'
      projectName = path.substring(1)
    } else {
      filePath = path.substring(path.indexOf('/', 1))
      projectName = path.substring(0, path.indexOf('/', 1))
      projectName = projectName.replace('/', '')
    }

    return { filePath, userId, projectName }
  }),
}
