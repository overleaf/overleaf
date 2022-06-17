const settings = require('@overleaf/settings')
const RedisWrapper = require('./RedisWrapper')
const rclient = RedisWrapper.client('lock')
const { callbackify, promisify } = require('util')

const RedisWebLocker = require('@overleaf/redis-wrapper/RedisWebLocker')

// this method creates a lock manager with the provided timeout options
function createLockManager(options) {
  return new RedisWebLocker({
    rclient,
    getKey(namespace, id) {
      return `lock:web:${namespace}:${id}`
    },
    options,
  })
}

// this is the default lock manager for web
const LockManager = createLockManager(settings.lockManager)

// this method creates a lock manager with a configurable timeout
// it shares the lock keys with the default lock manager
LockManager.withTimeout = function (timeout) {
  const overrides = {
    redisLockExpiry: timeout, // in seconds
    slowExecutionThreshold: 0.5 * timeout * 1000, // in ms
  }
  const lockManagerSettingsWithTimeout = Object.assign(
    {},
    settings.lockManager,
    overrides
  )
  return createLockManager(lockManagerSettingsWithTimeout)
}

// need to bind the promisified function when it is part of a class
// see https://nodejs.org/dist/latest-v16.x/docs/api/util.html#utilpromisifyoriginal
const promisifiedRunWithLock = promisify(LockManager.runWithLock).bind(
  LockManager
)
LockManager.promises = {
  runWithLock(namespace, id, runner) {
    const cbRunner = callbackify(runner)
    return promisifiedRunWithLock(namespace, id, cbRunner)
  },
}

module.exports = LockManager
