// Periodic liveness ping to the web service so AiSessionManager can flag the
// session as unhealthy if the daemon dies without the container exiting.

const http = require('node:http')
const https = require('node:https')
const { URL } = require('node:url')

const INTERVAL_MS = 15_000

function startHeartbeat({ url, auth, log }) {
  const send = () => {
    try {
      const u = new URL(url)
      const lib = u.protocol === 'https:' ? https : http
      const req = lib.request(
        {
          method: 'POST',
          hostname: u.hostname,
          port: u.port,
          path: u.pathname + u.search,
          headers: {
            'content-length': 0,
            authorization:
              'Basic ' +
              Buffer.from(`${auth.user}:${auth.password || ''}`).toString(
                'base64'
              ),
          },
        },
        res => {
          res.resume()
          if (res.statusCode >= 400) {
            log('heartbeat non-2xx', { status: res.statusCode })
          }
        }
      )
      req.on('error', err => log('heartbeat error', { err: err.message }))
      req.end()
    } catch (err) {
      log('heartbeat threw', { err: err.message })
    }
  }
  send()
  return setInterval(send, INTERVAL_MS).unref()
}

module.exports = { startHeartbeat }
