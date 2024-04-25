const session = require('express-session')
const RedisStore = require('connect-redis')(session)
const metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const SessionManager = require('../Features/Authentication/SessionManager')

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
    metrics.inc('session.store.count', 1, {
      method,
      type,
      status: size > MAX_SESSION_SIZE_THRESHOLD ? 'oversize' : 'normal',
    })
    // record the redis session bandwidth for get/set operations
    if (method === 'get' || method === 'set') {
      metrics.count('session.store.bytes', size, { method, type })
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

  // Override the get, set, touch, and destroy methods to record metrics
  get(sid, cb) {
    super.get(sid, (err, ...args) => {
      if (args[0]) {
        CustomSessionStore.metric('get', args[0])
      }
      cb(err, ...args)
    })
  }

  set(sid, sess, cb) {
    CustomSessionStore.metric('set', sess)
    const originalId = sess.req.signedCookies[Settings.cookieName]
    if (sid === originalId || sid === sess.req.newSessionId) {
      this.#updateInPlaceStore.set(sid, sess, cb)
    } else {
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
      metrics.inc('session.store.set', 1, {
        path: this.#flag,
        status: err ? 'error' : ok ? 'success' : 'failure',
      })
      cb(err, ok)
    })
  }
}

module.exports = CustomSessionStore
