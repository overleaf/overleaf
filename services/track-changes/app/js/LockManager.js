// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let LockManager
const Settings = require('@overleaf/settings')
const redis = require('@overleaf/redis-wrapper')
const rclient = redis.createClient(Settings.redis.lock)
const os = require('os')
const crypto = require('crypto')
const logger = require('@overleaf/logger')

const HOST = os.hostname()
const PID = process.pid
const RND = crypto.randomBytes(4).toString('hex')
let COUNT = 0

module.exports = LockManager = {
  LOCK_TEST_INTERVAL: 50, // 50ms between each test of the lock
  MAX_LOCK_WAIT_TIME: 10000, // 10s maximum time to spend trying to get the lock
  LOCK_TTL: 300, // seconds (allow 5 minutes for any operation to complete)

  // Use a signed lock value as described in
  // http://redis.io/topics/distlock#correct-implementation-with-a-single-instance
  // to prevent accidental unlocking by multiple processes
  randomLock() {
    const time = Date.now()
    return `locked:host=${HOST}:pid=${PID}:random=${RND}:time=${time}:count=${COUNT++}`
  },

  unlockScript:
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',

  tryLock(key, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const lockValue = LockManager.randomLock()
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
          return callback(err, true, lockValue)
        } else {
          return callback(err, false)
        }
      }
    )
  },

  getLock(key, callback) {
    let attempt
    if (callback == null) {
      callback = function () {}
    }
    const startTime = Date.now()
    return (attempt = function () {
      if (Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME) {
        const e = new Error('Timeout')
        e.key = key
        return callback(e)
      }

      return LockManager.tryLock(key, function (error, gotLock, lockValue) {
        if (error != null) {
          return callback(error)
        }
        if (gotLock) {
          return callback(null, lockValue)
        } else {
          return setTimeout(attempt, LockManager.LOCK_TEST_INTERVAL)
        }
      })
    })()
  },

  checkLock(key, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return rclient.exists(key, function (err, exists) {
      if (err != null) {
        return callback(err)
      }
      exists = parseInt(exists)
      if (exists === 1) {
        return callback(err, false)
      } else {
        return callback(err, true)
      }
    })
  },

  releaseLock(key, lockValue, callback) {
    return rclient.eval(
      LockManager.unlockScript,
      1,
      key,
      lockValue,
      function (err, result) {
        if (err != null) {
          return callback(err)
        }
        if (result != null && result !== 1) {
          // successful unlock should release exactly one key
          logger.error(
            { key, lockValue, redisErr: err, redisResult: result },
            'unlocking error'
          )
          return callback(new Error('tried to release timed out lock'))
        }
        return callback(err, result)
      }
    )
  },

  runWithLock(key, runner, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return LockManager.getLock(key, function (error, lockValue) {
      if (error != null) {
        return callback(error)
      }
      return runner(error1 =>
        LockManager.releaseLock(key, lockValue, function (error2) {
          error = error1 || error2
          if (error != null) {
            return callback(error)
          }
          return callback()
        })
      )
    })
  },

  healthCheck(callback) {
    const action = releaseLock => releaseLock()
    return LockManager.runWithLock(
      `HistoryLock:HealthCheck:host=${HOST}:pid=${PID}:random=${RND}`,
      action,
      callback
    )
  },

  close(callback) {
    rclient.quit()
    return rclient.once('end', callback)
  },
}
