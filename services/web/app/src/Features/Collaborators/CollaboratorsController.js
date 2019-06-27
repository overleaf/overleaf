// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const async = require('async')
const CollaboratorsHandler = require('./CollaboratorsHandler')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const TagsHandler = require('../Tags/TagsHandler')
const logger = require('logger-sharelatex')

const CollaboratorsController = {
  removeUserFromProject(req, res, next) {
    const projectId = req.params.Project_id
    const userId = req.params.user_id
    CollaboratorsController._removeUserIdFromProject(
      projectId,
      userId,
      function(error) {
        if (error != null) {
          return next(error)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'project:membership:changed',
          { members: true }
        )
        res.sendStatus(204)
      }
    )
  },

  removeSelfFromProject(req, res, next) {
    const projectId = req.params.Project_id
    const userId = req.session.user ? req.session.user._id : undefined
    CollaboratorsController._removeUserIdFromProject(
      projectId,
      userId,
      function(error) {
        if (error != null) {
          return next(error)
        }
        res.sendStatus(204)
      }
    )
  },

  _removeUserIdFromProject(projectId, userId, callback) {
    async.series(
      [
        cb => {
          CollaboratorsHandler.removeUserFromProject(projectId, userId, cb)
        },
        cb => {
          EditorRealTimeController.emitToRoom(
            projectId,
            'userRemovedFromProject',
            userId
          )
          cb()
        },
        cb => {
          TagsHandler.removeProjectFromAllTags(userId, projectId, cb)
        }
      ],
      function(error) {
        if (error != null) {
          return callback(error)
        }
        callback()
      }
    )
  },

  getAllMembers(req, res, next) {
    const projectId = req.params.Project_id
    logger.log({ projectId }, 'getting all active members for project')
    CollaboratorsHandler.getAllInvitedMembers(projectId, function(
      err,
      members
    ) {
      if (err != null) {
        logger.err({ projectId }, 'error getting members for project')
        return next(err)
      }
      res.json({ members })
    })
  }
}

module.exports = CollaboratorsController
