import { expressify } from '@overleaf/promise-utils'
import TpdsUpdateHandler from './TpdsUpdateHandler.mjs'
import UpdateMerger from './UpdateMerger.mjs'
import Errors from '../Errors/Errors.js'
import logger from '@overleaf/logger'
import Path from 'node:path'
import metrics from '@overleaf/metrics'
import NotificationsBuilder from '../Notifications/NotificationsBuilder.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import ProjectCreationHandler from '../Project/ProjectCreationHandler.mjs'
import ProjectDetailsHandler from '../Project/ProjectDetailsHandler.mjs'
import HttpErrorHandler from '../Errors/HttpErrorHandler.mjs'
import TpdsQueueManager from './TpdsQueueManager.mjs'

async function createProject(req, res) {
  const { user_id: userId } = req.params
  let { projectName } = req.body
  projectName = await ProjectDetailsHandler.promises.generateUniqueName(
    userId,
    projectName
  )
  const project = await ProjectCreationHandler.promises.createBlankProject(
    userId,
    projectName,
    {},
    { skipCreatingInTPDS: true }
  )
  res.json({
    projectId: project._id.toString(),
  })
}

// mergeUpdate and deleteUpdate are used by Dropbox, where the project is only
// passed as the name, as the first part of the file path. They have to check
// the project exists, find it, and create it if not.  They also ignore 'noisy'
// files like .DS_Store, .gitignore, etc.

async function mergeUpdate(req, res) {
  metrics.inc('tpds.merge-update')
  const { filePath, userId, projectId, projectName } = parseParams(req)
  const source = req.headers['x-update-source'] || 'unknown'

  let metadata
  try {
    metadata = await TpdsUpdateHandler.promises.newUpdate(
      userId,
      projectId,
      projectName,
      filePath,
      req,
      source
    )
  } catch (err) {
    if (err.name === 'TooManyRequestsError') {
      logger.warn(
        { err, userId, filePath },
        'tpds update failed to be processed, too many requests'
      )
      return res.sendStatus(429)
    } else if (err.message === 'project_has_too_many_files') {
      logger.warn(
        { err, userId, filePath },
        'tpds trying to append to project over file limit'
      )
      await NotificationsBuilder.promises
        .tpdsFileLimit(userId)
        .create(projectName, projectId)
      return res.sendStatus(400)
    } else {
      throw err
    }
  }

  if (metadata == null) {
    return res.json({ status: 'rejected' })
  }

  const payload = {
    status: 'applied',
    projectId: metadata.projectId.toString(),
    entityId: metadata.entityId.toString(),
    entityType: metadata.entityType,
    folderId: metadata.folderId.toString(),
  }

  // When the update is a doc edit, the update is merged in docupdater and
  // doesn't generate a new rev.
  if (metadata.rev != null) {
    payload.rev = metadata.rev.toString()
  }
  res.json(payload)
}

async function deleteUpdate(req, res) {
  metrics.inc('tpds.delete-update')
  const { filePath, userId, projectId, projectName } = parseParams(req)
  const source = req.headers['x-update-source'] || 'unknown'

  await TpdsUpdateHandler.promises.deleteUpdate(
    userId,
    projectId,
    projectName,
    filePath,
    source
  )
  res.sendStatus(200)
}

/**
 * Update endpoint that accepts update details as JSON
 */
async function updateFolder(req, res) {
  const userId = req.body.userId
  const projectId = req.body.projectId
  const { projectName, filePath } = splitPath(projectId, req.body.path)
  const metadata = await TpdsUpdateHandler.promises.createFolder(
    userId,
    projectId,
    projectName,
    filePath
  )
  if (metadata == null) {
    return HttpErrorHandler.conflict(req, res, 'Could not create folder', {
      userId,
      projectName,
      filePath,
    })
  }
  res.json({
    entityId: metadata.folderId.toString(),
    projectId: metadata.projectId.toString(),
    path: metadata.path,
    folderId: metadata.parentFolderId?.toString() || null,
  })
}

// updateProjectContents and deleteProjectContents are used by GitHub. The
// project_id is known so we can skip right ahead to creating/updating/deleting
// the file. These methods will not ignore noisy files like .DS_Store,
// .gitignore, etc because people are generally more explicit with the files
// they want in git.

async function updateProjectContents(req, res) {
  const projectId = req.params.project_id
  const path = `/${req.params[0]}` // UpdateMerger expects leading slash
  const source = req.headers['x-update-source'] || 'unknown'

  try {
    const metadata = await UpdateMerger.promises.mergeUpdate(
      null,
      projectId,
      path,
      req,
      source
    )
    res.json({
      entityId: metadata.entityId.toString(),
      rev: metadata.rev,
    })
  } catch (error) {
    if (
      error instanceof Errors.InvalidNameError ||
      error instanceof Errors.DuplicateNameError
    ) {
      res.sendStatus(422)
    } else {
      throw error
    }
  }
}

async function deleteProjectContents(req, res) {
  const projectId = req.params.project_id
  const path = `/${req.params[0]}` // UpdateMerger expects leading slash
  const source = req.headers['x-update-source'] || 'unknown'

  const entityId = await UpdateMerger.promises.deleteUpdate(
    null,
    projectId,
    path,
    source
  )
  res.json({ entityId })
}

async function getQueues(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  res.json(await TpdsQueueManager.promises.getQueues(userId))
}

function parseParams(req) {
  const userId = req.params.user_id
  const projectId = req.params.project_id
  const { projectName, filePath } = splitPath(projectId, req.params[0])
  return { filePath, userId, projectName, projectId }
}

function splitPath(projectId, path) {
  let filePath, projectName
  path = Path.join('/', path)
  if (projectId) {
    filePath = path
    projectName = ''
  } else if (path.substring(1).indexOf('/') === -1) {
    filePath = '/'
    projectName = path.substring(1)
  } else {
    filePath = path.substring(path.indexOf('/', 1))
    projectName = path.substring(0, path.indexOf('/', 1))
    projectName = projectName.replace('/', '')
  }

  return { filePath, projectName }
}

export default {
  createProject: expressify(createProject),
  mergeUpdate: expressify(mergeUpdate),
  deleteUpdate: expressify(deleteUpdate),
  updateFolder: expressify(updateFolder),
  updateProjectContents: expressify(updateProjectContents),
  deleteProjectContents: expressify(deleteProjectContents),
  getQueues: expressify(getQueues),

  promises: {
    deleteProjectContents,
    updateProjectContents,
  },

  // for tests only
  parseParams,
}
