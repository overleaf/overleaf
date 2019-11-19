let EditorHttpController
const ProjectDeleter = require('../Project/ProjectDeleter')
const logger = require('logger-sharelatex')
const EditorController = require('./EditorController')
const ProjectGetter = require('../Project/ProjectGetter')
const AuthorizationManager = require('../Authorization/AuthorizationManager')
const ProjectEditorHandler = require('../Project/ProjectEditorHandler')
const Metrics = require('metrics-sharelatex')
const CollaboratorsGetter = require('../Collaborators/CollaboratorsGetter')
const CollaboratorsInviteHandler = require('../Collaborators/CollaboratorsInviteHandler')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const TokenAccessHandler = require('../TokenAccess/TokenAccessHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
const Errors = require('../Errors/Errors')

module.exports = EditorHttpController = {
  joinProject(req, res, next) {
    const projectId = req.params.Project_id
    let userId = req.query.user_id
    if (userId === 'anonymous-user') {
      userId = null
    }
    Metrics.inc('editor.join-project')
    EditorHttpController._buildJoinProjectView(req, projectId, userId, function(
      error,
      project,
      privilegeLevel,
      isRestrictedUser
    ) {
      if (error) {
        return next(error)
      }
      if (!project) {
        return res.sendStatus(403)
      }
      // Hide access tokens if this is not the project owner
      TokenAccessHandler.protectTokens(project, privilegeLevel)
      if (isRestrictedUser) {
        project.owner = { _id: project.owner._id }
      }
      res.json({
        project,
        privilegeLevel,
        isRestrictedUser
      })
      // Only show the 'renamed or deleted' message once
      if (project != null ? project.deletedByExternalDataSource : undefined) {
        return ProjectDeleter.unmarkAsDeletedByExternalSource(projectId)
      }
    })
  },

  _buildJoinProjectView(req, projectId, userId, callback) {
    if (callback == null) {
      callback = function() {}
    }
    ProjectGetter.getProjectWithoutDocLines(projectId, function(
      error,
      project
    ) {
      if (error) {
        return callback(error)
      }
      if (project == null) {
        return callback(new Errors.NotFoundError('project not found'))
      }
      CollaboratorsGetter.getInvitedMembersWithPrivilegeLevels(
        projectId,
        function(error, members) {
          if (error) {
            return callback(error)
          }
          const token = TokenAccessHandler.getRequestToken(req, projectId)
          AuthorizationManager.getPrivilegeLevelForProject(
            userId,
            projectId,
            token,
            function(error, privilegeLevel) {
              if (error) {
                return callback(error)
              }
              if (
                privilegeLevel == null ||
                privilegeLevel === PrivilegeLevels.NONE
              ) {
                logger.log(
                  { projectId, userId, privilegeLevel },
                  'not an acceptable privilege level, returning null'
                )
                return callback(null, null, false)
              }
              CollaboratorsInviteHandler.getAllInvites(projectId, function(
                error,
                invites
              ) {
                if (error) {
                  return callback(error)
                }
                CollaboratorsHandler.userIsTokenMember(
                  userId,
                  projectId,
                  (err, isTokenMember) => {
                    if (err) {
                      return callback(err)
                    }
                    const isRestrictedUser = AuthorizationManager.isRestrictedUser(
                      userId,
                      privilegeLevel,
                      isTokenMember
                    )
                    callback(
                      null,
                      ProjectEditorHandler.buildProjectModelView(
                        project,
                        members,
                        invites
                      ),
                      privilegeLevel,
                      isRestrictedUser
                    )
                  }
                )
              })
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
    const projectId = req.params.Project_id
    const { name } = req.body
    const parentFolderId = req.body.parent_folder_id
    const userId = AuthenticationController.getLoggedInUserId(req)

    if (!EditorHttpController._nameIsAcceptableLength(name)) {
      return res.sendStatus(400)
    }
    EditorController.addDoc(
      projectId,
      parentFolderId,
      name,
      [],
      'editor',
      userId,
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
    const projectId = req.params.Project_id
    const { name } = req.body
    const parentFolderId = req.body.parent_folder_id
    if (!EditorHttpController._nameIsAcceptableLength(name)) {
      return res.sendStatus(400)
    }
    EditorController.addFolder(
      projectId,
      parentFolderId,
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
    const projectId = req.params.Project_id
    const entityId = req.params.entity_id
    const entityType = req.params.entity_type
    const { name } = req.body
    if (!EditorHttpController._nameIsAcceptableLength(name)) {
      return res.sendStatus(400)
    }
    const userId = AuthenticationController.getLoggedInUserId(req)
    EditorController.renameEntity(
      projectId,
      entityId,
      entityType,
      name,
      userId,
      function(error) {
        if (error) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  },

  moveEntity(req, res, next) {
    const projectId = req.params.Project_id
    const entityId = req.params.entity_id
    const entityType = req.params.entity_type
    const folderId = req.body.folder_id
    const userId = AuthenticationController.getLoggedInUserId(req)
    EditorController.moveEntity(
      projectId,
      entityId,
      folderId,
      entityType,
      userId,
      function(error) {
        if (error) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  },

  deleteDoc(req, res, next) {
    req.params.entity_type = 'doc'
    EditorHttpController.deleteEntity(req, res, next)
  },

  deleteFile(req, res, next) {
    req.params.entity_type = 'file'
    EditorHttpController.deleteEntity(req, res, next)
  },

  deleteFolder(req, res, next) {
    req.params.entity_type = 'folder'
    EditorHttpController.deleteEntity(req, res, next)
  },

  deleteEntity(req, res, next) {
    const projectId = req.params.Project_id
    const entityId = req.params.entity_id
    const entityType = req.params.entity_type
    const userId = AuthenticationController.getLoggedInUserId(req)
    EditorController.deleteEntity(
      projectId,
      entityId,
      entityType,
      'editor',
      userId,
      function(error) {
        if (error) {
          return next(error)
        }
        res.sendStatus(204)
      }
    )
  }
}
