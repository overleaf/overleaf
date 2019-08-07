const async = require('async')
const CollaboratorsHandler = require('./CollaboratorsHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
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
        if (error) {
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
    const userId = AuthenticationController.getLoggedInUserId(req)
    CollaboratorsController._removeUserIdFromProject(
      projectId,
      userId,
      function(error) {
        if (error) {
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
        if (error) {
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
      if (err) {
        logger.warn({ projectId }, 'error getting members for project')
        return next(err)
      }
      res.json({ members })
    })
  }
}

module.exports = CollaboratorsController
