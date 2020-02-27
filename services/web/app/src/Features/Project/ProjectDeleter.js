const { db, ObjectId } = require('../../infrastructure/mongojs')
const { promisify, callbackify } = require('util')
const { Project } = require('../../models/Project')
const { DeletedProject } = require('../../models/DeletedProject')
const Errors = require('../Errors/Errors')
const logger = require('logger-sharelatex')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const TagsHandler = require('../Tags/TagsHandler')
const async = require('async')
const ProjectHelper = require('./ProjectHelper')
const ProjectDetailsHandler = require('./ProjectDetailsHandler')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const CollaboratorsGetter = require('../Collaborators/CollaboratorsGetter')
const DocstoreManager = require('../Docstore/DocstoreManager')
const moment = require('moment')

function logWarningOnError(msg) {
  return function(err) {
    if (err) {
      logger.warn({ err }, msg)
    }
  }
}

const ProjectDeleter = {
  markAsDeletedByExternalSource(projectId, callback) {
    callback =
      callback ||
      logWarningOnError('error marking project as deleted by external source')
    logger.log(
      { project_id: projectId },
      'marking project as deleted by external data source'
    )
    const conditions = { _id: projectId }
    const update = { deletedByExternalDataSource: true }

    Project.update(conditions, update, {}, err => {
      if (err) {
        return callback(err)
      }
      require('../Editor/EditorController').notifyUsersProjectHasBeenDeletedOrRenamed(
        projectId,
        () => callback() // don't return error, as project has been updated
      )
    })
  },

  unmarkAsDeletedByExternalSource(projectId, callback) {
    callback =
      callback ||
      logWarningOnError('error unmarking project as deleted by external source')
    const conditions = { _id: projectId }
    const update = { deletedByExternalDataSource: false }
    Project.update(conditions, update, {}, callback)
  },

  deleteUsersProjects(userId, callback) {
    Project.find({ owner_ref: userId }, function(error, projects) {
      if (error) {
        return callback(error)
      }
      async.eachLimit(
        projects,
        5,
        (project, cb) => ProjectDeleter.deleteProject(project._id, cb),
        function(err) {
          if (err) {
            return callback(err)
          }
          CollaboratorsHandler.removeUserFromAllProjects(userId, callback)
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
        if (err) {
          logger.err({ err }, 'Problem with finding deletedProject')
          return callback(err)
        }

        async.eachSeries(
          deletedProjects,
          function(deletedProject, cb) {
            ProjectDeleter.expireDeletedProject(
              deletedProject.deleterData.deletedProjectId,
              cb
            )
          },
          callback
        )
      }
    )
  },

  restoreProject(projectId, callback) {
    Project.update({ _id: projectId }, { $unset: { archived: true } }, callback)
  }
}

// Async methods

async function archiveProject(projectId, userId) {
  try {
    let project = await Project.findOne({ _id: projectId }).exec()
    if (!project) {
      throw new Errors.NotFoundError('project not found')
    }
    const archived = ProjectHelper.calculateArchivedArray(
      project,
      userId,
      'ARCHIVE'
    )

    await Project.update(
      { _id: projectId },
      { $set: { archived: archived }, $pull: { trashed: ObjectId(userId) } }
    )
  } catch (err) {
    logger.warn({ err }, 'problem archiving project')
    throw err
  }
}

async function unarchiveProject(projectId, userId) {
  try {
    let project = await Project.findOne({ _id: projectId }).exec()
    if (!project) {
      throw new Errors.NotFoundError('project not found')
    }

    const archived = ProjectHelper.calculateArchivedArray(
      project,
      userId,
      'UNARCHIVE'
    )

    await Project.update({ _id: projectId }, { $set: { archived: archived } })
  } catch (err) {
    logger.warn({ err }, 'problem unarchiving project')
    throw err
  }
}

async function trashProject(projectId, userId) {
  try {
    let project = await Project.findOne({ _id: projectId }).exec()
    if (!project) {
      throw new Errors.NotFoundError('project not found')
    }

    await Project.update(
      { _id: projectId },
      {
        $addToSet: { trashed: ObjectId(userId) },
        $pull: { archived: ObjectId(userId) }
      }
    )
  } catch (err) {
    logger.warn({ err }, 'problem trashing project')
    throw err
  }
}

async function untrashProject(projectId, userId) {
  try {
    let project = await Project.findOne({ _id: projectId }).exec()
    if (!project) {
      throw new Errors.NotFoundError('project not found')
    }

    await Project.update(
      { _id: projectId },
      { $pull: { trashed: ObjectId(userId) } }
    )
  } catch (err) {
    logger.warn({ err }, 'problem untrashing project')
    throw err
  }
}

async function deleteProject(projectId, options = {}) {
  try {
    const project = await Project.findOne({ _id: projectId }).exec()
    if (!project) {
      throw new Errors.NotFoundError('project not found')
    }

    const deleterData = {
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

    await DeletedProject.update(
      { 'deleterData.deletedProjectId': projectId },
      { project, deleterData },
      { upsert: true }
    )

    const flushProjectToMongoAndDelete = promisify(
      DocumentUpdaterHandler.flushProjectToMongoAndDelete
    )
    await flushProjectToMongoAndDelete(projectId)

    const memberIds = await CollaboratorsGetter.promises.getMemberIds(projectId)

    // fire these jobs in the background
    Array.from(memberIds).forEach(memberId =>
      TagsHandler.removeProjectFromAllTags(memberId, projectId, () => {})
    )

    await Project.remove({ _id: projectId }).exec()
  } catch (err) {
    logger.warn({ err }, 'problem deleting project')
    throw err
  }

  logger.log({ project_id: projectId }, 'successfully deleted project')
}

async function undeleteProject(projectId) {
  let deletedProject = await DeletedProject.findOne({
    'deleterData.deletedProjectId': projectId
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
  } catch (error) {
    logger.warn({ projectId, error }, 'error expiring deleted project')
    throw error
  }
}

// Exported class

const promises = {
  archiveProject: archiveProject,
  unarchiveProject: unarchiveProject,
  trashProject: trashProject,
  untrashProject: untrashProject,
  deleteProject: deleteProject,
  undeleteProject: undeleteProject,
  expireDeletedProject: expireDeletedProject,
  deleteUsersProjects: promisify(ProjectDeleter.deleteUsersProjects),
  unmarkAsDeletedByExternalSource: promisify(
    ProjectDeleter.unmarkAsDeletedByExternalSource
  )
}

ProjectDeleter.promises = promises
ProjectDeleter.archiveProject = callbackify(archiveProject)
ProjectDeleter.unarchiveProject = callbackify(unarchiveProject)
ProjectDeleter.trashProject = callbackify(trashProject)
ProjectDeleter.untrashProject = callbackify(untrashProject)
ProjectDeleter.deleteProject = callbackify(deleteProject)
ProjectDeleter.undeleteProject = callbackify(undeleteProject)
ProjectDeleter.expireDeletedProject = callbackify(expireDeletedProject)

module.exports = ProjectDeleter
