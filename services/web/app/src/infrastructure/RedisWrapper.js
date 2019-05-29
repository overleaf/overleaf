/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
let Redis
const Settings = require('settings-sharelatex')
const redis = require('redis-sharelatex')

// A per-feature interface to Redis,
// looks up the feature in `settings.redis`
// and returns an appropriate client.
// Necessary because we don't want to migrate web over
// to redis-cluster all at once.
module.exports = Redis = {
  // feature = 'websessions' | 'ratelimiter' | ...
  client(feature) {
    const redisFeatureSettings = Settings.redis[feature] || Settings.redis.web
    const rclient = redis.createClient(redisFeatureSettings)
    return rclient
  }
}
