const Settings = require('@overleaf/settings')
const redis = require('@overleaf/redis-wrapper')
const rclient = redis.createClient(Settings.redis.lock)
const keys = Settings.redis.lock.key_schema
const RedisLocker = require('@overleaf/redis-wrapper/RedisLocker')

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
