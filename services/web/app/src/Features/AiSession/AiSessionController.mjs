// HTTP handlers for AI session lifecycle. All user-facing routes are
// project-scoped and gated by the same auth middleware Overleaf uses for
// the editor itself. The /internal/* routes are basic-auth-protected and
// take userId in the request body — they're called by the sync daemon.

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import AiSessionManager from './AiSessionManager.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import EditorController from '../Editor/EditorController.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import FileStoreController from '../FileStore/FileStoreController.mjs'

function _projectId(req) {
  return req.params.Project_id || req.params.projectId
}

async function startSession(req, res, next) {
  try {
    if (!Settings.aiSession) {
      return res.status(501).json({ error: 'ai-session not configured' })
    }
    const projectId = _projectId(req)
    const userId = SessionManager.getLoggedInUserId(req.session)
    if (!userId) return res.status(401).json({ error: 'login required' })

    const session = await AiSessionManager.ensureSession({ userId, projectId })
    res.json({
      sessionId: session.sessionId,
      // Browser-facing iframe URL — served via AiSessionProxy on the same
      // origin as the editor (no cross-origin / cookie hassle).
      iframeUrl: `/ai/session/${session.sessionId}/`,
      createdAt: session.createdAt,
    })
  } catch (err) {
    OError.tag(err, 'failed to start ai-session')
    next(err)
  }
}

async function stopSession(req, res, next) {
  try {
    const projectId = _projectId(req)
    const userId = SessionManager.getLoggedInUserId(req.session)
    if (!userId) return res.status(401).json({ error: 'login required' })
    const session = AiSessionManager.getSessionForUserProject(userId, projectId)
    if (!session) return res.status(204).end()
    await AiSessionManager.stopSession(session.sessionId, 'user-stopped')
    res.status(204).end()
  } catch (err) {
    OError.tag(err, 'failed to stop ai-session')
    next(err)
  }
}

function getStatus(req, res) {
  const projectId = _projectId(req)
  const userId = SessionManager.getLoggedInUserId(req.session)
  if (!userId) return res.status(401).json({ error: 'login required' })
  const session = AiSessionManager.getSessionForUserProject(userId, projectId)
  if (!session) return res.json({ active: false })
  const now = Date.now()
  const heartbeatAgeMs = now - session.lastHeartbeat
  const healthy = heartbeatAgeMs < (Settings.aiSession?.unhealthyAfterMs || 60_000)
  res.json({
    active: true,
    healthy,
    sessionId: session.sessionId,
    iframeUrl: `/ai/session/${session.sessionId}/`,
    createdAt: session.createdAt,
    heartbeatAgeMs,
  })
}

// Internal-only: called by the sync daemon. Authenticated by basic auth
// (the same shared secret doc-updater uses), not by user session.
function recordHeartbeat(req, res) {
  const sessionId = req.params.sessionId
  const session = AiSessionManager.getSession(sessionId)
  if (!session) {
    logger.warn({ sessionId }, 'heartbeat for unknown session')
    return res.status(404).end()
  }
  AiSessionManager.recordHeartbeat(sessionId)
  res.status(204).end()
}

// ---- Internal endpoints used by the sync daemon for structural sync ----
//
// These mirror the user-facing /project/:id/doc, /folder, etc. endpoints
// but take userId in the body (basic-auth context, no user session). All
// changes go through the same EditorController paths so collaborators see
// them via the existing reciveNewDoc / removeEntity events.

const SOURCE = 'claude-sync'

async function internalAddDoc(req, res, next) {
  try {
    const projectId = req.params.Project_id
    const { userId, name, parent_folder_id: parentFolderId, lines } = req.body
    if (!userId || !name || !parentFolderId) {
      return res.status(400).json({ error: 'userId, name, parent_folder_id required' })
    }
    const doc = await EditorController.promises.addDoc(
      projectId,
      parentFolderId,
      name,
      Array.isArray(lines) ? lines : [],
      SOURCE,
      userId
    )
    res.json(doc)
  } catch (err) {
    OError.tag(err, 'ai-sync internalAddDoc failed')
    next(err)
  }
}

async function internalAddFolder(req, res, next) {
  try {
    const projectId = req.params.Project_id
    const { userId, name, parent_folder_id: parentFolderId } = req.body
    if (!userId || !name || !parentFolderId) {
      return res.status(400).json({ error: 'userId, name, parent_folder_id required' })
    }
    const folder = await EditorController.promises.addFolder(
      projectId,
      parentFolderId,
      name,
      SOURCE,
      userId
    )
    res.json(folder)
  } catch (err) {
    OError.tag(err, 'ai-sync internalAddFolder failed')
    next(err)
  }
}

async function internalDeleteEntity(req, res, next) {
  try {
    const projectId = req.params.Project_id
    const { entity_type: entityType, entity_id: entityId } = req.params
    const { userId } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'userId required' })
    if (!['doc', 'file', 'folder'].includes(entityType)) {
      return res.status(400).json({ error: 'invalid entity_type' })
    }
    await EditorController.promises.deleteEntity(
      projectId,
      entityId,
      entityType,
      SOURCE,
      userId
    )
    res.status(204).end()
  } catch (err) {
    OError.tag(err, 'ai-sync internalDeleteEntity failed')
    next(err)
  }
}

async function internalGetStructure(req, res, next) {
  try {
    const projectId = req.params.Project_id
    const project = await ProjectGetter.promises.getProject(projectId, {
      rootFolder: true,
    })
    if (!project) return res.status(404).json({ error: 'project not found' })
    res.json({ rootFolder: project.rootFolder })
  } catch (err) {
    OError.tag(err, 'ai-sync internalGetStructure failed')
    next(err)
  }
}

// Reuses the public FileStoreController.getFile handler, which only reads
// from req.params / req.query and writes a stream to res. Auth is enforced
// at the route level (basic auth on privateApiRouter).
function internalGetFile(req, res, next) {
  // The controller expects req.logger.addFields; provide a no-op if missing.
  if (!req.logger) req.logger = { addFields: () => {} }
  return FileStoreController.getFile(req, res, next)
}

// Upload a binary file (or replace one). Body is the raw file content;
// query string carries name, parent_folder_id, userId. Used by the sync
// daemon when Claude produces a non-text file in the workspace. Works on
// Overleaf CE (no git-bridge required).
async function internalAddFile(req, res, next) {
  const projectId = req.params.Project_id
  const {
    userId,
    name,
    parent_folder_id: parentFolderId,
  } = req.query
  if (!userId || !name || !parentFolderId) {
    return res
      .status(400)
      .json({ error: 'userId, name, parent_folder_id required (query)' })
  }

  // Stream the request body to a tempfile — upsertFile takes an fsPath.
  const tmpPath = path.join(
    os.tmpdir(),
    `ai-sync-upload-${crypto.randomBytes(8).toString('hex')}`
  )
  try {
    await pipeline(req, fs.createWriteStream(tmpPath))
    const newFile = await EditorController.promises.upsertFile(
      projectId,
      parentFolderId,
      name,
      tmpPath,
      null, // linkedFileData
      SOURCE,
      userId
    )
    res.json(newFile)
  } catch (err) {
    OError.tag(err, 'ai-sync internalAddFile failed', {
      projectId,
      name,
      parentFolderId,
    })
    next(err)
  } finally {
    fsp.unlink(tmpPath).catch(() => {
      /* ignore */
    })
  }
}

export default {
  startSession,
  stopSession,
  getStatus,
  recordHeartbeat,
  internalAddDoc,
  internalAddFolder,
  internalDeleteEntity,
  internalGetStructure,
  internalGetFile,
  internalAddFile,
}
