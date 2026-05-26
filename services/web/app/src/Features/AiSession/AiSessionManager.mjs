// Per-(user, project) Claude Code container orchestration.
//
// Single-tenant Docker. State is in-memory and intentionally not persisted
// — if the web process restarts, containers continue running but the
// orchestrator forgets about them. A reconcile-on-startup pass below picks
// them up again by labelling.
//
// All container access is gated by AiSessionProxy, which checks the user's
// Overleaf session before forwarding any request to a container.

import crypto from 'node:crypto'
import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import Docker from 'dockerode'

const LABEL_PREFIX = 'com.overleaf.ai-session'
const LABEL_PROJECT = `${LABEL_PREFIX}.project`
const LABEL_USER = `${LABEL_PREFIX}.user`
const LABEL_SESSION = `${LABEL_PREFIX}.session`

const docker = new Docker(
  Settings.aiSession?.dockerSocket
    ? { socketPath: Settings.aiSession.dockerSocket }
    : {} // dockerode falls back to DOCKER_HOST or /var/run/docker.sock
)

// sessionId -> { containerId, projectId, userId, internalUrl,
//                lastHeartbeat, createdAt }
const sessions = new Map()
// `${userId}:${projectId}` -> sessionId (so we reuse instead of double-spawning)
const sessionIndex = new Map()

function indexKey(userId, projectId) {
  return `${userId}:${projectId}`
}

function reqSessionConfig() {
  const cfg = Settings.aiSession
  if (!cfg || !cfg.image) {
    throw new OError('aiSession.image not configured')
  }
  if (!cfg.network) {
    throw new OError('aiSession.network not configured')
  }
  return cfg
}

async function ensureSession({ userId, projectId }) {
  const cfg = reqSessionConfig()
  const key = indexKey(userId, projectId)

  // Reuse: existing alive session for this (user, project).
  const existingId = sessionIndex.get(key)
  if (existingId) {
    const s = sessions.get(existingId)
    if (s) {
      try {
        const c = docker.getContainer(s.containerId)
        const info = await c.inspect()
        if (info.State?.Running) {
          return s
        }
      } catch (err) {
        // Container vanished — fall through and create a new one.
        logger.warn(
          { err, sessionId: existingId, projectId, userId },
          'stale session — recreating'
        )
      }
      sessions.delete(existingId)
      sessionIndex.delete(key)
    }
  }

  const sessionId = crypto.randomBytes(12).toString('hex')
  const internalPort = cfg.containerPort || 8080
  const containerName = `overleaf-ai-${sessionId}`

  const env = [
    `OVERLEAF_PROJECT_ID=${projectId}`,
    `OVERLEAF_USER_ID=${userId}`,
    `DOC_UPDATER_URL=${Settings.apis.documentupdater.url}`,
    `WEB_URL=${cfg.webInternalUrl || Settings.apis.web?.url || 'http://web:3000'}`,
    `WEB_API_USER=${Settings.apis.web?.user || ''}`,
    `WEB_API_PASSWORD=${Settings.apis.web?.pass || ''}`,
    `AI_SESSION_HEARTBEAT_URL=${cfg.webInternalUrl || Settings.apis.web?.url || 'http://web:3000'}/internal/ai/session/${sessionId}/heartbeat`,
    `CODE_SERVER_PORT=${internalPort}`,
  ]

  const labels = {
    [LABEL_PROJECT]: projectId,
    [LABEL_USER]: String(userId),
    [LABEL_SESSION]: sessionId,
  }

  const hostConfig = {
    NetworkMode: cfg.network,
    AutoRemove: true,
    Memory: (cfg.memoryMb || 1024) * 1024 * 1024,
    NanoCpus: Math.round((cfg.cpus || 1) * 1e9),
  }
  if (cfg.claudeVolumePrefix) {
    hostConfig.Binds = [
      `${cfg.claudeVolumePrefix}${userId}:/home/coder/.claude`,
    ]
  }

  logger.info({ projectId, userId, sessionId }, 'spawning ai-session container')

  const container = await docker.createContainer({
    Image: cfg.image,
    name: containerName,
    Env: env,
    Labels: labels,
    HostConfig: hostConfig,
    ExposedPorts: { [`${internalPort}/tcp`]: {} },
  })
  await container.start()

  // Resolve the container's IP on the configured network.
  const info = await container.inspect()
  const net = info.NetworkSettings?.Networks?.[cfg.network]
  const ip = net?.IPAddress
  if (!ip) {
    throw new OError('container started but has no IP on the configured network', {
      network: cfg.network,
    })
  }

  const session = {
    sessionId,
    containerId: info.Id,
    projectId,
    userId: String(userId),
    internalUrl: `http://${ip}:${internalPort}`,
    lastHeartbeat: Date.now(),
    createdAt: Date.now(),
  }
  sessions.set(sessionId, session)
  sessionIndex.set(key, sessionId)
  return session
}

function getSession(sessionId) {
  return sessions.get(sessionId) || null
}

function getSessionForUserProject(userId, projectId) {
  const id = sessionIndex.get(indexKey(userId, projectId))
  return id ? sessions.get(id) : null
}

function recordHeartbeat(sessionId) {
  const s = sessions.get(sessionId)
  if (s) {
    s.lastHeartbeat = Date.now()
  }
}

async function stopSession(sessionId, reason) {
  const s = sessions.get(sessionId)
  if (!s) return
  logger.info({ sessionId, reason }, 'stopping ai-session container')
  try {
    const c = docker.getContainer(s.containerId)
    await c.stop({ t: 5 })
  } catch (err) {
    logger.warn({ err, sessionId }, 'error stopping container (may be gone)')
  }
  sessions.delete(sessionId)
  sessionIndex.delete(indexKey(s.userId, s.projectId))
}

// On boot, look for orphaned ai-session containers (from a previous web
// process) and adopt them. Cheap, optional.
async function adoptOrphans() {
  try {
    const containers = await docker.listContainers({
      filters: { label: [`${LABEL_PREFIX}.session`] },
    })
    for (const c of containers) {
      const sessionId = c.Labels[LABEL_SESSION]
      const projectId = c.Labels[LABEL_PROJECT]
      const userId = c.Labels[LABEL_USER]
      if (!sessionId || !projectId || !userId) continue
      try {
        const inspected = await docker.getContainer(c.Id).inspect()
        const net =
          inspected.NetworkSettings?.Networks?.[Settings.aiSession.network]
        const ip = net?.IPAddress
        if (!ip) continue
        const internalPort = Settings.aiSession.containerPort || 8080
        sessions.set(sessionId, {
          sessionId,
          containerId: c.Id,
          projectId,
          userId,
          internalUrl: `http://${ip}:${internalPort}`,
          lastHeartbeat: Date.now(),
          createdAt: Date.parse(inspected.State?.StartedAt) || Date.now(),
        })
        sessionIndex.set(indexKey(userId, projectId), sessionId)
        logger.info({ sessionId, projectId, userId }, 'adopted ai-session')
      } catch (err) {
        logger.warn({ err, containerId: c.Id }, 'failed to adopt')
      }
    }
  } catch (err) {
    logger.warn({ err }, 'orphan adoption skipped (docker unavailable?)')
  }
}

let initialized = false
async function initialize() {
  if (initialized) return
  initialized = true
  if (!Settings.aiSession) {
    logger.info('ai-session disabled (no aiSession config)')
    return
  }
  await adoptOrphans()
  logger.info({ adopted: sessions.size }, 'AiSessionManager initialized')
}

export default {
  initialize,
  ensureSession,
  getSession,
  getSessionForUserProject,
  recordHeartbeat,
  stopSession,
  _sessions: sessions, // exposed for tests
}
