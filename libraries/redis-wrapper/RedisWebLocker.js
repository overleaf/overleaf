const { callbackify, promisify } = require('node:util')
const metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const os = require('node:os')
const crypto = require('node:crypto')
const async = require('async')

const HOST = os.hostname()
const PID = process.pid
const RND = crypto.randomBytes(4).toString('hex')
let COUNT = 0

const LOCK_QUEUES = new Map() // queue lock requests for each name/id so they get the lock on a first-come first-served basis

const UNLOCK_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end'

module.exports = class RedisWebLocker {
  constructor({ rclient, getKey, options }) {
    this.rclient = rclient
    this.getKey = getKey

    // ms between each test of the lock
    this.LOCK_TEST_INTERVAL = options.lockTestInterval || 50
    // back off to ms between each test of the lock
    this.MAX_TEST_INTERVAL = options.maxTestInterval || 1000
    // ms maximum time to spend trying to get the lock
    this.MAX_LOCK_WAIT_TIME = options.maxLockWaitTime || 10000
    // seconds. Time until lock auto expires in redis
    this.REDIS_LOCK_EXPIRY = options.redisLockExpiry || 30
    // ms, if execution takes longer than this then log
    this.SLOW_EXECUTION_THRESHOLD = options.slowExecutionThreshold || 5000
    // read-only copy for unit tests
    this.unlockScript = UNLOCK_SCRIPT

    const promisifiedRunWithLock = promisify(this.runWithLock).bind(this)
    this.promises = {
      runWithLock(namespace, id, runner) {
        const cbRunner = callbackify(runner)
        return promisifiedRunWithLock(namespace, id, cbRunner)
      },
    }
  }

  // Use a signed lock value as described in
  // http://redis.io/topics/distlock#correct-implementation-with-a-single-instance
  // to prevent accidental unlocking by multiple processes
  randomLock() {
    const time = Date.now()
    return `locked:host=${HOST}:pid=${PID}:random=${RND}:time=${time}:count=${COUNT++}`
  }

  runWithLock(namespace, id, runner, callback) {
    // runner must be a function accepting a callback, e.g. runner = (cb) ->

    // This error is defined here so we get a useful stacktrace
    const slowExecutionError = new Error('slow execution during lock')

    const timer = new metrics.Timer(`lock.${namespace}`)
    const key = this.getKey(namespace, id)
    this._getLock(key, namespace, (error, lockValue) => {
      if (error != null) {
        return callback(error)
      }

      // The lock can expire in redis but the process carry on. This setTimeout call
      // is designed to log if this happens.
      function countIfExceededLockTimeout() {
        metrics.inc(`lock.${namespace}.exceeded_lock_timeout`)
        logger.debug('exceeded lock timeout', {
          namespace,
          id,
          slowExecutionError,
        })
      }
      const exceededLockTimeout = setTimeout(
        countIfExceededLockTimeout,
        this.REDIS_LOCK_EXPIRY * 1000
      )

      runner((error1, ...values) =>
        this._releaseLock(key, lockValue, error2 => {
          clearTimeout(exceededLockTimeout)

          const timeTaken = new Date() - timer.start
          if (timeTaken > this.SLOW_EXECUTION_THRESHOLD) {
            logger.debug('slow execution during lock', {
              namespace,
              id,
              timeTaken,
              slowExecutionError,
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
  }

  _tryLock(key, namespace, callback) {
    const lockValue = this.randomLock()
    this.rclient.set(
      key,
      lockValue,
      'EX',
      this.REDIS_LOCK_EXPIRY,
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
          logger.debug({ key, redis_response: gotLock }, 'lock is locked')
          callback(err, false)
        }
      }
    )
  }

  // it's sufficient to serialize within a process because that is where the parallel operations occur
  _getLock(key, namespace, callback) {
    // this is what we need to do for each lock we want to request
    const task = next =>
      this._getLockByPolling(key, namespace, (error, lockValue) => {
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
      queue.drain(() => {
        LOCK_QUEUES.delete(queueName)
      })
      // store the queue in our global map
      LOCK_QUEUES.set(queueName, queue)
    } else {
      // queue the request to get the lock
      queue.push(task)
    }
  }

  _getLockByPolling(key, namespace, callback) {
    const startTime = Date.now()
    const testInterval = this.LOCK_TEST_INTERVAL
    let attempts = 0
    const attempt = () => {
      if (Date.now() - startTime > this.MAX_LOCK_WAIT_TIME) {
        metrics.inc(`lock.${namespace}.get.failed`)
        return callback(new Error('Timeout'))
      }

      attempts += 1
      this._tryLock(key, namespace, (error, gotLock, lockValue) => {
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
  }

  _releaseLock(key, lockValue, callback) {
    this.rclient.eval(this.unlockScript, 1, key, lockValue, (err, result) => {
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

  _lockQueuesSize() {
    return LOCK_QUEUES.size
  }
}
