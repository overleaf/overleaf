// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let LockManager
const logger = require('@overleaf/logger')

const LockState = {} // locks for docker container operations, by container name

module.exports = LockManager = {
  MAX_LOCK_HOLD_TIME: 15000, // how long we can keep a lock
  MAX_LOCK_WAIT_TIME: 10000, // how long we wait for a lock
  LOCK_TEST_INTERVAL: 1000, // retry time

  tryLock(key, callback) {
    let lockValue
    if (callback == null) {
      callback = function () {}
    }
    const existingLock = LockState[key]
    if (existingLock != null) {
      // the lock is already taken, check how old it is
      const lockAge = Date.now() - existingLock.created
      if (lockAge < LockManager.MAX_LOCK_HOLD_TIME) {
        return callback(null, false) // we didn't get the lock, bail out
      } else {
        logger.error(
          { key, lock: existingLock, age: lockAge },
          'taking old lock by force'
        )
      }
    }
    // take the lock
    LockState[key] = lockValue = { created: Date.now() }
    return callback(null, true, lockValue)
  },

  getLock(key, callback) {
    let attempt
    if (callback == null) {
      callback = function () {}
    }
    const startTime = Date.now()
    return (attempt = () =>
      LockManager.tryLock(key, function (error, gotLock, lockValue) {
        if (error != null) {
          return callback(error)
        }
        if (gotLock) {
          return callback(null, lockValue)
        } else if (Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME) {
          const e = new Error('Lock timeout')
          e.key = key
          return callback(e)
        } else {
          return setTimeout(attempt, LockManager.LOCK_TEST_INTERVAL)
        }
      }))()
  },

  releaseLock(key, lockValue, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const existingLock = LockState[key]
    if (existingLock === lockValue) {
      // lockValue is an object, so we can test by reference
      delete LockState[key] // our lock, so we can free it
      return callback()
    } else if (existingLock != null) {
      // lock exists but doesn't match ours
      logger.error(
        { key, lock: existingLock },
        'tried to release lock taken by force'
      )
      return callback()
    } else {
      logger.error(
        { key, lock: existingLock },
        'tried to release lock that has gone'
      )
      return callback()
    }
  },

  runWithLock(key, runner, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return LockManager.getLock(key, function (error, lockValue) {
      if (error != null) {
        return callback(error)
      }
      return runner((error1, ...args) =>
        LockManager.releaseLock(key, lockValue, function (error2) {
          error = error1 || error2
          if (error != null) {
            return callback(error)
          }
          return callback(null, ...Array.from(args))
        })
      )
    })
  },
}
