import { Agent } from 'node:http'
import { createConnection } from 'node:net'
import { promisify } from 'node:util'
import OError from '@overleaf/o-error'
import request from 'request'
import Settings from '@overleaf/settings'

// send requests to web router if this is the api process
const OWN_PORT = Settings.port || Settings.internal.web.port || 3000
const PORT = (Settings.web && Settings.web.web_router_port) || OWN_PORT

// like the curl option `--resolve DOMAIN:PORT:127.0.0.1`
class LocalhostAgent extends Agent {
  createConnection(options, callback) {
    return createConnection(PORT, '127.0.0.1', callback)
  }
}

// degrade the 'HttpOnly; Secure;' flags of the cookie
class InsecureCookieJar extends request.jar().constructor {
  setCookie(...args) {
    const cookie = super.setCookie(...args)
    cookie.secure = false
    cookie.httpOnly = false
    return cookie
  }
}

export function requestFactory({ timeout }) {
  return promisify(
    request.defaults({
      agent: new LocalhostAgent(),
      baseUrl: `http://smoke${Settings.cookieDomain}`,
      headers: {
        // emulate the header of a https proxy
        // express wont emit a 'Secure;' cookie on a plain-text connection.
        'X-Forwarded-Proto': 'https',
      },
      jar: new InsecureCookieJar(),
      timeout,
    })
  )
}

export function assertHasStatusCode(response, expected) {
  const { statusCode: actual } = response
  if (actual !== expected) {
    throw new OError('unexpected response code', {
      url: response.request.uri.href,
      actual,
      expected,
    })
  }
}
