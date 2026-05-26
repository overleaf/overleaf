// Reverse proxy from /ai/session/:sessionId/* to the per-user code-server
// container, with auth enforcement: every HTTP request and every WebSocket
// upgrade is checked against the caller's Overleaf session before being
// forwarded.
//
// Why a reverse proxy and not direct exposure: code-server runs --auth none
// inside the container (port not exposed publicly). All access goes through
// here so we can verify the caller is logged in, owns the session, and
// hasn't been kicked out of the project.

import http from 'node:http'
import logger from '@overleaf/logger'
import AiSessionManager from './AiSessionManager.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'

const MOUNT = '/ai/session/'

// One keep-alive agent per code-server container. Reusing TCP connections
// across the ~50+ asset requests VS Code makes on first load cuts latency
// significantly — without this each request pays a fresh TCP handshake.
const agents = new Map() // internalUrl -> http.Agent

function getAgent(internalUrl) {
  if (!agents.has(internalUrl)) {
    agents.set(
      internalUrl,
      new http.Agent({ keepAlive: true, maxSockets: 16 })
    )
  }
  return agents.get(internalUrl)
}

// Called by AiSessionManager when a container is stopped so we don't leak.
function destroyAgent(internalUrl) {
  const agent = agents.get(internalUrl)
  if (agent) {
    agent.destroy()
    agents.delete(internalUrl)
  }
}

function parseMount(reqUrl) {
  if (!reqUrl.startsWith(MOUNT)) return null
  const rest = reqUrl.slice(MOUNT.length)
  const slash = rest.indexOf('/')
  const sessionId = slash === -1 ? rest : rest.slice(0, slash)
  const remainder = slash === -1 ? '/' : rest.slice(slash)
  if (!/^[a-f0-9]{16,}$/.test(sessionId)) return null
  return { sessionId, remainder }
}

function authorize(req, sessionId) {
  // The session cookie has already been parsed by express-session middleware
  // for ordinary requests. For WS upgrades we re-parse via the same store —
  // see attachUpgradeHandler below. Here we just look at req.session.
  const userId = SessionManager.getLoggedInUserId(req.session)
  if (!userId) return { ok: false, status: 401 }
  const session = AiSessionManager.getSession(sessionId)
  if (!session) return { ok: false, status: 404 }
  if (String(session.userId) !== String(userId)) {
    return { ok: false, status: 403 }
  }
  return { ok: true, session }
}

// Express middleware for the HTTP side. Mounted at '/ai/session/...'.
function httpMiddleware(req, res, next) {
  const parsed = parseMount(req.originalUrl || req.url)
  if (!parsed) return next()

  const auth = authorize(req, parsed.sessionId)
  if (!auth.ok) {
    res.status(auth.status).end()
    return
  }
  const { session } = auth

  const target = new URL(parsed.remainder, session.internalUrl)
  const headers = { ...req.headers, host: target.host }
  // Drop hop-by-hop headers — Node sets some of them itself on the outgoing
  // request, including Connection.
  delete headers['content-length'] // re-set per actual stream
  delete headers.connection

  const upstream = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: target.pathname + target.search,
      headers,
      agent: getAgent(session.internalUrl),
    },
    upRes => {
      res.writeHead(upRes.statusCode, upRes.headers)
      upRes.pipe(res)
    }
  )
  upstream.on('error', err => {
    logger.warn({ err, sessionId: session.sessionId }, 'ai-session proxy error')
    if (!res.headersSent) res.status(502).end('AI session unavailable')
    else res.destroy()
  })
  req.pipe(upstream)
}

// Attach a WebSocket upgrade handler on the http.Server. Express alone can't
// proxy WS upgrades — they bypass the request pipeline.
//
// `sessionMiddleware` is the same express-session middleware used by the
// rest of the app; we run it manually to populate req.session.
function attachUpgradeHandler(server, sessionMiddleware) {
  server.on('upgrade', (req, socket, head) => {
    if (!req.url || !req.url.startsWith(MOUNT)) return
    const parsed = parseMount(req.url)
    if (!parsed) {
      socket.destroy()
      return
    }
    const fakeRes = { getHeader() {}, setHeader() {}, end() {} }
    sessionMiddleware(req, fakeRes, () => {
      const auth = authorize(req, parsed.sessionId)
      if (!auth.ok) {
        socket.write(
          `HTTP/1.1 ${auth.status} ${auth.status === 401 ? 'Unauthorized' : 'Forbidden'}\r\n\r\n`
        )
        socket.destroy()
        return
      }
      const { session } = auth

      const target = new URL(parsed.remainder, session.internalUrl)
      const upstream = http.request({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        method: 'GET',
        path: target.pathname + target.search,
        headers: { ...req.headers, host: target.host },
        agent: getAgent(session.internalUrl),
      })
      upstream.on('upgrade', (upRes, upSocket, upHead) => {
        const handshake = [
          `HTTP/1.1 ${upRes.statusCode} ${upRes.statusMessage}`,
          ...Object.entries(upRes.headers).map(([k, v]) => `${k}: ${v}`),
          '',
          '',
        ].join('\r\n')
        socket.write(handshake)
        if (upHead && upHead.length) socket.write(upHead)
        upSocket.pipe(socket).pipe(upSocket)
      })
      upstream.on('error', err => {
        logger.warn(
          { err, sessionId: session.sessionId },
          'ai-session ws upstream error'
        )
        socket.destroy()
      })
      upstream.end()
    })
  })
}

export default {
  MOUNT,
  httpMiddleware,
  attachUpgradeHandler,
  _parseMount: parseMount,
}
