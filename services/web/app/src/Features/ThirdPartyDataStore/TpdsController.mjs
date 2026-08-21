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
import { parseReq, z, zz } from '@overleaf/validation-tools'

// project_id/projectId is either a valid Mongo ObjectId (look up an existing
// project) or absent/empty (fall back to resolving/creating by name) -- see
// TpdsUpdateHandler.getOrCreateProject. When present and non-empty it always
// reaches a Mongo lookup (ProjectGetter.getProject) before it can reach any
// sink, so a bare zz.objectId() union covers this safely.
const optionalProjectId = zz.objectId().or(z.literal('')).optional()

const createProjectSchema = z.object({
  params: z.object({
    user_id: zz.objectId(),
  }),
  body: z.object({
    projectName: z.string().optional(),
  }),
})

async function createProject(req, res) {
  const {
    params: { user_id: userId },
    body,
  } = parseReq(req, createProjectSchema, { logOnly: true })
  let { projectName } = body
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

// Strict: with non-strict branches, `{projectId: <malformed>, projectName}`
// would fall through to the name branch and create a blank project instead of
// failing the request
const resolveProjectSchema = z.object({
  params: z.object({
    user_id: zz.objectId(),
  }),
  body: z
    .strictObject({
      projectId: zz.objectId(),
    })
    .or(
      z.strictObject({
        projectName: z.string().min(1),
      })
    ),
})

// Resolve a project name (or id) to a project id, using the same
// get-or-create semantics as mergeUpdate: a blank project is created when no
// project matches the name, and duplicate names trigger the duplicate-name
// handling before rejecting the request.
async function resolveProject(req, res) {
  const {
    params: { user_id: userId },
    body: { projectId, projectName },
  } = parseReq(req, resolveProjectSchema)
  const project = await TpdsUpdateHandler.promises.getOrCreateProject(
    userId,
    projectId,
    projectName
  )
  if (project == null) {
    return res.json({ status: 'rejected' })
  }
  res.json({
    status: 'success',
    projectId: project._id.toString(),
    historyId: project.overleaf?.history?.id,
    otMigrationStage: project.overleaf?.history?.otMigrationStage ?? 0,
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
    if (err instanceof Errors.TooManyFilesError) {
      logger.warn(
        { err, userId, filePath },
        'tpds trying to append to project over file limit'
      )
      await NotificationsBuilder.promises
        .tpdsFileLimit(userId)
        .create(projectName, projectId)
    }
    throw err
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

const updateFolderSchema = z.object({
  body: z.object({
    userId: zz.objectId(),
    projectId: optionalProjectId,
    path: z.string(),
  }),
})

/**
 * Update endpoint that accepts update details as JSON
 */
async function updateFolder(req, res) {
  const {
    body: { userId, projectId, path },
  } = parseReq(req, updateFolderSchema, { logOnly: true })
  const { projectName, filePath } = splitPath(projectId, path)
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

const projectContentsParamsSchema = z.object({
  params: z.object({
    project_id: zz.objectId(),
    // GitHub-sync repo file path; reaches UpdateMerger without any
    // Path.join() normalization first, so it needs its own hardening.
    path: zz.safePath(),
  }),
})

async function updateProjectContents(req, res) {
  const { params } = parseReq(req, projectContentsParamsSchema, {
    logOnly: true,
  })
  const projectId = params.project_id
  const path = `/${params.path}` // UpdateMerger expects leading slash
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
  const { params } = parseReq(req, projectContentsParamsSchema, {
    logOnly: true,
  })
  const projectId = params.project_id
  const path = `/${params.path}` // UpdateMerger expects leading slash
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

const wildcardUpdateParamsSchema = z.object({
  params: z.object({
    user_id: zz.objectId(),
    project_id: optionalProjectId,
    // Dropbox-supplied path (projectName/.../file, split up below). A path
    // of exactly '/' is Dropbox's "the project folder itself was deleted"
    // sentinel, which TpdsUpdateHandler.deleteUpdate acts on.
    path: zz.safePath().or(z.literal('/')),
  }),
})

function parseParams(req) {
  const {
    params: { user_id: userId, project_id: projectId, path },
  } = parseReq(req, wildcardUpdateParamsSchema, { logOnly: true })
  const { projectName, filePath } = splitPath(projectId, path)
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
  resolveProject: expressify(resolveProject),
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
