const Settings = require('@overleaf/settings')
const redis = require('@overleaf/redis-wrapper')
const rclient = redis.createClient(Settings.redis.lock)
const keys = Settings.redis.lock.key_schema
const RedisLocker = require('@overleaf/redis-wrapper/RedisLocker')

// Project level lock used to serialise processing of a project's pending
// updates (the `BlockingProject:{project_id}` key).
module.exports = new RedisLocker({
  rclient,
  getKey(projectId) {
    return keys.projectBlockingKey({ project_id: projectId })
  },
  wrapTimeoutError(err, projectId) {
    err.project_id = projectId
    return err
  },
  metricsPrefix: 'project',
  lockTTLSeconds: Settings.redisLockTTLSeconds,
})
