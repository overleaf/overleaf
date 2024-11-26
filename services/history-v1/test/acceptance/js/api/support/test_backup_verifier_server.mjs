// @ts-check
import { startApp } from '../../../../../backup-verifier-app.mjs'

/** @type {import("http").Server} */
let server

/**
 * @param {string} pathname
 * @return {string}
 */
function testUrl(pathname) {
  const url = new URL('http://127.0.0.1')
  const addr = server.address()
  if (addr && typeof addr === 'object') {
    url.port = addr.port.toString()
  }
  url.pathname = pathname
  return url.toString()
}

async function listenOnRandomPort() {
  if (server) return // already running
  for (let i = 0; i < 10; i++) {
    try {
      server = await startApp(0)
      return
    } catch {}
  }
  server = await startApp(0)
}

after('close server', function (done) {
  if (server) {
    server.close(done)
  } else {
    done()
  }
})

export default {
  testUrl,
  listenOnRandomPort,
}
