/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let CollaboratorsController
const ProjectGetter = require('../Project/ProjectGetter')
const CollaboratorsHandler = require('./CollaboratorsHandler')
const ProjectEditorHandler = require('../Project/ProjectEditorHandler')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const LimitationsManager = require('../Subscription/LimitationsManager')
const UserGetter = require('../User/UserGetter')
const EmailHelper = require('../Helpers/EmailHelper')
const logger = require('logger-sharelatex')

module.exports = CollaboratorsController = {
  removeUserFromProject(req, res, next) {
    const project_id = req.params.Project_id
    const { user_id } = req.params
    return CollaboratorsController._removeUserIdFromProject(
      project_id,
      user_id,
      function(error) {
        if (error != null) {
          return next(error)
        }
        EditorRealTimeController.emitToRoom(
          project_id,
          'project:membership:changed',
          { members: true }
        )
        return res.sendStatus(204)
      }
    )
  },

  removeSelfFromProject(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const project_id = req.params.Project_id
    const user_id = __guard__(
      req.session != null ? req.session.user : undefined,
      x => x._id
    )
    return CollaboratorsController._removeUserIdFromProject(
      project_id,
      user_id,
      function(error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  },

  _removeUserIdFromProject(project_id, user_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return CollaboratorsHandler.removeUserFromProject(
      project_id,
      user_id,
      function(error) {
        if (error != null) {
          return callback(error)
        }
        EditorRealTimeController.emitToRoom(
          project_id,
          'userRemovedFromProject',
          user_id
        )
        return callback()
      }
    )
  },

  getAllMembers(req, res, next) {
    const projectId = req.params.Project_id
    logger.log({ projectId }, 'getting all active members for project')
    return CollaboratorsHandler.getAllInvitedMembers(projectId, function(
      err,
      members
    ) {
      if (err != null) {
        logger.err({ projectId }, 'error getting members for project')
        return next(err)
      }
      return res.json({ members })
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
