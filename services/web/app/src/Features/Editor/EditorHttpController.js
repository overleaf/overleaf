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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let EditorHttpController
const ProjectEntityUpdateHandler = require('../Project/ProjectEntityUpdateHandler')
const ProjectDeleter = require('../Project/ProjectDeleter')
const logger = require('logger-sharelatex')
const EditorRealTimeController = require('./EditorRealTimeController')
const EditorController = require('./EditorController')
const ProjectGetter = require('../Project/ProjectGetter')
const UserGetter = require('../User/UserGetter')
const AuthorizationManager = require('../Authorization/AuthorizationManager')
const ProjectEditorHandler = require('../Project/ProjectEditorHandler')
const Metrics = require('metrics-sharelatex')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const CollaboratorsInviteHandler = require('../Collaborators/CollaboratorsInviteHandler')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const TokenAccessHandler = require('../TokenAccess/TokenAccessHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
const Errors = require('../Errors/Errors')

module.exports = EditorHttpController = {
  joinProject(req, res, next) {
    const project_id = req.params.Project_id
    let { user_id } = req.query
    if (user_id === 'anonymous-user') {
      user_id = null
    }
    logger.log({ user_id, project_id }, 'join project request')
    Metrics.inc('editor.join-project')
    return EditorHttpController._buildJoinProjectView(
      req,
      project_id,
      user_id,
      function(error, project, privilegeLevel) {
        if (error != null) {
          return next(error)
        }
        // Hide access tokens if this is not the project owner
        TokenAccessHandler.protectTokens(project, privilegeLevel)
        res.json({
          project,
          privilegeLevel
        })
        // Only show the 'renamed or deleted' message once
        if (project != null ? project.deletedByExternalDataSource : undefined) {
          return ProjectDeleter.unmarkAsDeletedByExternalSource(project_id)
        }
      }
    )
  },

  _buildJoinProjectView(req, project_id, user_id, callback) {
    if (callback == null) {
      callback = function(error, project, privilegeLevel) {}
    }
    logger.log({ project_id, user_id }, 'building the joinProject view')
    return ProjectGetter.getProjectWithoutDocLines(project_id, function(
      error,
      project
    ) {
      if (error != null) {
        return callback(error)
      }
      if (project == null) {
        return callback(new Errors.NotFoundError('project not found'))
      }
      return CollaboratorsHandler.getInvitedMembersWithPrivilegeLevels(
        project_id,
        function(error, members) {
          if (error != null) {
            return callback(error)
          }
          const token = TokenAccessHandler.getRequestToken(req, project_id)
          return AuthorizationManager.getPrivilegeLevelForProject(
            user_id,
            project_id,
            token,
            function(error, privilegeLevel) {
              if (error != null) {
                return callback(error)
              }
              if (
                privilegeLevel == null ||
                privilegeLevel === PrivilegeLevels.NONE
              ) {
                logger.log(
                  { project_id, user_id, privilegeLevel },
                  'not an acceptable privilege level, returning null'
                )
                return callback(null, null, false)
              }
              return CollaboratorsInviteHandler.getAllInvites(
                project_id,
                function(error, invites) {
                  if (error != null) {
                    return callback(error)
                  }
                  logger.log(
                    {
                      project_id,
                      user_id,
                      memberCount: members.length,
                      inviteCount: invites.length,
                      privilegeLevel
                    },
                    'returning project model view'
                  )
                  return callback(
                    null,
                    ProjectEditorHandler.buildProjectModelView(
                      project,
                      members,
                      invites
                    ),
                    privilegeLevel
                  )
                }
              )
            }
          )
        }
      )
    })
  },

  _nameIsAcceptableLength(name) {
    return name != null && name.length < 150 && name.length !== 0
  },

  addDoc(req, res, next) {
    const project_id = req.params.Project_id
    const { name } = req.body
    const { parent_folder_id } = req.body
    const user_id = AuthenticationController.getLoggedInUserId(req)
    logger.log(
      { project_id, name, parent_folder_id },
      'getting request to add doc to project'
    )
    if (!EditorHttpController._nameIsAcceptableLength(name)) {
      return res.sendStatus(400)
    }
    return EditorController.addDoc(
      project_id,
      parent_folder_id,
      name,
      [],
      'editor',
      user_id,
      function(error, doc) {
        if (error && error.message === 'project_has_to_many_files') {
          return res
            .status(400)
            .json(req.i18n.translate('project_has_to_many_files'))
        } else if (error) {
          return next(error)
        } else {
          return res.json(doc)
        }
      }
    )
  },

  addFolder(req, res, next) {
    const project_id = req.params.Project_id
    const { name } = req.body
    const { parent_folder_id } = req.body
    if (!EditorHttpController._nameIsAcceptableLength(name)) {
      return res.sendStatus(400)
    }
    return EditorController.addFolder(
      project_id,
      parent_folder_id,
      name,
      'editor',
      function(error, doc) {
        if (error && error.message === 'project_has_to_many_files') {
          return res
            .status(400)
            .json(req.i18n.translate('project_has_to_many_files'))
        } else if (error && error.message === 'invalid element name') {
          return res.status(400).json(req.i18n.translate('invalid_file_name'))
        } else if (error) {
          return next(error)
        } else {
          return res.json(doc)
        }
      }
    )
  },

  renameEntity(req, res, next) {
    const project_id = req.params.Project_id
    const { entity_id } = req.params
    const { entity_type } = req.params
    const { name } = req.body
    if (!EditorHttpController._nameIsAcceptableLength(name)) {
      return res.sendStatus(400)
    }
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return EditorController.renameEntity(
      project_id,
      entity_id,
      entity_type,
      name,
      user_id,
      function(error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  },

  moveEntity(req, res, next) {
    const project_id = req.params.Project_id
    const { entity_id } = req.params
    const { entity_type } = req.params
    const { folder_id } = req.body
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return EditorController.moveEntity(
      project_id,
      entity_id,
      folder_id,
      entity_type,
      user_id,
      function(error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  },

  deleteDoc(req, res, next) {
    req.params.entity_type = 'doc'
    return EditorHttpController.deleteEntity(req, res, next)
  },

  deleteFile(req, res, next) {
    req.params.entity_type = 'file'
    return EditorHttpController.deleteEntity(req, res, next)
  },

  deleteFolder(req, res, next) {
    req.params.entity_type = 'folder'
    return EditorHttpController.deleteEntity(req, res, next)
  },

  deleteEntity(req, res, next) {
    const project_id = req.params.Project_id
    const { entity_id } = req.params
    const { entity_type } = req.params
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return EditorController.deleteEntity(
      project_id,
      entity_id,
      entity_type,
      'editor',
      user_id,
      function(error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  }
}
