import settings from '@overleaf/settings'
import RedisWrapper from './RedisWrapper.mjs'
import RedisWebLocker from '@overleaf/redis-wrapper/RedisWebLocker.js'
const rclient = RedisWrapper.client('lock')

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

export default LockManager
