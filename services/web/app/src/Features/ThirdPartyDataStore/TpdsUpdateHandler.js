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
const updateMerger = require('./UpdateMerger')
const logger = require('logger-sharelatex')
const projectLocator = require('../Project/ProjectLocator')
const projectCreationHandler = require('../Project/ProjectCreationHandler')
const projectDeleter = require('../Project/ProjectDeleter')
const ProjectRootDocManager = require('../Project/ProjectRootDocManager')
const FileTypeManager = require('../Uploads/FileTypeManager')
const CooldownManager = require('../Cooldown/CooldownManager')
const Errors = require('../Errors/Errors')

const commitMessage = 'Before update from Dropbox'

module.exports = {
  newUpdate(user_id, projectName, path, updateRequest, source, callback) {
    const getOrCreateProject = cb => {
      return projectLocator.findUsersProjectByName(
        user_id,
        projectName,
        (err, project) => {
          logger.log(
            { user_id, filePath: path, projectName },
            'handling new update from tpds'
          )
          if (project == null) {
            return projectCreationHandler.createBlankProject(
              user_id,
              projectName,
              (err, project) => {
                // have a crack at setting the root doc after a while, on creation we won't have it yet, but should have
                // been sent it it within 30 seconds
                setTimeout(
                  () =>
                    ProjectRootDocManager.setRootDocAutomatically(project._id),
                  this._rootDocTimeoutLength
                )
                return cb(err, project)
              }
            )
          } else {
            return cb(err, project)
          }
        }
      )
    }
    return getOrCreateProject(function(err, project) {
      if (err != null) {
        return callback(err)
      }
      return CooldownManager.isProjectOnCooldown(project._id, function(
        err,
        projectIsOnCooldown
      ) {
        if (err != null) {
          return callback(err)
        }
        if (projectIsOnCooldown) {
          logger.log(
            { projectId: project._id },
            'project is on cooldown, denying request'
          )
          return callback(
            new Errors.TooManyRequestsError('project on cooldown')
          )
        }
        return FileTypeManager.shouldIgnore(path, function(err, shouldIgnore) {
          if (shouldIgnore) {
            return callback()
          }
          return updateMerger.mergeUpdate(
            user_id,
            project._id,
            path,
            updateRequest,
            source,
            callback
          )
        })
      })
    })
  },

  deleteUpdate(user_id, projectName, path, source, callback) {
    logger.log({ user_id, filePath: path }, 'handling delete update from tpds')
    return projectLocator.findUsersProjectByName(user_id, projectName, function(
      err,
      project
    ) {
      if (project == null) {
        logger.log(
          { user_id, filePath: path, projectName },
          'project not found from tpds update, ignoring folder or project'
        )
        return callback()
      }
      if (path === '/') {
        logger.log(
          { user_id, filePath: path, projectName, project_id: project._id },
          'project found for delete update, path is root so marking project as deleted'
        )
        return projectDeleter.markAsDeletedByExternalSource(
          project._id,
          callback
        )
      } else {
        return updateMerger.deleteUpdate(
          user_id,
          project._id,
          path,
          source,
          err => callback(err)
        )
      }
    })
  },

  _rootDocTimeoutLength: 30 * 1000
}
