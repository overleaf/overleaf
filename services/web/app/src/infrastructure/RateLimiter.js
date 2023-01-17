const settings = require('@overleaf/settings')
const Metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const RedisWrapper = require('./RedisWrapper')
const rclient = RedisWrapper.client('ratelimiter')
const RollingRateLimiter = require('rolling-rate-limiter')
const RateLimiterFlexible = require('rate-limiter-flexible')
const { callbackify } = require('util')

async function addCount(opts) {
  if (settings.disableRateLimits) {
    return true
  }
  const namespace = `RateLimit:${opts.endpointName}:`
  const k = `{${opts.subjectName}}`
  const limiter = new RollingRateLimiter.RedisRateLimiter({
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

/**
 * Wrapper over the RateLimiterRedis class
 */
class RateLimiter {
  /**
   * Create a rate limiter.
   *
   * @param name {string} The name that identifies this rate limiter. Different
   *                      rate limiters must have different names.
   * @param opts {object} Options to pass to RateLimiterRedis
   *
   * Some useful options:
   *
   *   points - number of points that can be consumed over the given duration
   *            (default: 4)
   *   duration - duration of the fixed window in seconds (default: 1)
   *   blockDuration - additional seconds to block after all points are consumed
   *                   (default: 0)
   */
  constructor(name, opts = {}) {
    this.name = name
    this._rateLimiter = new RateLimiterFlexible.RateLimiterRedis({
      ...opts,
      keyPrefix: `rate-limit:${name}`,
      storeClient: rclient,
    })
  }

  async consume(key, points = 1, options = {}) {
    try {
      const res = await this._rateLimiter.consume(key, points, options)
      return res
    } catch (err) {
      if (err instanceof Error) {
        throw err
      } else {
        // Only log the first time we exceed the rate limit for a given key and
        // duration
        if (err.consumedPoints === this._rateLimiter.points + points) {
          logger.warn({ path: this.name, key }, 'rate limit exceeded')
        }
        Metrics.inc('rate-limit-hit', 1, { path: this.name })
        throw err
      }
    }
  }
}

module.exports = {
  addCount: callbackify(addCount),
  clearRateLimit: callbackify(clearRateLimit),
  RateLimiter,
  promises: {
    addCount,
    clearRateLimit,
  },
}
