import { callbackify } from 'node:util'
import UpdateMerger from './UpdateMerger.mjs'
import logger from '@overleaf/logger'
import NotificationsBuilder from '../Notifications/NotificationsBuilder.mjs'
import ProjectCreationHandler from '../Project/ProjectCreationHandler.mjs'
import ProjectDeleter from '../Project/ProjectDeleter.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ProjectHelper from '../Project/ProjectHelper.mjs'
import ProjectRootDocManager from '../Project/ProjectRootDocManager.mjs'
import FileTypeManager from '../Uploads/FileTypeManager.mjs'
import CooldownManager from '../Cooldown/CooldownManager.mjs'
import Errors from '../Errors/Errors.js'
import Modules from '../../infrastructure/Modules.mjs'

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

  const projectIsOnCooldown = await CooldownManager.isProjectOnCooldown(
    project._id
  )
  if (projectIsOnCooldown) {
    throw new Errors.TooManyRequestsError('project on cooldown')
  }

  const shouldIgnore = FileTypeManager.shouldIgnore(path)
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
        if (ProjectHelper.isArchivedOrTrashed(project, userId)) {
          return null
        } else {
          return project
        }
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
    ProjectRootDocManager.setRootDocAutomaticallyInBackground(project._id)
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

  const projectIsOnCooldown = await CooldownManager.isProjectOnCooldown(
    project._id
  )
  if (projectIsOnCooldown) {
    throw new Errors.TooManyRequestsError('project on cooldown')
  }

  const shouldIgnore = FileTypeManager.shouldIgnore(path)
  if (shouldIgnore) {
    return null
  }

  const folder = await UpdateMerger.promises.createFolder(
    project._id,
    path,
    userId
  )
  return {
    folderId: folder._id,
    parentFolderId: folder.parentFolder_id,
    projectId: project._id,
    path,
  }
}

export default {
  newUpdate: callbackify(newUpdate),
  deleteUpdate: callbackify(deleteUpdate),
  createFolder: callbackify(createFolder),
  promises: {
    newUpdate,
    deleteUpdate,
    createFolder,
  },
}
