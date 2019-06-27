/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { promisify } = require('util')
const { Project } = require('../../models/Project')
const { DeletedProject } = require('../../models/DeletedProject')
const logger = require('logger-sharelatex')
const documentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const tagsHandler = require('../Tags/TagsHandler')
const async = require('async')
const FileStoreHandler = require('../FileStore/FileStoreHandler')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')

const ProjectDeleter = {
  markAsDeletedByExternalSource(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log(
      { project_id },
      'marking project as deleted by external data source'
    )
    const conditions = { _id: project_id }
    const update = { deletedByExternalDataSource: true }

    return Project.update(conditions, update, {}, err =>
      require('../Editor/EditorController').notifyUsersProjectHasBeenDeletedOrRenamed(
        project_id,
        () => callback()
      )
    )
  },

  unmarkAsDeletedByExternalSource(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log(
      { project_id },
      'removing flag marking project as deleted by external data source'
    )
    const conditions = { _id: project_id.toString() }
    const update = { deletedByExternalDataSource: false }
    return Project.update(conditions, update, {}, callback)
  },

  deleteUsersProjects(user_id, callback) {
    logger.log({ user_id }, 'deleting users projects')

    return Project.find({ owner_ref: user_id }, function(error, projects) {
      if (error != null) {
        return callback(error)
      }
      return async.each(
        projects,
        (project, cb) => ProjectDeleter.deleteProject(project._id, cb),
        function(err) {
          if (err != null) {
            return callback(err)
          }
          return CollaboratorsHandler.removeUserFromAllProjets(
            user_id,
            callback
          )
        }
      )
    })
  },

  deleteProject(project_id, options, callback) {
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function(error) {}
    }
    const data = {}
    logger.log({ project_id }, 'deleting project')

    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    return async.waterfall(
      [
        cb =>
          Project.findOne({ _id: project_id }, (err, project) =>
            cb(err, project)
          ),
        function(project, cb) {
          const deletedProject = new DeletedProject()
          deletedProject.project = project
          deletedProject.deleterData = {
            deletedAt: new Date(),
            deleterId:
              options.deleterUser != null ? options.deleterUser._id : undefined,
            deleterIpAddress: options.ipAddress
          }

          if (project == null) {
            return callback(new Errors.NotFoundError('project not found'))
          }

          return deletedProject.save(err => cb(err, deletedProject))
        },
        (deletedProject, cb) =>
          documentUpdaterHandler.flushProjectToMongoAndDelete(project_id, err =>
            cb(err, deletedProject)
          ),
        function(deletedProject, cb) {
          CollaboratorsHandler.getMemberIds(project_id, function(
            error,
            member_ids
          ) {
            if (member_ids == null) {
              member_ids = []
            }
            return Array.from(member_ids).map(member_id =>
              tagsHandler.removeProjectFromAllTags(
                member_id,
                project_id,
                function(err) {}
              )
            )
          })
          return cb(null, deletedProject)
        }, // doesn't matter if this fails or the order it happens in
        (deletedProject, cb) =>
          Project.remove({ _id: project_id }, err => cb(err, deletedProject))
      ],
      function(err, deletedProject) {
        if (err != null) {
          logger.err({ err }, 'problem deleting project')
          return callback(err)
        }
        logger.log(
          { project_id },
          'successfully deleting project from user request'
        )
        return callback(null, deletedProject)
      }
    )
  },

  archiveProject(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log({ project_id }, 'archived project from user request')
    return Project.update(
      { _id: project_id },
      { $set: { archived: true } },
      function(err) {
        if (err != null) {
          logger.err({ err }, 'problem archived project')
          return callback(err)
        }
        logger.log(
          { project_id },
          'successfully archived project from user request'
        )
        return callback()
      }
    )
  },

  restoreProject(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return Project.update(
      { _id: project_id },
      { $unset: { archived: true } },
      callback
    )
  }
}

const promises = {
  deleteProject: promisify(ProjectDeleter.deleteProject)
}

ProjectDeleter.promises = promises

module.exports = ProjectDeleter
