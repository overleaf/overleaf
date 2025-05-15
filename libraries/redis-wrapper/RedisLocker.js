const { promisify } = require('node:util')
const metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const os = require('node:os')
const crypto = require('node:crypto')

const HOST = os.hostname()
const PID = process.pid
const RND = crypto.randomBytes(4).toString('hex')
let COUNT = 0

const MAX_REDIS_REQUEST_LENGTH = 5000 // 5 seconds

const UNLOCK_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end'

module.exports = class RedisLocker {
  /**
   * @param {import('ioredis')} rclient initialized ioredis client
   * @param {function(string): string} getKey compose the redis key based on the passed id
   * @param {function(Error, string): Error} wrapTimeoutError assign the id to a designated field on the error
   * @param {string} metricsPrefix prefix all the metrics with the given prefix
   * @param {number} lockTTLSeconds
   *
   * @example ```
   * const lock = new RedisLocker({
   *   rclient,
   *   getKey(userId) { return `blocking:{userId}` },
   *   wrapTimeoutError(err, userId) { err.userId = userId; return err },
   *   metricsPrefix: 'user',
   * })
   *
   * lock.getLock(user._id, (err, value) => {
   *   if (err) return callback(err)
   *   // do work
   *   lock.releaseLock(user._id, callback)
   * }
   * ```
   */
  constructor({
    rclient,
    getKey,
    wrapTimeoutError,
    metricsPrefix,
    lockTTLSeconds = 30,
  }) {
    if (
      typeof lockTTLSeconds !== 'number' ||
      lockTTLSeconds < 30 ||
      lockTTLSeconds >= 1000
    ) {
      // set upper limit to 1000s to detect wrong units
      throw new Error('redis lock TTL must be at least 30s and below 1000s')
    }

    this.rclient = rclient
    this.getKey = getKey
    this.wrapTimeoutError = wrapTimeoutError
    this.metricsPrefix = metricsPrefix

    this.LOCK_TEST_INTERVAL = 50 // 50ms between each test of the lock
    this.MAX_TEST_INTERVAL = 1000 // back off to 1s between each test of the lock
    this.MAX_LOCK_WAIT_TIME = 10000 // 10s maximum time to spend trying to get the lock
    this.LOCK_TTL = lockTTLSeconds // seconds. Time until lock auto expires in redis.

    // read-only copy for unit tests
    this.unlockScript = UNLOCK_SCRIPT

    this.promises = {
      checkLock: promisify(this.checkLock.bind(this)),
      getLock: promisify(this.getLock.bind(this)),
      releaseLock: promisify(this.releaseLock.bind(this)),

      // tryLock returns two values: gotLock and lockValue. We need to merge
      // these two values into one for the promises version.
      tryLock: id =>
        new Promise((resolve, reject) => {
          this.tryLock(id, (err, gotLock, lockValue) => {
            if (err) {
              reject(err)
            } else if (!gotLock) {
              resolve(null)
            } else {
              resolve(lockValue)
            }
          })
        }),
    }
  }

  // Use a signed lock value as described in
  // https://redis.io/docs/reference/patterns/distributed-locks/#correct-implementation-with-a-single-instance
  // to prevent accidental unlocking by multiple processes
  randomLock() {
    const time = Date.now()
    return `locked:host=${HOST}:pid=${PID}:random=${RND}:time=${time}:count=${COUNT++}`
  }

  /**
   * @param {string} id
   * @param {function(Error, boolean, string): void} callback
   */
  tryLock(id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const lockValue = this.randomLock()
    const key = this.getKey(id)
    const startTime = Date.now()
    this.rclient.set(
      key,
      lockValue,
      'EX',
      this.LOCK_TTL,
      'NX',
      (err, gotLock) => {
        if (err != null) {
          return callback(err)
        }
        if (gotLock === 'OK') {
          metrics.inc(this.metricsPrefix + '-not-blocking')
          const timeTaken = Date.now() - startTime
          if (timeTaken > MAX_REDIS_REQUEST_LENGTH) {
            // took too long, so try to free the lock
            this.releaseLock(id, lockValue, function (err, result) {
              if (err != null) {
                return callback(err)
              } // error freeing lock
              return callback(null, false)
            }) // tell caller they didn't get the lock
          } else {
            return callback(null, true, lockValue)
          }
        } else {
          metrics.inc(this.metricsPrefix + '-blocking')
          return callback(null, false)
        }
      }
    )
  }

  /**
   * @param {string} id
   * @param {function(Error, string): void} callback
   */
  getLock(id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const startTime = Date.now()
    let testInterval = this.LOCK_TEST_INTERVAL
    const attempt = () => {
      if (Date.now() - startTime > this.MAX_LOCK_WAIT_TIME) {
        const e = this.wrapTimeoutError(new Error('Timeout'), id)
        return callback(e)
      }

      this.tryLock(id, (error, gotLock, lockValue) => {
        if (error != null) {
          return callback(error)
        }
        if (gotLock) {
          return callback(null, lockValue)
        } else {
          setTimeout(attempt, testInterval)
          // back off when the lock is taken to avoid overloading
          return (testInterval = Math.min(
            testInterval * 2,
            this.MAX_TEST_INTERVAL
          ))
        }
      })
    }
    attempt()
  }

  /**
   * @param {string} id
   * @param {function(Error, boolean): void} callback
   */
  checkLock(id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const key = this.getKey(id)
    this.rclient.exists(key, (err, exists) => {
      if (err != null) {
        return callback(err)
      }
      exists = parseInt(exists)
      if (exists === 1) {
        metrics.inc(this.metricsPrefix + '-blocking')
        return callback(null, false)
      } else {
        metrics.inc(this.metricsPrefix + '-not-blocking')
        return callback(null, true)
      }
    })
  }

  /**
   * @param {string} id
   * @param {string} lockValue
   * @param {function(Error, boolean): void} callback
   */
  releaseLock(id, lockValue, callback) {
    const key = this.getKey(id)
    this.rclient.eval(UNLOCK_SCRIPT, 1, key, lockValue, (err, result) => {
      if (err != null) {
        return callback(err)
      } else if (result != null && result !== 1) {
        // successful unlock should release exactly one key
        logger.error(
          { id, key, lockValue, redis_err: err, redis_result: result },
          'unlocking error'
        )
        metrics.inc(this.metricsPrefix + '-unlock-error')
        return callback(new Error('tried to release timed out lock'))
      } else {
        return callback(null, result)
      }
    })
  }
}
