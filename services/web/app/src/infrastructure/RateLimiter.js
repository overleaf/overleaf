const Settings = require('@overleaf/settings')
const Metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const RedisWrapper = require('./RedisWrapper')
const RateLimiterFlexible = require('rate-limiter-flexible')

const rclient = RedisWrapper.client('ratelimiter')

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
    if (Settings.disableRateLimits) {
      // Return a fake result in case it's used somewhere
      return {
        msBeforeNext: 0,
        remainingPoints: 100,
        consumedPoints: 0,
        isFirstInDuration: false,
      }
    }
    try {
      const res = await this._rateLimiter.consume(key, points, options)
      return res
    } catch (err) {
      if (err instanceof Error) {
        throw err
      } else {
        // Only log the first time we exceed the rate limit for a given key and
        // duration. This happens when the previous amount of consumed points
        // was below the threshold.
        if (err.consumedPoints - points <= this._rateLimiter.points) {
          logger.warn({ path: this.name, key }, 'rate limit exceeded')
        }
        Metrics.inc('rate-limit-hit', 1, { path: this.name })
        throw err
      }
    }
  }

  async delete(key) {
    return await this._rateLimiter.delete(key)
  }
}

/*
 * Shared rate limiters
 */

const openProjectRateLimiter = new RateLimiter('open-project', {
  points: 15,
  duration: 60,
})

// Keep in sync with the can-skip-captcha options.
const overleafLoginRateLimiter = new RateLimiter('overleaf-login', {
  points: 20,
  duration: 60,
})

module.exports = {
  RateLimiter,
  openProjectRateLimiter,
  overleafLoginRateLimiter,
}
