const Settings = require('@overleaf/settings')
const redis = require('@overleaf/redis-wrapper')
const { addConnectionDrainer } = require('./GracefulShutdown')

if (
  typeof global.beforeEach === 'function' &&
  process.argv.join(' ').match(/unit/)
) {
  throw new Error(
    'It looks like unit tests are running, but you are connecting to Redis. Missing a stub?'
  )
}

// A per-feature interface to Redis,
// looks up the feature in `settings.redis`
// and returns an appropriate client.
// Necessary because we don't want to migrate web over
// to redis-cluster all at once.
module.exports = {
  // feature = 'websessions' | 'ratelimiter' | ...
  client(feature) {
    const redisFeatureSettings = Settings.redis[feature] || Settings.redis.web
    const client = redis.createClient(redisFeatureSettings)
    addConnectionDrainer(`redis ${feature}`, async () => {
      await client.disconnect()
    })
    return client
  },
}
