const UpdateMerger = require('./UpdateMerger')
const logger = require('logger-sharelatex')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const ProjectCreationHandler = require('../Project/ProjectCreationHandler')
const ProjectDeleter = require('../Project/ProjectDeleter')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectHelper = require('../Project/ProjectHelper')
const ProjectRootDocManager = require('../Project/ProjectRootDocManager')
const FileTypeManager = require('../Uploads/FileTypeManager')
const CooldownManager = require('../Cooldown/CooldownManager')
const Errors = require('../Errors/Errors')
const Modules = require('../../infrastructure/Modules')

const ROOT_DOC_TIMEOUT_LENGTH = 30 * 1000

function newUpdate(userId, projectName, path, updateRequest, source, callback) {
  getOrCreateProject(userId, projectName, (err, project) => {
    if (err) {
      return callback(err)
    }
    if (project == null) {
      return callback()
    }
    CooldownManager.isProjectOnCooldown(
      project._id,
      (err, projectIsOnCooldown) => {
        if (err) {
          return callback(err)
        }
        if (projectIsOnCooldown) {
          return callback(
            new Errors.TooManyRequestsError('project on cooldown')
          )
        }
        FileTypeManager.shouldIgnore(path, (err, shouldIgnore) => {
          if (err) {
            return callback(err)
          }
          if (shouldIgnore) {
            return callback()
          }
          UpdateMerger.mergeUpdate(
            userId,
            project._id,
            path,
            updateRequest,
            source,
            callback
          )
        })
      }
    )
  })
}

function deleteUpdate(userId, projectName, path, source, callback) {
  logger.debug({ userId, filePath: path }, 'handling delete update from tpds')
  ProjectGetter.findUsersProjectsByName(
    userId,
    projectName,
    (err, projects) => {
      if (err) {
        return callback(err)
      }
      const activeProjects = projects.filter(
        project => !ProjectHelper.isArchivedOrTrashed(project, userId)
      )
      if (activeProjects.length === 0) {
        logger.debug(
          { userId, filePath: path, projectName },
          'project not found from tpds update, ignoring folder or project'
        )
        return callback()
      }
      if (projects.length > 1) {
        // There is more than one project with that name, and one of them is
        // active (previous condition)
        return handleDuplicateProjects(userId, projectName, callback)
      }

      const project = activeProjects[0]
      if (path === '/') {
        logger.debug(
          { userId, filePath: path, projectName, project_id: project._id },
          'project found for delete update, path is root so marking project as deleted'
        )
        ProjectDeleter.markAsDeletedByExternalSource(project._id, callback)
      } else {
        UpdateMerger.deleteUpdate(userId, project._id, path, source, err => {
          callback(err)
        })
      }
    }
  )
}

function getOrCreateProject(userId, projectName, callback) {
  ProjectGetter.findUsersProjectsByName(
    userId,
    projectName,
    (err, projects) => {
      if (err) {
        return callback(err)
      }

      if (projects.length === 0) {
        // No project with that name -- active, archived or trashed -- has been
        // found. Create one.
        return ProjectCreationHandler.createBlankProject(
          userId,
          projectName,
          (err, project) => {
            // have a crack at setting the root doc after a while, on creation
            // we won't have it yet, but should have been sent it it within 30
            // seconds
            setTimeout(() => {
              ProjectRootDocManager.setRootDocAutomatically(project._id)
            }, ROOT_DOC_TIMEOUT_LENGTH)
            callback(err, project)
          }
        )
      }
      const activeProjects = projects.filter(
        project => !ProjectHelper.isArchivedOrTrashed(project, userId)
      )
      if (activeProjects.length === 0) {
        // All projects with that name are archived or trashed. Ignore.
        return callback(null, null)
      }

      if (projects.length > 1) {
        // There is more than one project with that name, and one of them is
        // active (previous condition)
        return handleDuplicateProjects(userId, projectName, err => {
          if (err) {
            return callback(err)
          }
          callback(null, null)
        })
      }

      callback(err, activeProjects[0])
    }
  )
}

function handleDuplicateProjects(userId, projectName, callback) {
  Modules.hooks.fire('removeDropbox', userId, 'duplicate-projects', err => {
    if (err) {
      return callback(err)
    }
    NotificationsBuilder.dropboxDuplicateProjectNames(userId).create(
      projectName,
      callback
    )
  })
}

module.exports = {
  newUpdate,
  deleteUpdate,
}
