const settings = require('@overleaf/settings')
const Metrics = require('@overleaf/metrics')
const RedisWrapper = require('./RedisWrapper')
const rclient = RedisWrapper.client('ratelimiter')
const { RedisRateLimiter } = require('rolling-rate-limiter')
const { callbackify } = require('util')

async function addCount(opts) {
  if (settings.disableRateLimits) {
    return true
  }
  const namespace = `RateLimit:${opts.endpointName}:`
  const k = `{${opts.subjectName}}`
  const limiter = new RedisRateLimiter({
    client: rclient,
    namespace,
    interval: opts.timeInterval * 1000,
    maxInInterval: opts.throttle,
  })
  const rateLimited = await limiter.limit(k)
  if (rateLimited) {
    Metrics.inc('rate-limit-hit', 1, {
      path: opts.endpointName,
    })
  }
  return !rateLimited
}

async function clearRateLimit(endpointName, subject) {
  // same as the key which will be built by RollingRateLimiter (namespace+k)
  const keyName = `RateLimit:${endpointName}:{${subject}}`
  await rclient.del(keyName)
}

module.exports = {
  addCount: callbackify(addCount),
  clearRateLimit: callbackify(clearRateLimit),
  promises: {
    addCount,
    clearRateLimit,
  },
}
