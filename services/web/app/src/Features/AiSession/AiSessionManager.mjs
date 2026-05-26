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
import net from 'node:net'
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

  // Cross-process race: web restart may have left a labelled container
  // running before adoption ran. Look it up directly before spawning a
  // duplicate.
  const orphan = await findLabelledContainer({ userId, projectId }, cfg)
  if (orphan) {
    const adopted = await adoptContainer(orphan, cfg)
    if (adopted) return adopted
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

  // code-server inside the container takes ~2s after `container.start()`
  // before it binds the TCP port. Returning the iframe URL before that
  // window makes the browser's first request hit ECONNREFUSED and render
  // "AI session unavailable" (which then sticks until the user reloads).
  // Block here until the upstream is reachable, with a generous timeout.
  await waitForUpstream(ip, internalPort, 20000)

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

function probeTcp(host, port, timeoutMs) {
  return new Promise(resolve => {
    const sock = net.connect({ host, port })
    let done = false
    const finish = ok => {
      if (done) return
      done = true
      sock.destroy()
      resolve(ok)
    }
    sock.once('connect', () => finish(true))
    sock.once('error', () => finish(false))
    sock.setTimeout(timeoutMs, () => finish(false))
  })
}

async function waitForUpstream(host, port, totalMs) {
  const deadline = Date.now() + totalMs
  let attempt = 0
  while (Date.now() < deadline) {
    attempt++
    if (await probeTcp(host, port, 1000)) return
    await new Promise(r => setTimeout(r, 250))
  }
  throw new OError('upstream did not start listening in time', {
    host,
    port,
    waitedMs: totalMs,
  })
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

// Look up a single labelled container for a given (user, project).
async function findLabelledContainer({ userId, projectId }, cfg) {
  try {
    const containers = await docker.listContainers({
      all: false,
      filters: {
        label: [
          `${LABEL_USER}=${userId}`,
          `${LABEL_PROJECT}=${projectId}`,
        ],
      },
    })
    return containers[0] || null
  } catch (err) {
    logger.warn({ err, projectId, userId }, 'docker listContainers failed')
    return null
  }
}

// Inspect a container record and register it in our in-memory state.
// Returns the session, or null if it can't be used (no IP, missing labels).
async function adoptContainer(c, cfg) {
  const sessionId = c.Labels?.[LABEL_SESSION]
  const projectId = c.Labels?.[LABEL_PROJECT]
  const userId = c.Labels?.[LABEL_USER]
  if (!sessionId || !projectId || !userId) return null
  try {
    const inspected = await docker.getContainer(c.Id).inspect()
    const net = inspected.NetworkSettings?.Networks?.[cfg.network]
    const ip = net?.IPAddress
    if (!ip) return null
    const internalPort = cfg.containerPort || 8080
    const session = {
      sessionId,
      containerId: c.Id,
      projectId,
      userId,
      internalUrl: `http://${ip}:${internalPort}`,
      lastHeartbeat: Date.now(),
      createdAt: Date.parse(inspected.State?.StartedAt) || Date.now(),
    }
    sessions.set(sessionId, session)
    sessionIndex.set(indexKey(userId, projectId), sessionId)
    logger.info({ sessionId, projectId, userId }, 'adopted ai-session')
    return session
  } catch (err) {
    logger.warn({ err, containerId: c.Id }, 'failed to adopt')
    return null
  }
}

// On boot, scan for any labelled containers and adopt them. Awaited by
// initialize() so requests served after startup see a populated index.
async function adoptOrphans(cfg) {
  try {
    const containers = await docker.listContainers({
      filters: { label: [`${LABEL_SESSION}`] },
    })
    for (const c of containers) {
      await adoptContainer(c, cfg)
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
  await adoptOrphans(Settings.aiSession)
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
