// HTTP handlers for AI session lifecycle. All routes are project-scoped and
// gated by the same auth middleware Overleaf uses for the editor itself.

import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import AiSessionManager from './AiSessionManager.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'

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

export default {
  startSession,
  stopSession,
  getStatus,
  recordHeartbeat,
}
