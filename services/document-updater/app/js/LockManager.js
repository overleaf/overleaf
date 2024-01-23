const Settings = require('@overleaf/settings')
const redis = require('@overleaf/redis-wrapper')
const rclient = redis.createClient(Settings.redis.lock)
const keys = Settings.redis.lock.key_schema
const RedisLocker = require('@overleaf/redis-wrapper/RedisLocker')
const { promisify } = require('@overleaf/promise-utils')

module.exports = new RedisLocker({
  rclient,
  getKey(docId) {
    return keys.blockingKey({ doc_id: docId })
  },
  wrapTimeoutError(err, docId) {
    err.doc_id = docId
    return err
  },
  metricsPrefix: 'doc',
  lockTTLSeconds: Settings.redisLockTTLSeconds,
})

module.exports.promises = {
  checkLock: promisify(module.exports.checkLock.bind(module.exports)),
  getLock: promisify(module.exports.getLock.bind(module.exports)),
  releaseLock: promisify(module.exports.releaseLock.bind(module.exports)),
  tryLock: promisify(module.exports.tryLock.bind(module.exports)),
}
