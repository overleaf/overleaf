/* eslint-disable
    camelcase,
    handle-callback-err,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let LockManager
const metrics = require('./Metrics')
const Settings = require('@overleaf/settings')
const redis = require('@overleaf/redis-wrapper')
const rclient = redis.createClient(Settings.redis.lock)
const keys = Settings.redis.lock.key_schema
const logger = require('logger-sharelatex')
const os = require('os')
const crypto = require('crypto')

const Profiler = require('./Profiler')

const HOST = os.hostname()
const PID = process.pid
const RND = crypto.randomBytes(4).toString('hex')
let COUNT = 0

const MAX_REDIS_REQUEST_LENGTH = 5000 // 5 seconds

module.exports = LockManager = {
  LOCK_TEST_INTERVAL: 50, // 50ms between each test of the lock
  MAX_TEST_INTERVAL: 1000, // back off to 1s between each test of the lock
  MAX_LOCK_WAIT_TIME: 10000, // 10s maximum time to spend trying to get the lock
  LOCK_TTL: 30, // seconds. Time until lock auto expires in redis.

  // Use a signed lock value as described in
  // http://redis.io/topics/distlock#correct-implementation-with-a-single-instance
  // to prevent accidental unlocking by multiple processes
  randomLock() {
    const time = Date.now()
    return `locked:host=${HOST}:pid=${PID}:random=${RND}:time=${time}:count=${COUNT++}`
  },

  unlockScript:
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',

  tryLock(doc_id, callback) {
    if (callback == null) {
      callback = function (err, isFree) {}
    }
    const lockValue = LockManager.randomLock()
    const key = keys.blockingKey({ doc_id })
    const profile = new Profiler('tryLock', { doc_id, key, lockValue })
    return rclient.set(
      key,
      lockValue,
      'EX',
      this.LOCK_TTL,
      'NX',
      function (err, gotLock) {
        if (err != null) {
          return callback(err)
        }
        if (gotLock === 'OK') {
          metrics.inc('doc-not-blocking')
          const timeTaken = profile.log('got lock').end()
          if (timeTaken > MAX_REDIS_REQUEST_LENGTH) {
            // took too long, so try to free the lock
            return LockManager.releaseLock(
              doc_id,
              lockValue,
              function (err, result) {
                if (err != null) {
                  return callback(err)
                } // error freeing lock
                return callback(null, false)
              }
            ) // tell caller they didn't get the lock
          } else {
            return callback(null, true, lockValue)
          }
        } else {
          metrics.inc('doc-blocking')
          profile.log('doc is locked').end()
          return callback(null, false)
        }
      }
    )
  },

  getLock(doc_id, callback) {
    let attempt
    if (callback == null) {
      callback = function (error, lockValue) {}
    }
    const startTime = Date.now()
    let testInterval = LockManager.LOCK_TEST_INTERVAL
    const profile = new Profiler('getLock', { doc_id })
    return (attempt = function () {
      if (Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME) {
        const e = new Error('Timeout')
        e.doc_id = doc_id
        profile.log('timeout').end()
        return callback(e)
      }

      return LockManager.tryLock(doc_id, function (error, gotLock, lockValue) {
        if (error != null) {
          return callback(error)
        }
        profile.log('tryLock')
        if (gotLock) {
          profile.end()
          return callback(null, lockValue)
        } else {
          setTimeout(attempt, testInterval)
          // back off when the lock is taken to avoid overloading
          return (testInterval = Math.min(
            testInterval * 2,
            LockManager.MAX_TEST_INTERVAL
          ))
        }
      })
    })()
  },

  checkLock(doc_id, callback) {
    if (callback == null) {
      callback = function (err, isFree) {}
    }
    const key = keys.blockingKey({ doc_id })
    return rclient.exists(key, function (err, exists) {
      if (err != null) {
        return callback(err)
      }
      exists = parseInt(exists)
      if (exists === 1) {
        metrics.inc('doc-blocking')
        return callback(null, false)
      } else {
        metrics.inc('doc-not-blocking')
        return callback(null, true)
      }
    })
  },

  releaseLock(doc_id, lockValue, callback) {
    const key = keys.blockingKey({ doc_id })
    const profile = new Profiler('releaseLock', { doc_id, key, lockValue })
    return rclient.eval(
      LockManager.unlockScript,
      1,
      key,
      lockValue,
      function (err, result) {
        if (err != null) {
          return callback(err)
        } else if (result != null && result !== 1) {
          // successful unlock should release exactly one key
          profile.log('unlockScript:expired-lock').end()
          logger.error(
            { doc_id, key, lockValue, redis_err: err, redis_result: result },
            'unlocking error'
          )
          metrics.inc('unlock-error')
          return callback(new Error('tried to release timed out lock'))
        } else {
          profile.log('unlockScript:ok').end()
          return callback(null, result)
        }
      }
    )
  },
}
