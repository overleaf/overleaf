const logger = require('@overleaf/logger')
const Errors = require('./Errors')
const RequestParser = require('./RequestParser')
const Metrics = require('@overleaf/metrics')

// The lock timeout should be higher than the maximum end-to-end compile time.
// Here, we use the maximum compile timeout plus 2 minutes.
const LOCK_TIMEOUT_MS = RequestParser.MAX_TIMEOUT * 1000 + 120000

const LOCKS = new Map()

function acquire(key) {
  const currentLock = LOCKS.get(key)
  if (currentLock != null) {
    if (currentLock.isExpired()) {
      logger.warn({ key }, 'Compile lock expired')
      currentLock.release()
    } else {
      throw new Errors.AlreadyCompilingError('compile in progress')
    }
  }

  Metrics.gauge('concurrent_compile_requests', LOCKS.size)

  const lock = new Lock(key)
  LOCKS.set(key, lock)
  return lock
}

class Lock {
  constructor(key) {
    this.key = key
    this.expiresAt = Date.now() + LOCK_TIMEOUT_MS
  }

  isExpired() {
    return Date.now() >= this.expiresAt
  }

  release() {
    const lockWasActive = LOCKS.delete(this.key)
    if (!lockWasActive) {
      logger.error({ key: this.key }, 'Lock was released twice')
    }
    if (this.isExpired()) {
      Metrics.inc('compile_lock_expired_before_release')
    }
  }
}

module.exports = { acquire }
