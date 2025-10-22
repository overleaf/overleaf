import session from 'express-session'
import RedisStoreFactory from 'connect-redis'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import SessionManager from '../Features/Authentication/SessionManager.mjs'
import Metrics from '@overleaf/metrics'

const RedisStore = RedisStoreFactory(session)

const MAX_SESSION_SIZE_THRESHOLD = 4096

// Define a custom session store to record session metrics and log large
// anonymous sessions for debugging purposes
// Also make the SET calls more robust/consistent by adding flags
// - XX: ensure update in place, expect that the old session value is still in redis at that key
// - NX: ensure initial set, expect that there is no other session at that key already
class CustomSessionStore extends RedisStore {
  static largestSessionSize = 3 * 1024 // ignore sessions smaller than 3KB
  #initialSetStore
  #updateInPlaceStore

  constructor({ client }) {
    super({ client })
    this.#initialSetStore = new RedisStore({
      client: new CustomSetRedisClient(client, 'NX'),
    })
    this.#updateInPlaceStore = new RedisStore({
      client: new CustomSetRedisClient(client, 'XX'),
    })
  }

  static metric(method, sess) {
    let type // type of session: 'logged-in', 'anonymous', or 'na' (not available)
    if (sess) {
      type = SessionManager.isUserLoggedIn(sess) ? 'logged-in' : 'anonymous'
    } else {
      type = 'na'
    }
    const size = sess ? JSON.stringify(sess).length : 0
    // record the number of redis session operations
    Metrics.inc('session.store.count', 1, {
      method,
      type,
      status: size > MAX_SESSION_SIZE_THRESHOLD ? 'oversize' : 'normal',
    })
    // record the redis session bandwidth for get/set operations
    if (method === 'get' || method === 'set') {
      Metrics.count('session.store.bytes', size, { method, type })
    }
    // log the largest anonymous session seen so far
    if (type === 'anonymous' && size > CustomSessionStore.largestSessionSize) {
      CustomSessionStore.largestSessionSize = size
      logger.warn(
        { redactedSession: redactSession(sess), largestSessionSize: size },
        'largest session size seen'
      )
    }
  }

  get(sid, cb) {
    super.get(sid, (err, sess) => {
      if (err || !sess || !checkValidationToken(sid, sess)) return cb(err, null)
      CustomSessionStore.metric('get', sess)
      cb(null, sess)
    })
  }

  set(sid, sess, cb) {
    // Refresh the validation token just before writing to Redis
    // This will ensure that the token is always matching to the sessionID that we write the session value for.
    // Potential reasons for missing/mismatching token:
    // - brand-new session
    // - cycling of the sessionID as part of the login flow
    // - upgrade from a client side session to a redis session
    // - accidental writes in the app code
    sess.validationToken = computeValidationToken(sid)

    CustomSessionStore.metric('set', sess)
    const originalId = sess.req.signedCookies[Settings.cookieName]
    if (sid === originalId || sid === sess.req.newSessionId) {
      this.#updateInPlaceStore.set(sid, sess, cb)
    } else {
      Metrics.inc('security.session', 1, { status: 'new' })
      // Multiple writes can get issued with the new sid. Keep track of it.
      Object.defineProperty(sess.req, 'newSessionId', { value: sid })
      this.#initialSetStore.set(sid, sess, cb)
    }
  }

  touch(sid, sess, cb) {
    CustomSessionStore.metric('touch', sess)
    super.touch(sid, sess, cb)
  }

  destroy(sid, cb) {
    // for the destroy method we don't have access to the session object itself
    CustomSessionStore.metric('destroy')
    super.destroy(sid, cb)
  }
}

function computeValidationToken(sid) {
  // This should be a deterministic function of the client-side sessionID,
  // prepended with a version number in case we want to change it later.
  return 'v1:' + sid.slice(-4)
}

function checkValidationToken(sid, sess) {
  const sessionToken = sess.validationToken
  if (sessionToken) {
    const clientToken = computeValidationToken(sid)
    // Reject sessions where the validation token is out of sync with the sessionID.
    // If you change the method for computing the token (above) then you need to either check or ignore previous versions of the token.
    if (sessionToken === clientToken) {
      Metrics.inc('security.session', 1, { status: 'ok' })
      return true
    } else {
      logger.warn(
        { sid, sessionToken, clientToken },
        'session token validation failed'
      )
      Metrics.inc('security.session', 1, { status: 'error' })
      return false
    }
  } else {
    Metrics.inc('security.session', 1, { status: 'missing' })
    return false
  }
}

// Helper function to return a redacted version of session object
// so we can identify the largest keys without exposing sensitive
// data
function redactSession(sess) {
  // replace all string values with '***' of the same length
  return JSON.parse(
    JSON.stringify(sess, (key, value) => {
      if (typeof value === 'string') {
        return '*'.repeat(value.length)
      }
      return value
    })
  )
}

class CustomSetRedisClient {
  #client
  #flag
  constructor(client, flag) {
    this.#client = client
    this.#flag = flag
  }

  set(args, cb) {
    args.push(this.#flag)
    this.#client.set(args, (err, ok) => {
      Metrics.inc('session.store.set', 1, {
        path: this.#flag,
        status: err ? 'error' : ok ? 'success' : 'failure',
      })
      cb(err, ok)
    })
  }
}

export default CustomSessionStore
