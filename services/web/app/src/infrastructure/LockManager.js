const { callbackify, promisify } = require('util')
const metrics = require('metrics-sharelatex')
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

const LockManager = {
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
    const slowExecutionError = new Error('slow execution during lock')

    const timer = new metrics.Timer(`lock.${namespace}`)
    const key = `lock:web:${namespace}:${id}`
    LockManager._getLock(key, namespace, (error, lockValue) => {
      if (error != null) {
        return callback(error)
      }

      // The lock can expire in redis but the process carry on. This setTimeout call
      // is designed to log if this happens.
      function countIfExceededLockTimeout() {
        metrics.inc(`lock.${namespace}.exceeded_lock_timeout`)
        logger.log('exceeded lock timeout', {
          namespace,
          id,
          slowExecutionError
        })
      }
      const exceededLockTimeout = setTimeout(
        countIfExceededLockTimeout,
        LockManager.REDIS_LOCK_EXPIRY * 1000
      )

      runner((error1, ...values) =>
        LockManager._releaseLock(key, lockValue, error2 => {
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
          callback(null, ...values)
        })
      )
    })
  },

  _tryLock(key, namespace, callback) {
    const lockValue = LockManager.randomLock()
    rclient.set(
      key,
      lockValue,
      'EX',
      LockManager.REDIS_LOCK_EXPIRY,
      'NX',
      (err, gotLock) => {
        if (err != null) {
          return callback(err)
        }
        if (gotLock === 'OK') {
          metrics.inc(`lock.${namespace}.try.success`)
          callback(err, true, lockValue)
        } else {
          metrics.inc(`lock.${namespace}.try.failed`)
          logger.log({ key, redis_response: gotLock }, 'lock is locked')
          callback(err, false)
        }
      }
    )
  },

  // it's sufficient to serialize within a process because that is where the parallel operations occur
  _getLock(key, namespace, callback) {
    // this is what we need to do for each lock we want to request
    const task = next =>
      LockManager._getLockByPolling(key, namespace, (error, lockValue) => {
        // tell the queue to start trying to get the next lock (if any)
        next()
        // we have got a lock result, so we can continue with our own execution
        callback(error, lockValue)
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
      LOCK_QUEUES.set(queueName, queue)
    } else {
      // queue the request to get the lock
      queue.push(task)
    }
  },

  _getLockByPolling(key, namespace, callback) {
    const startTime = Date.now()
    const testInterval = LockManager.LOCK_TEST_INTERVAL
    let attempts = 0
    function attempt() {
      if (Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME) {
        metrics.inc(`lock.${namespace}.get.failed`)
        return callback(new Error('Timeout'))
      }

      attempts += 1
      LockManager._tryLock(key, namespace, (error, gotLock, lockValue) => {
        if (error != null) {
          return callback(error)
        }
        if (gotLock) {
          metrics.gauge(`lock.${namespace}.get.success.tries`, attempts)
          callback(null, lockValue)
        } else {
          setTimeout(attempt, testInterval)
        }
      })
    }
    attempt()
  },

  _releaseLock(key, lockValue, callback) {
    rclient.eval(LockManager.unlockScript, 1, key, lockValue, (err, result) => {
      if (err != null) {
        callback(err)
      } else if (result != null && result !== 1) {
        // successful unlock should release exactly one key
        logger.warn(
          { key, lockValue, redis_err: err, redis_result: result },
          'unlocking error'
        )
        metrics.inc('unlock-error')
        callback(new Error('tried to release timed out lock'))
      } else {
        callback(null, result)
      }
    })
  }
}

module.exports = LockManager

const promisifiedRunWithLock = promisify(LockManager.runWithLock)
LockManager.promises = {
  runWithLock(namespace, id, runner) {
    const cbRunner = callbackify(runner)
    return promisifiedRunWithLock(namespace, id, cbRunner)
  }
}
