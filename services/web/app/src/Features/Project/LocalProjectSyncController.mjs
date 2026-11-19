import logger from '@overleaf/logger'
import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import { parseReq, z, zz } from '../../infrastructure/Validation.mjs'
import LocalProjectSyncManager from './LocalProjectSyncManager.mjs'

const updateSettingsSchema = z.object({
  body: z.object({
    baseDir: z.string().min(1).max(1024),
    syncAll: z.boolean().optional().default(true),
    cleanOld: z.boolean().optional().default(false),
  }),
})

const browseSchema = z.object({
  query: z.object({
    path: z.string().max(1024).optional(),
  }),
})

const mkdirSchema = z.object({
  body: z.object({
    path: z.string().min(1).max(1024),
  }),
})

const updateProjectFolderSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  body: z.object({
    customFolderPath: z.string().max(1024).nullish(),
    syncEnabled: z.boolean().optional().default(true),
    syncNow: z.boolean().optional().default(true),
    cleanOld: z.boolean().optional().default(false),
  }),
})

const syncProjectSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
})

function sendError(res, err, fallbackMessage) {
  const status = err?.statusCode || 500
  if (status >= 500) {
    logger.error({ err }, fallbackMessage)
  }
  return res.status(status).json({
    ok: false,
    message: err?.message || fallbackMessage,
  })
}

async function getSettings(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  try {
    const settings = await LocalProjectSyncManager.getSettings(userId)
    res.json(settings)
  } catch (err) {
    sendError(res, err, 'Failed to load local folder settings')
  }
}

async function updateSettings(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  try {
    const { body } = parseReq(req, updateSettingsSchema)
    const result = await LocalProjectSyncManager.updateBaseDir(
      userId,
      body.baseDir,
      {
        syncAll: body.syncAll,
        cleanOld: body.cleanOld,
      }
    )
    res.json(result)
  } catch (err) {
    if (err?.name === 'InvalidRequestError' || err?.name === 'InvalidParamsError') {
      return res.status(400).json({ ok: false, message: 'Invalid folder path request' })
    }
    sendError(res, err, 'Failed to update default projects folder location')
  }
}

async function syncAll(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  try {
    const result = await LocalProjectSyncManager.syncAllUserProjects(userId)
    res.json(result)
  } catch (err) {
    sendError(res, err, 'Failed to sync projects to local folder')
  }
}

async function browse(req, res) {
  try {
    const { query } = parseReq(req, browseSchema)
    const result = await LocalProjectSyncManager.browseDirectories(query.path)
    res.json(result)
  } catch (err) {
    sendError(res, err, 'Failed to browse local directories')
  }
}

async function createDirectory(req, res) {
  try {
    const { body } = parseReq(req, mkdirSchema)
    const result = await LocalProjectSyncManager.createDirectory(body.path)
    res.json(result)
  } catch (err) {
    if (err?.name === 'InvalidRequestError' || err?.name === 'InvalidParamsError') {
      return res.status(400).json({ ok: false, message: 'Invalid folder name' })
    }
    sendError(res, err, 'Failed to create folder')
  }
}

async function updateProjectFolder(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  try {
    const { params, body } = parseReq(req, updateProjectFolderSchema)
    const result = await LocalProjectSyncManager.updateProjectFolder(
      params.Project_id,
      userId,
      {
        customFolderPath: body.customFolderPath ?? null,
        syncEnabled: body.syncEnabled,
        syncNow: body.syncNow,
        cleanOld: body.cleanOld,
      }
    )
    res.json(result)
  } catch (err) {
    if (err?.name === 'InvalidRequestError' || err?.name === 'InvalidParamsError') {
      return res.status(400).json({ ok: false, message: 'Invalid project folder settings' })
    }
    sendError(res, err, 'Failed to update project folder location')
  }
}

async function syncProject(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  try {
    const { params } = parseReq(req, syncProjectSchema)
    const syncResult = await LocalProjectSyncManager.syncProject(
      params.Project_id,
      { force: true }
    )
    const localFolder = await LocalProjectSyncManager.getProjectFolderInfo(
      params.Project_id,
      userId
    )
    if (!syncResult.ok) {
      return res.status(400).json({
        ok: false,
        message: syncResult.error || 'Failed to sync project folder',
        localFolder,
      })
    }
    res.json({
      ok: true,
      syncResult,
      localFolder,
    })
  } catch (err) {
    sendError(res, err, 'Failed to sync project')
  }
}

export default {
  getSettings: expressify(getSettings),
  updateSettings: expressify(updateSettings),
  syncAll: expressify(syncAll),
  browse: expressify(browse),
  createDirectory: expressify(createDirectory),
  updateProjectFolder: expressify(updateProjectFolder),
  syncProject: expressify(syncProject),
}
