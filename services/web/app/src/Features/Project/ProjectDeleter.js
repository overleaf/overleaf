/* eslint-disable
    camelcase,
    handle-callback-err,
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
const { db } = require('../../infrastructure/mongojs')
const { promisify, callbackify } = require('util')
const { Project } = require('../../models/Project')
const { DeletedProject } = require('../../models/DeletedProject')
const Errors = require('../Errors/Errors')
const logger = require('logger-sharelatex')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const TagsHandler = require('../Tags/TagsHandler')
const async = require('async')
const ProjectDetailsHandler = require('./ProjectDetailsHandler')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const DocstoreManager = require('../Docstore/DocstoreManager')
const moment = require('moment')

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
    const conditions = { _id: project_id }
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

  expireDeletedProjectsAfterDuration(callback) {
    const DURATION = 90
    DeletedProject.find(
      {
        'deleterData.deletedAt': {
          $lt: new Date(moment().subtract(DURATION, 'days'))
        },
        project: {
          $ne: null
        }
      },
      function(err, deletedProjects) {
        if (err != null) {
          logger.err({ err }, 'Problem with finding deletedProject')
          return callback(err)
        }

        if (deletedProjects.length) {
          async.eachSeries(
            deletedProjects,
            function(deletedProject, cb) {
              ProjectDeleter.expireDeletedProject(
                deletedProject.deleterData.deletedProjectId,
                cb
              )
            },
            function(err) {
              if (err != null) {
                logger.err({ err })
              }
              callback(err)
            }
          )
        } else {
          logger.log({}, 'No deleted projects for duration were found')
          callback(err)
        }
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
          logger.warn({ err }, 'problem archived project')
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

// Async methods

async function deleteProject(project_id, options = {}) {
  logger.log({ project_id }, 'deleting project')

  try {
    let project = await Project.findOne({ _id: project_id }).exec()
    if (!project) {
      throw new Errors.NotFoundError('project not found')
    }

    let deleterData = {
      deletedAt: new Date(),
      deleterId:
        options.deleterUser != null ? options.deleterUser._id : undefined,
      deleterIpAddress: options.ipAddress,
      deletedProjectId: project._id,
      deletedProjectOwnerId: project.owner_ref,
      deletedProjectCollaboratorIds: project.collaberator_refs,
      deletedProjectReadOnlyIds: project.readOnly_refs,
      deletedProjectReadWriteTokenAccessIds:
        project.tokenAccessReadAndWrite_refs,
      deletedProjectOverleafId: project.overleaf
        ? project.overleaf.id
        : undefined,
      deletedProjectOverleafHistoryId:
        project.overleaf && project.overleaf.history
          ? project.overleaf.history.id
          : undefined,
      deletedProjectReadOnlyTokenAccessIds: project.tokenAccessReadOnly_refs,
      deletedProjectReadWriteToken: project.tokens.readAndWrite,
      deletedProjectReadOnlyToken: project.tokens.readOnly,
      deletedProjectLastUpdatedAt: project.lastUpdated
    }

    Object.keys(deleterData).forEach(
      key => (deleterData[key] === undefined ? delete deleterData[key] : '')
    )

    await DeletedProject.create({
      project: project,
      deleterData: deleterData
    })

    const flushProjectToMongoAndDelete = promisify(
      DocumentUpdaterHandler.flushProjectToMongoAndDelete
    )
    await flushProjectToMongoAndDelete(project_id)

    const getMemberIds = promisify(CollaboratorsHandler.getMemberIds)
    let member_ids = await getMemberIds(project_id)

    // fire these jobs in the background
    Array.from(member_ids).forEach(member_id =>
      TagsHandler.removeProjectFromAllTags(member_id, project_id, () => {})
    )

    await Project.remove({ _id: project_id }).exec()
  } catch (err) {
    logger.warn({ err }, 'problem deleting project')
    throw err
  }

  logger.log({ project_id }, 'successfully deleted project')
}

async function undeleteProject(project_id) {
  let deletedProject = await DeletedProject.findOne({
    'deleterData.deletedProjectId': project_id
  }).exec()

  if (!deletedProject) {
    throw new Errors.NotFoundError('project_not_found')
  }

  if (!deletedProject.project) {
    throw new Errors.NotFoundError('project_too_old_to_restore')
  }

  let restored = new Project(deletedProject.project)

  // if we're undeleting, we want the document to show up
  restored.name = await ProjectDetailsHandler.promises.generateUniqueName(
    deletedProject.deleterData.deletedProjectOwnerId,
    restored.name + ' (Restored)'
  )
  restored.archived = undefined

  // we can't use Mongoose to re-insert the project, as it won't
  // create a new document with an _id already specified. We need to
  // insert it directly into the collection

  // db.projects.insert doesn't work with promisify
  await new Promise((resolve, reject) => {
    db.projects.insert(restored, err => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
  await DeletedProject.deleteOne({ _id: deletedProject._id }).exec()
}

async function expireDeletedProject(projectId) {
  try {
    const deletedProject = await DeletedProject.findOne({
      'deleterData.deletedProjectId': projectId
    }).exec()
    if (!deletedProject) {
      throw new Errors.NotFoundError(
        `No deleted project found for project id ${projectId}`
      )
    }
    if (!deletedProject.project) {
      logger.warn(
        { projectId },
        `Attempted to expire already-expired deletedProject`
      )
      return
    }

    const destroyProject = promisify(DocstoreManager.destroyProject)
    await destroyProject(deletedProject.project._id)

    await DeletedProject.update(
      {
        _id: deletedProject._id
      },
      {
        $set: {
          'deleterData.deleterIpAddress': null,
          project: null
        }
      }
    ).exec()

    logger.log({ projectId }, 'Successfully expired deleted project')
  } catch (error) {
    logger.warn({ projectId, error }, 'error expiring deleted project')
    throw error
  }
}

// Exported class

const promises = {
  deleteProject: deleteProject,
  undeleteProject: undeleteProject,
  expireDeletedProject: expireDeletedProject,
  deleteUsersProjects: promisify(ProjectDeleter.deleteUsersProjects)
}

ProjectDeleter.promises = promises
ProjectDeleter.deleteProject = callbackify(deleteProject)
ProjectDeleter.undeleteProject = callbackify(undeleteProject)
ProjectDeleter.expireDeletedProject = callbackify(expireDeletedProject)

module.exports = ProjectDeleter
