// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { promisify } from 'node:util'
import async from 'async'
import metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'
import os from 'node:os'
import crypto from 'node:crypto'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'

const LOCK_TEST_INTERVAL = 50 // 50ms between each test of the lock
const MAX_LOCK_WAIT_TIME = 10000 // 10s maximum time to spend trying to get the lock
export const LOCK_TTL = 360 // seconds
export const MIN_LOCK_EXTENSION_INTERVAL = 1000 // 1s minimum interval when extending a lock

export const UNLOCK_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end'
const EXTEND_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("expire", KEYS[1], ARGV[2]) else return 0 end'

const HOST = os.hostname()
const PID = process.pid
const RND = crypto.randomBytes(4).toString('hex')
let COUNT = 0

const rclient = redis.createClient(Settings.redis.lock)

/**
 * Container for functions that need to be mocked in tests
 *
 * TODO: Rewrite tests in terms of exported functions only
 */
export const _mocks = {}

// Use a signed lock value as described in
// http://redis.io/topics/distlock#correct-implementation-with-a-single-instance
// to prevent accidental unlocking by multiple processes
_mocks.randomLock = () => {
  const time = Date.now()
  return `locked:host=${HOST}:pid=${PID}:random=${RND}:time=${time}:count=${COUNT++}`
}

export function randomLock(...args) {
  return _mocks.randomLock(...args)
}

_mocks.tryLock = (key, callback) => {
  if (callback == null) {
    callback = function () {}
  }
  const lockValue = randomLock()
  return rclient.set(
    key,
    lockValue,
    'EX',
    LOCK_TTL,
    'NX',
    function (err, gotLock) {
      if (err != null) {
        return callback(
          OError.tag(err, 'redis error trying to get lock', { key })
        )
      }
      if (gotLock === 'OK') {
        metrics.inc('lock.project.try.success')
        return callback(err, true, lockValue)
      } else {
        metrics.inc('lock.project.try.failed')
        return callback(err, false)
      }
    }
  )
}

export function tryLock(...args) {
  _mocks.tryLock(...args)
}

_mocks.extendLock = (key, lockValue, callback) => {
  if (callback == null) {
    callback = function () {}
  }
  return rclient.eval(
    EXTEND_SCRIPT,
    1,
    key,
    lockValue,
    LOCK_TTL,
    function (err, result) {
      if (err != null) {
        return callback(
          OError.tag(err, 'redis error trying to extend lock', { key })
        )
      }

      if (result != null && result !== 1) {
        // successful extension should release exactly one key
        metrics.inc('lock.project.extend.failed')
        const error = new OError('failed to extend lock', {
          key,
          lockValue,
          result,
        })
        return callback(error)
      }

      metrics.inc('lock.project.extend.success')
      return callback()
    }
  )
}

export function extendLock(...args) {
  _mocks.extendLock(...args)
}

_mocks.getLock = (key, callback) => {
  let attempt
  if (callback == null) {
    callback = function () {}
  }
  const startTime = Date.now()
  let attempts = 0
  return (attempt = function () {
    if (Date.now() - startTime > MAX_LOCK_WAIT_TIME) {
      metrics.inc('lock.project.get.failed')
      return callback(new OError('Timeout', { key }))
    }

    attempts += 1
    return tryLock(key, function (error, gotLock, lockValue) {
      if (error != null) {
        return callback(OError.tag(error))
      }
      if (gotLock) {
        metrics.gauge('lock.project.get.success.tries', attempts)
        return callback(null, lockValue)
      } else {
        return setTimeout(attempt, LOCK_TEST_INTERVAL)
      }
    })
  })()
}

export function getLock(...args) {
  _mocks.getLock(...args)
}

export function checkLock(key, callback) {
  if (callback == null) {
    callback = function () {}
  }
  return rclient.exists(key, function (err, exists) {
    if (err != null) {
      return callback(OError.tag(err))
    }
    exists = parseInt(exists)
    if (exists === 1) {
      return callback(err, false)
    } else {
      return callback(err, true)
    }
  })
}

_mocks.releaseLock = (key, lockValue, callback) => {
  return rclient.eval(UNLOCK_SCRIPT, 1, key, lockValue, function (err, result) {
    if (err != null) {
      return callback(OError.tag(err))
    }
    if (result != null && result !== 1) {
      // successful unlock should release exactly one key
      const error = new OError('tried to release timed out lock', {
        key,
        lockValue,
        redis_result: result,
      })
      return callback(error)
    }
    return callback(err, result)
  })
}

export function releaseLock(...args) {
  _mocks.releaseLock(...args)
}

export function runWithLock(key, runner, callback) {
  if (callback == null) {
    callback = function () {}
  }
  return getLock(key, function (error, lockValue) {
    if (error != null) {
      return callback(OError.tag(error))
    }

    const lock = new Lock(key, lockValue)
    return runner(lock.extend.bind(lock), (error1, ...args) =>
      lock.release(function (error2) {
        error = error1 || error2
        if (error != null) {
          return callback(OError.tag(error), ...Array.from(args))
        }
        return callback(null, ...Array.from(args))
      })
    )
  })
}

export function healthCheck(callback) {
  const action = (extendLock, releaseLock) => releaseLock()
  return runWithLock(
    `HistoryLock:HealthCheck:host=${HOST}:pid=${PID}:random=${RND}`,
    action,
    callback
  )
}

export function close(callback) {
  rclient.quit()
  return rclient.once('end', callback)
}

class Lock {
  constructor(key, value) {
    this.key = key
    this.value = value
    this.slowExecutionError = new OError('slow execution during lock')
    this.lockTakenAt = Date.now()
    this.timer = new metrics.Timer('lock.project')
  }

  extend(callback) {
    const lockLength = Date.now() - this.lockTakenAt
    if (lockLength < MIN_LOCK_EXTENSION_INTERVAL) {
      return async.setImmediate(callback)
    }
    return extendLock(this.key, this.value, error => {
      if (error != null) {
        return callback(OError.tag(error))
      }
      this.lockTakenAt = Date.now()
      return callback()
    })
  }

  release(callback) {
    // The lock can expire in redis but the process carry on. This setTimout call
    // is designed to log if this happens.
    const lockLength = Date.now() - this.lockTakenAt
    if (lockLength > LOCK_TTL * 1000) {
      metrics.inc('lock.project.exceeded_lock_timeout')
      logger.debug('exceeded lock timeout', {
        key: this.key,
        slowExecutionError: this.slowExecutionError,
      })
    }

    return releaseLock(this.key, this.value, error => {
      this.timer.done()
      if (error != null) {
        return callback(OError.tag(error))
      }
      return callback()
    })
  }
}

/**
 * Promisified version of runWithLock.
 *
 * @param {string} key
 * @param {(extendLock: Function) => Promise<any>} runner
 */
async function runWithLockPromises(key, runner) {
  const runnerCb = (extendLock, callback) => {
    const extendLockPromises = promisify(extendLock)
    runner(extendLockPromises)
      .then(result => {
        callback(null, result)
      })
      .catch(err => {
        callback(err)
      })
  }

  return await new Promise((resolve, reject) => {
    runWithLock(key, runnerCb, (err, result) => {
      if (err) {
        reject(err)
      } else {
        resolve(result)
      }
    })
  })
}

export const promises = {
  tryLock: promisify(tryLock),
  extendLock: promisify(extendLock),
  getLock: promisify(getLock),
  checkLock: promisify(checkLock),
  releaseLock: promisify(releaseLock),
  runWithLock: runWithLockPromises,
}
