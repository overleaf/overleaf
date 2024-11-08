/**
 * This file monitors HTTP connections in Node.js and logs any potential socket leaks.
 * It uses the `diagnostics_channel` module to intercept requests and reponses in the
 * `http` module and tracks the lifetime of each http socket. If a socket is open for
 * longer than a specified time, it is considered a potential leak and its details are
 * logged along with the corresponding information from /proc/net/tcp.
 */

const fs = require('node:fs')
const diagnosticsChannel = require('node:diagnostics_channel')

const SOCKET_MONITOR_INTERVAL = 60 * 1000
// set the threshold for logging leaked sockets in minutes, defaults to 15
const MIN_SOCKET_LEAK_TIME =
  (parseInt(process.env.LEAKED_SOCKET_AGE_THRESHOLD, 10) || 15) * 60 * 1000

// Record HTTP events using diagnostics_channel
diagnosticsChannel.subscribe('http.client.request.start', handleRequest)
diagnosticsChannel.subscribe('http.server.request.start', handleRequest)
diagnosticsChannel.subscribe('http.client.response.finish', handleResponse)
diagnosticsChannel.subscribe('http.server.response.finish', handleResponse)

function handleRequest({ request: req }) {
  const socket = req?.socket
  if (socket) {
    recordRequest(req, socket)
  }
}

function recordRequest(req, socket) {
  const { method, protocol, path, url, rawHeaders, _header } = req
  socket._ol_debug = {
    method,
    protocol,
    url: url ?? path,
    request: { headers: rawHeaders ?? _header, ts: new Date() },
  }
}

function handleResponse({ request: req, response: res }) {
  const socket = req?.socket || res?.socket
  if (!socket || !res) {
    return
  }
  if (!socket._ol_debug) {
    // I don't know if this will ever happen, but if we missed the request,
    // record it here.
    recordRequest(req, socket)
  }
  const { statusCode, statusMessage, headers, _header } = res
  Object.assign(socket._ol_debug, {
    response: {
      statusCode,
      statusMessage,
      headers: headers ?? _header,
      ts: new Date(),
    },
  })
}

// Additional functions to log request headers with sensitive information redacted

function flattenHeaders(rawHeaders) {
  // Headers can be an array [KEY, VALUE, KEY, VALUE, ..]
  // an object {key:value, key:value, ...}
  // or a string of the headers separated by \r\n
  // Flatten the array and object headers into the string form.
  if (Array.isArray(rawHeaders)) {
    return rawHeaders
      .map((item, index) => (index % 2 === 0 ? `${item}: ` : `${item}\r\n`))
      .join('')
  } else if (typeof rawHeaders === 'object') {
    return Object.entries(rawHeaders)
      .map(([key, value]) => `${key}: ${value}\r\n`)
      .join('')
  } else if (typeof rawHeaders === 'string') {
    return rawHeaders
  } else {
    return JSON.stringify(rawHeaders)
  }
}

const REDACT_REGEX = /^(Authorization|Set-Cookie|Cookie):.*?\r/gim

function redactObject(obj) {
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value == null) {
      result[key] = null
    } else if (key === 'headers') {
      // remove headers with sensitive information
      result[key] = flattenHeaders(value).replace(
        REDACT_REGEX,
        `$1: REDACTED\r`
      )
    } else if (
      typeof value === 'object' &&
      ['request', 'response'].includes(key)
    ) {
      result[key] = redactObject(value)
    } else {
      result[key] = value
    }
  }
  return result
}

// Check if an old socket has crossed the threshold for logging.
// We log multiple times with an exponential backoff so we can
// see how long a socket hangs around.

function isOldSocket(handle) {
  const now = new Date()
  const created = handle._ol_debug.request.ts
  const lastLoggedAt = handle._ol_debug.lastLoggedAt ?? created
  const nextLogTime = new Date(
    created.getTime() +
      Math.max(2 * (lastLoggedAt - created), MIN_SOCKET_LEAK_TIME)
  )
  return now >= nextLogTime
}

function logOldSocket(logger, handle, tcpinfo) {
  const now = new Date()
  const info = Object.assign(
    {
      localAddress: handle.localAddress,
      localPort: handle.localPort,
      remoteAddress: handle.remoteAddress,
      remotePort: handle.remotePort,
      tcpinfo,
      age: Math.floor((now - handle._ol_debug.request.ts) / (60 * 1000)), // age in minutes
    },
    redactObject(handle._ol_debug)
  )
  handle._ol_debug.lastLoggedAt = now
  if (tcpinfo) {
    logger.error(info, 'old socket handle - tcp socket')
  } else {
    logger.warn(info, 'stale socket handle - no entry in /proc/net/tcp')
  }
}

// Correlate socket handles with /proc/net/tcp entries using a key based on the
// local and remote addresses and ports. This will allow us to distinguish between
// sockets that are still open and sockets that have been closed and removed from
// the /proc/net/tcp table but are still present in the node active handles array.

async function getOpenSockets() {
  // get open sockets remote and local address:port from /proc/net/tcp
  const procNetTcp = '/proc/net/tcp'
  const openSockets = new Map()
  const lines = await fs.promises.readFile(procNetTcp, 'utf8')
  for (const line of lines.split('\n')) {
    const socket = parseProcNetTcp(line)
    if (socket) {
      openSockets.set(socket, line)
    }
  }
  return openSockets
}

function keyFromSocket(socket) {
  return `${socket.localAddress}:${socket.localPort} -> ${socket.remoteAddress}:${socket.remotePort}`
}

function decodeHexIpAddress(hex) {
  // decode hex ip address to dotted decimal notation
  const ip = parseInt(hex, 16)
  const a = ip & 0xff
  const b = (ip >> 8) & 0xff
  const c = (ip >> 16) & 0xff
  const d = (ip >> 24) & 0xff
  return `${a}.${b}.${c}.${d}`
}

function decodeHexPort(hex) {
  // decode hex port to decimal
  return parseInt(hex, 16)
}

// Regex for extracting the local and remote addresses and ports from the /proc/net/tcp output
// Example line:
// 16: AB02A8C0:D9E2 86941864:01BB 01 00000000:00000000 02:000004BE 00000000     0        0 36802 2 0000000000000000 28 4 26 10 -1
//     ^^^^^^^^^^^^^ ^^^^^^^^^^^^^
//     local          remote

const TCP_STATE_REGEX =
  /^\s*\d+:\s+(?<localHexAddress>[0-9A-F]{8}):(?<localHexPort>[0-9A-F]{4})\s+(?<remoteHexAddress>[0-9A-F]{8}):(?<remoteHexPort>[0-9A-F]{4})/i

function parseProcNetTcp(line) {
  const match = line.match(TCP_STATE_REGEX)
  if (match) {
    const { localHexAddress, localHexPort, remoteHexAddress, remoteHexPort } =
      match.groups
    return keyFromSocket({
      localAddress: decodeHexIpAddress(localHexAddress),
      localPort: decodeHexPort(localHexPort),
      remoteAddress: decodeHexIpAddress(remoteHexAddress),
      remotePort: decodeHexPort(remoteHexPort),
    })
  }
}

let LeakedSocketsMonitor

// Export the monitor and scanSockets functions

module.exports = LeakedSocketsMonitor = {
  monitor(logger) {
    const interval = setInterval(
      () => LeakedSocketsMonitor.scanSockets(logger),
      SOCKET_MONITOR_INTERVAL
    )
    const Metrics = require('./index')
    return Metrics.registerDestructor(() => clearInterval(interval))
  },
  scanSockets(logger) {
    const debugSockets = process._getActiveHandles().filter(handle => {
      return handle._ol_debug
    })

    // Bail out if there are no sockets with the _ol_debug property
    if (debugSockets.length === 0) {
      return
    }

    const oldSockets = debugSockets.filter(isOldSocket)

    // Bail out if there are no old sockets to log
    if (oldSockets.length === 0) {
      return
    }

    // If there old sockets to log, get the connections from /proc/net/tcp
    // to distinguish between sockets that are still open and sockets that
    // have been closed and removed from the /proc/net/tcp table.
    getOpenSockets()
      .then(openSockets => {
        oldSockets.forEach(handle => {
          try {
            const key = keyFromSocket(handle)
            const tcpinfo = openSockets.get(key)
            logOldSocket(logger, handle, tcpinfo)
          } catch (err) {
            logger.error({ err }, 'error in scanSockets')
          }
        })
      })
      .catch(err => {
        logger.error({ err }, 'error getting open sockets')
      })
  },
}
