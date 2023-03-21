const { callbackify } = require('util')
const UpdateMerger = require('./UpdateMerger')
const logger = require('@overleaf/logger')
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
const {
  BackgroundTaskTracker,
} = require('../../infrastructure/GracefulShutdown')

const ROOT_DOC_TIMEOUT_LENGTH = 30 * 1000

const rootDocResets = new BackgroundTaskTracker('root doc resets')

async function newUpdate(
  userId,
  projectId,
  projectName,
  path,
  updateRequest,
  source
) {
  const project = await getOrCreateProject(userId, projectId, projectName)
  if (project == null) {
    return null
  }

  const projectIsOnCooldown =
    await CooldownManager.promises.isProjectOnCooldown(project._id)
  if (projectIsOnCooldown) {
    throw new Errors.TooManyRequestsError('project on cooldown')
  }

  const shouldIgnore = await FileTypeManager.promises.shouldIgnore(path)
  if (shouldIgnore) {
    return null
  }

  const metadata = await UpdateMerger.promises.mergeUpdate(
    userId,
    project._id,
    path,
    updateRequest,
    source
  )
  return metadata
}

async function deleteUpdate(userId, projectId, projectName, path, source) {
  logger.debug({ userId, filePath: path }, 'handling delete update from tpds')
  let projects = []
  if (projectId) {
    const project = await findProjectByIdWithRWAccess(userId, projectId)
    if (project) {
      projects = [project]
    }
  } else {
    projects = await ProjectGetter.promises.findUsersProjectsByName(
      userId,
      projectName
    )
  }
  const activeProjects = projects.filter(
    project => !ProjectHelper.isArchivedOrTrashed(project, userId)
  )

  if (activeProjects.length === 0) {
    logger.debug(
      { userId, filePath: path, projectName },
      'project not found from tpds update, ignoring folder or project'
    )
    return
  }

  if (projects.length > 1) {
    // There is more than one project with that name, and one of them is
    // active (previous condition)
    await handleDuplicateProjects(userId, projectName)
    return
  }

  const project = activeProjects[0]
  if (path === '/') {
    logger.debug(
      { userId, filePath: path, projectName, projectId: project._id },
      'project found for delete update, path is root so marking project as deleted'
    )
    await ProjectDeleter.promises.markAsDeletedByExternalSource(project._id)
  } else {
    await UpdateMerger.promises.deleteUpdate(userId, project._id, path, source)
  }
}

async function getOrCreateProject(userId, projectId, projectName) {
  if (projectId) {
    return findProjectByIdWithRWAccess(userId, projectId)
  } else {
    return getOrCreateProjectByName(userId, projectName)
  }
}

async function findProjectByIdWithRWAccess(userId, projectId) {
  const allProjects = await ProjectGetter.promises.findAllUsersProjects(
    userId,
    'name archived trashed'
  )
  for (const projects of [allProjects.owned, allProjects.readAndWrite]) {
    for (const project of projects) {
      if (project._id.toString() === projectId) {
        return project
      }
    }
  }
}

async function getOrCreateProjectByName(userId, projectName) {
  const projects = await ProjectGetter.promises.findUsersProjectsByName(
    userId,
    projectName
  )

  if (projects.length === 0) {
    // No project with that name -- active, archived or trashed -- has been
    // found. Create one.
    const project = await ProjectCreationHandler.promises.createBlankProject(
      userId,
      projectName
    )

    // have a crack at setting the root doc after a while, on creation
    // we won't have it yet, but should have been sent it it within 30
    // seconds
    rootDocResets.add()
    setTimeout(() => {
      ProjectRootDocManager.promises
        .setRootDocAutomatically(project._id)
        .then(() => {
          rootDocResets.done()
        })
        .catch(err => {
          logger.warn({ err }, 'failed to set root doc after project creation')
        })
    }, ROOT_DOC_TIMEOUT_LENGTH)
    return project
  }

  const activeProjects = projects.filter(
    project => !ProjectHelper.isArchivedOrTrashed(project, userId)
  )
  if (activeProjects.length === 0) {
    // All projects with that name are archived or trashed. Ignore.
    return null
  }

  if (projects.length > 1) {
    // There is more than one project with that name, and one of them is
    // active (previous condition)
    await handleDuplicateProjects(userId, projectName)
    return null
  }

  return activeProjects[0]
}

async function handleDuplicateProjects(userId, projectName) {
  await Modules.promises.hooks.fire(
    'removeDropbox',
    userId,
    'duplicate-projects'
  )
  await NotificationsBuilder.promises
    .dropboxDuplicateProjectNames(userId)
    .create(projectName)
}

async function createFolder(userId, projectId, projectName, path) {
  const project = await getOrCreateProject(userId, projectId, projectName)
  if (project == null) {
    return null
  }

  const projectIsOnCooldown =
    await CooldownManager.promises.isProjectOnCooldown(project._id)
  if (projectIsOnCooldown) {
    throw new Errors.TooManyRequestsError('project on cooldown')
  }

  const shouldIgnore = await FileTypeManager.promises.shouldIgnore(path)
  if (shouldIgnore) {
    return null
  }

  const folder = await UpdateMerger.promises.createFolder(project._id, path)
  return {
    folderId: folder._id,
    parentFolderId: folder.parentFolder_id,
    projectId: project._id,
    path,
  }
}

module.exports = {
  newUpdate: callbackify(newUpdate),
  deleteUpdate: callbackify(deleteUpdate),
  createFolder: callbackify(createFolder),
  promises: {
    newUpdate,
    deleteUpdate,
    createFolder,
  },
}
