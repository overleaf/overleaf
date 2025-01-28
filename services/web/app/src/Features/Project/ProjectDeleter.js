const _ = require('lodash')
const { db, ObjectId } = require('../../infrastructure/mongodb')
const Modules = require('../../infrastructure/Modules')
const { callbackify } = require('util')
const { Project } = require('../../models/Project')
const { DeletedProject } = require('../../models/DeletedProject')
const { ProjectAuditLogEntry } = require('../../models/ProjectAuditLogEntry')
const Errors = require('../Errors/Errors')
const logger = require('@overleaf/logger')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const TagsHandler = require('../Tags/TagsHandler')
const ProjectHelper = require('./ProjectHelper')
const ProjectDetailsHandler = require('./ProjectDetailsHandler')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const CollaboratorsGetter = require('../Collaborators/CollaboratorsGetter')
const DocstoreManager = require('../Docstore/DocstoreManager')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const HistoryManager = require('../History/HistoryManager')
const FilestoreHandler = require('../FileStore/FileStoreHandler')
const ChatApiHandler = require('../Chat/ChatApiHandler')
const moment = require('moment')
const { promiseMapWithLimit } = require('@overleaf/promise-utils')
const { READ_PREFERENCE_SECONDARY } = require('../../infrastructure/mongodb')

const EXPIRE_PROJECTS_AFTER_DAYS = 90
const PROJECT_EXPIRATION_BATCH_SIZE = 10000

module.exports = {
  markAsDeletedByExternalSource: callbackify(markAsDeletedByExternalSource),
  unmarkAsDeletedByExternalSource: callbackify(unmarkAsDeletedByExternalSource),
  deleteUsersProjects: callbackify(deleteUsersProjects),
  expireDeletedProjectsAfterDuration: callbackify(
    expireDeletedProjectsAfterDuration
  ),
  restoreProject: callbackify(restoreProject),
  archiveProject: callbackify(archiveProject),
  unarchiveProject: callbackify(unarchiveProject),
  trashProject: callbackify(trashProject),
  untrashProject: callbackify(untrashProject),
  deleteProject: callbackify(deleteProject),
  undeleteProject: callbackify(undeleteProject),
  expireDeletedProject: callbackify(expireDeletedProject),
  promises: {
    archiveProject,
    unarchiveProject,
    trashProject,
    untrashProject,
    deleteProject,
    undeleteProject,
    expireDeletedProject,
    markAsDeletedByExternalSource,
    unmarkAsDeletedByExternalSource,
    deleteUsersProjects,
    expireDeletedProjectsAfterDuration,
    restoreProject,
  },
}

async function markAsDeletedByExternalSource(projectId) {
  logger.debug(
    { projectId },
    'marking project as deleted by external data source'
  )
  await Project.updateOne(
    { _id: projectId },
    { deletedByExternalDataSource: true }
  ).exec()
  EditorRealTimeController.emitToRoom(
    projectId,
    'projectRenamedOrDeletedByExternalSource'
  )
}

async function unmarkAsDeletedByExternalSource(projectId) {
  await Project.updateOne(
    { _id: projectId },
    { deletedByExternalDataSource: false }
  ).exec()
}

async function deleteUsersProjects(userId) {
  const projects = await Project.find({ owner_ref: userId }).exec()
  await promiseMapWithLimit(5, projects, project => deleteProject(project._id))
  await CollaboratorsHandler.promises.removeUserFromAllProjects(userId)
}

async function expireDeletedProjectsAfterDuration() {
  const deletedProjects = await DeletedProject.find(
    {
      'deleterData.deletedAt': {
        $lt: new Date(moment().subtract(EXPIRE_PROJECTS_AFTER_DAYS, 'days')),
      },
      project: { $type: 'object' },
    },
    { 'deleterData.deletedProjectId': 1 }
  )
    .limit(PROJECT_EXPIRATION_BATCH_SIZE)
    .read(READ_PREFERENCE_SECONDARY)
  const projectIds = _.shuffle(
    deletedProjects.map(
      deletedProject => deletedProject.deleterData.deletedProjectId
    )
  )
  for (const projectId of projectIds) {
    await expireDeletedProject(projectId)
  }
}

async function restoreProject(projectId) {
  await Project.updateOne(
    { _id: projectId },
    { $unset: { archived: true } }
  ).exec()
}

async function archiveProject(projectId, userId) {
  try {
    const project = await Project.findOne({ _id: projectId }).exec()
    if (!project) {
      throw new Errors.NotFoundError('project not found')
    }
    const archived = ProjectHelper.calculateArchivedArray(
      project,
      userId,
      'ARCHIVE'
    )

    await Project.updateOne(
      { _id: projectId },
      { $set: { archived }, $pull: { trashed: new ObjectId(userId) } }
    )
  } catch (err) {
    logger.warn({ err }, 'problem archiving project')
    throw err
  }
}

async function unarchiveProject(projectId, userId) {
  try {
    const project = await Project.findOne({ _id: projectId }).exec()
    if (!project) {
      throw new Errors.NotFoundError('project not found')
    }

    const archived = ProjectHelper.calculateArchivedArray(
      project,
      userId,
      'UNARCHIVE'
    )

    await Project.updateOne({ _id: projectId }, { $set: { archived } })
  } catch (err) {
    logger.warn({ err }, 'problem unarchiving project')
    throw err
  }
}

async function trashProject(projectId, userId) {
  try {
    const project = await Project.findOne({ _id: projectId }).exec()
    if (!project) {
      throw new Errors.NotFoundError('project not found')
    }

    const archived = ProjectHelper.calculateArchivedArray(
      project,
      userId,
      'UNARCHIVE'
    )

    await Project.updateOne(
      { _id: projectId },
      {
        $addToSet: { trashed: new ObjectId(userId) },
        $set: { archived },
      }
    )
  } catch (err) {
    logger.warn({ err }, 'problem trashing project')
    throw err
  }
}

async function untrashProject(projectId, userId) {
  try {
    const project = await Project.findOne({ _id: projectId }).exec()
    if (!project) {
      throw new Errors.NotFoundError('project not found')
    }

    await Project.updateOne(
      { _id: projectId },
      { $pull: { trashed: new ObjectId(userId) } }
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

    await DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete(
      projectId
    )

    try {
      // OPTIMIZATION: flush docs out of mongo
      await DocstoreManager.promises.archiveProject(projectId)
    } catch (err) {
      // It is OK to fail here, the docs will get hard-deleted eventually after
      //  the grace-period for soft-deleted projects has passed.
      logger.warn(
        { projectId, err },
        'failed archiving doc via docstore as part of project soft-deletion'
      )
    }

    const memberIds = await CollaboratorsGetter.promises.getMemberIds(projectId)

    // fire these jobs in the background
    for (const memberId of memberIds) {
      TagsHandler.promises
        .removeProjectFromAllTags(memberId, projectId)
        .catch(err => {
          logger.err(
            { err, memberId, projectId },
            'failed to remove project from tags'
          )
        })
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
      deletedProjectLastUpdatedAt: project.lastUpdated,
    }

    Object.keys(deleterData).forEach(key =>
      deleterData[key] === undefined ? delete deleterData[key] : ''
    )

    await DeletedProject.updateOne(
      { 'deleterData.deletedProjectId': projectId },
      { project, deleterData },
      { upsert: true }
    )

    await Project.deleteOne({ _id: projectId }).exec()
  } catch (err) {
    logger.warn({ err }, 'problem deleting project')
    throw err
  }

  logger.debug({ projectId }, 'successfully deleted project')
}

async function undeleteProject(projectId, options = {}) {
  projectId = new ObjectId(projectId)
  const deletedProject = await DeletedProject.findOne({
    'deleterData.deletedProjectId': projectId,
  }).exec()

  if (!deletedProject) {
    throw new Errors.NotFoundError('project_not_found')
  }

  if (!deletedProject.project) {
    throw new Errors.NotFoundError('project_too_old_to_restore')
  }

  const restored = new Project(deletedProject.project)

  if (options.userId) {
    restored.owner_ref = options.userId
  }

  // if we're undeleting, we want the document to show up
  restored.name = await ProjectDetailsHandler.promises.generateUniqueName(
    deletedProject.deleterData.deletedProjectOwnerId,
    restored.name + ' (Restored)'
  )
  restored.archived = undefined

  if (restored.deletedDocs && restored.deletedDocs.length > 0) {
    await promiseMapWithLimit(10, restored.deletedDocs, async deletedDoc => {
      // back fill context of deleted docs
      const { _id: docId, name, deletedAt } = deletedDoc
      await DocstoreManager.promises.deleteDoc(
        projectId,
        docId,
        name,
        deletedAt
      )
    })
    restored.deletedDocs = []
  }
  if (restored.deletedFiles && restored.deletedFiles.length > 0) {
    filterDuplicateDeletedFilesInPlace(restored)
    const deletedFiles = restored.deletedFiles.map(file => {
      // break free from the model
      file = file.toObject()

      // add projectId
      file.projectId = projectId
      return file
    })
    await db.deletedFiles.insertMany(deletedFiles)
    restored.deletedFiles = []
  }

  // we can't use Mongoose to re-insert the project, as it won't
  // create a new document with an _id already specified. We need to
  // insert it directly into the collection

  await db.projects.insertOne(restored)
  await DeletedProject.deleteOne({ _id: deletedProject._id }).exec()
}

async function expireDeletedProject(projectId) {
  try {
    const activeProject = await Project.findById(projectId).exec()
    if (activeProject) {
      // That project is active. The deleted project record might be there
      // because of an incomplete delete or undelete operation. Clean it up and
      // return.
      await DeletedProject.deleteOne({
        'deleterData.deletedProjectId': projectId,
      })
      await ProjectAuditLogEntry.deleteMany({ projectId })
      return
    }
    const deletedProject = await DeletedProject.findOne({
      'deleterData.deletedProjectId': projectId,
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

    const historyId =
      deletedProject.project.overleaf &&
      deletedProject.project.overleaf.history &&
      deletedProject.project.overleaf.history.id

    await Promise.all([
      DocstoreManager.promises.destroyProject(deletedProject.project._id),
      HistoryManager.promises.deleteProject(
        deletedProject.project._id,
        historyId
      ),
      FilestoreHandler.promises.deleteProject(deletedProject.project._id),
      ChatApiHandler.promises.destroyProject(deletedProject.project._id),
      hardDeleteDeletedFiles(deletedProject.project._id),
      ProjectAuditLogEntry.deleteMany({ projectId }),
      Modules.promises.hooks.fire('projectExpired', deletedProject.project._id),
    ])

    await DeletedProject.updateOne(
      {
        _id: deletedProject._id,
      },
      {
        $set: {
          'deleterData.deleterIpAddress': null,
          project: null,
        },
      }
    ).exec()
  } catch (error) {
    logger.warn({ projectId, error }, 'error expiring deleted project')
    throw error
  }
}

function filterDuplicateDeletedFilesInPlace(project) {
  const fileIds = new Set()
  project.deletedFiles = project.deletedFiles.filter(file => {
    const id = file._id.toString()
    if (fileIds.has(id)) return false
    fileIds.add(id)
    return true
  })
}

let deletedFilesProjectIdIndexExist
async function doesDeletedFilesProjectIdIndexExist() {
  if (typeof deletedFilesProjectIdIndexExist !== 'boolean') {
    // Resolve this about once. No need for locking or retry handling.
    deletedFilesProjectIdIndexExist =
      await db.deletedFiles.indexExists('projectId_1')
  }
  return deletedFilesProjectIdIndexExist
}

async function hardDeleteDeletedFiles(projectId) {
  if (!(await doesDeletedFilesProjectIdIndexExist())) {
    // Running the deletion command w/o index would kill mongo performance
    return
  }
  return db.deletedFiles.deleteMany({ projectId })
}
