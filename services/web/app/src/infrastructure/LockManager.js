/* eslint-disable
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
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
const metrics = require('metrics-sharelatex')
const Settings = require('settings-sharelatex')
const RedisWrapper = require('./RedisWrapper')
const rclient = RedisWrapper.client('lock')
const logger = require('logger-sharelatex')
const os = require('os')
const crypto = require('crypto')
const async = require('async')

const HOST = os.hostname()
const PID = process.pid
const RND = crypto.randomBytes(4).toString('hex')
let COUNT = 0

const LOCK_QUEUES = new Map() // queue lock requests for each name/id so they get the lock on a first-come first-served basis

module.exports = LockManager = {
  LOCK_TEST_INTERVAL: 50, // 50ms between each test of the lock
  MAX_TEST_INTERVAL: 1000, // back off to 1s between each test of the lock
  MAX_LOCK_WAIT_TIME: 10000, // 10s maximum time to spend trying to get the lock
  REDIS_LOCK_EXPIRY: 30, // seconds. Time until lock auto expires in redis
  SLOW_EXECUTION_THRESHOLD: 5000, // 5s, if execution takes longer than this then log

  // Use a signed lock value as described in
  // http://redis.io/topics/distlock#correct-implementation-with-a-single-instance
  // to prevent accidental unlocking by multiple processes
  randomLock() {
    const time = Date.now()
    return `locked:host=${HOST}:pid=${PID}:random=${RND}:time=${time}:count=${COUNT++}`
  },

  unlockScript:
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',

  runWithLock(namespace, id, runner, callback) {
    // runner must be a function accepting a callback, e.g. runner = (cb) ->

    // This error is defined here so we get a useful stacktrace
    if (callback == null) {
      callback = function(error) {}
    }
    const slowExecutionError = new Error('slow execution during lock')

    const timer = new metrics.Timer(`lock.${namespace}`)
    const key = `lock:web:${namespace}:${id}`
    LockManager._getLock(key, namespace, function(error, lockValue) {
      if (error != null) {
        return callback(error)
      }

      // The lock can expire in redis but the process carry on. This setTimout call
      // is designed to log if this happens.
      const countIfExceededLockTimeout = function() {
        metrics.inc(`lock.${namespace}.exceeded_lock_timeout`)
        return logger.log('exceeded lock timeout', {
          namespace,
          id,
          slowExecutionError
        })
      }
      const exceededLockTimeout = setTimeout(
        countIfExceededLockTimeout,
        LockManager.REDIS_LOCK_EXPIRY * 1000
      )

      return runner((error1, ...values) =>
        LockManager._releaseLock(key, lockValue, function(error2) {
          clearTimeout(exceededLockTimeout)

          const timeTaken = new Date() - timer.start
          if (timeTaken > LockManager.SLOW_EXECUTION_THRESHOLD) {
            logger.log('slow execution during lock', {
              namespace,
              id,
              timeTaken,
              slowExecutionError
            })
          }

          timer.done()
          error = error1 || error2
          if (error != null) {
            return callback(error)
          }
          return callback(null, ...Array.from(values))
        })
      )
    })
  },

  _tryLock(key, namespace, callback) {
    if (callback == null) {
      callback = function(err, isFree, lockValue) {}
    }
    const lockValue = LockManager.randomLock()
    rclient.set(
      key,
      lockValue,
      'EX',
      LockManager.REDIS_LOCK_EXPIRY,
      'NX',
      function(err, gotLock) {
        if (err != null) {
          return callback(err)
        }
        if (gotLock === 'OK') {
          metrics.inc(`lock.${namespace}.try.success`)
          return callback(err, true, lockValue)
        } else {
          metrics.inc(`lock.${namespace}.try.failed`)
          logger.log({ key, redis_response: gotLock }, 'lock is locked')
          return callback(err, false)
        }
      }
    )
  },

  // it's sufficient to serialize within a process because that is where the parallel operations occur
  _getLock(key, namespace, callback) {
    // this is what we need to do for each lock we want to request
    if (callback == null) {
      callback = function(error, lockValue) {}
    }
    const task = next =>
      LockManager._getLockByPolling(key, namespace, function(error, lockValue) {
        // tell the queue to start trying to get the next lock (if any)
        next()
        // we have got a lock result, so we can continue with our own execution
        return callback(error, lockValue)
      })
    // create a queue for this key if needed
    const queueName = `${key}:${namespace}`
    let queue = LOCK_QUEUES.get(queueName)
    if (queue == null) {
      const handler = (fn, cb) => fn(cb)
      // set up a new queue for this key
      queue = async.queue(handler, 1)
      queue.push(task)
      // remove the queue object when queue is empty
      queue.drain = () => LOCK_QUEUES.delete(queueName)
      // store the queue in our global map
      return LOCK_QUEUES.set(queueName, queue)
    } else {
      // queue the request to get the lock
      return queue.push(task)
    }
  },

  _getLockByPolling(key, namespace, callback) {
    let attempt
    if (callback == null) {
      callback = function(error, lockValue) {}
    }
    const startTime = Date.now()
    const testInterval = LockManager.LOCK_TEST_INTERVAL
    let attempts = 0
    return (attempt = function() {
      if (Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME) {
        metrics.inc(`lock.${namespace}.get.failed`)
        return callback(new Error('Timeout'))
      }

      attempts += 1
      return LockManager._tryLock(key, namespace, function(
        error,
        gotLock,
        lockValue
      ) {
        if (error != null) {
          return callback(error)
        }
        if (gotLock) {
          metrics.gauge(`lock.${namespace}.get.success.tries`, attempts)
          return callback(null, lockValue)
        } else {
          return setTimeout(attempt, testInterval)
        }
      })
    })()
  },

  _releaseLock(key, lockValue, callback) {
    rclient.eval(LockManager.unlockScript, 1, key, lockValue, function(
      err,
      result
    ) {
      if (err != null) {
        return callback(err)
      } else if (result != null && result !== 1) {
        // successful unlock should release exactly one key
        logger.warn(
          { key, lockValue, redis_err: err, redis_result: result },
          'unlocking error'
        )
        metrics.inc('unlock-error')
        return callback(new Error('tried to release timed out lock'))
      } else {
        return callback(null, result)
      }
    })
  }
}
