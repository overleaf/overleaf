const Settings = require('@overleaf/settings')
const Metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const RedisWrapper = require('./RedisWrapper')
const RateLimiterFlexible = require('rate-limiter-flexible')
const OError = require('@overleaf/o-error')

const rclient = RedisWrapper.client('ratelimiter')

/**
 * Wrapper over the RateLimiterRedis class
 */
class RateLimiter {
  #opts

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
   *   subnetPoints - number of points that can be consumed over the given
   *                  duration accross a sub-network. This should only be used
   *                  ip-based rate limits.
   *   duration - duration of the fixed window in seconds (default: 1)
   *   blockDuration - additional seconds to block after all points are consumed
   *                   (default: 0)
   */
  constructor(name, opts = {}) {
    this.name = name
    this.#opts = Object.assign({}, opts)
    this._rateLimiter = new RateLimiterFlexible.RateLimiterRedis({
      ...opts,
      keyPrefix: `rate-limit:${name}`,
      storeClient: rclient,
    })
    if (opts.subnetPoints && !Settings.rateLimit?.subnetRateLimiterDisabled) {
      this._subnetRateLimiter = new RateLimiterFlexible.RateLimiterRedis({
        ...opts,
        points: opts.subnetPoints,
        keyPrefix: `rate-limit:${name}`,
        storeClient: rclient,
      })
    }
  }

  // Readonly access to the options, useful for aligning rate-limits.
  getOptions() {
    return Object.assign({}, this.#opts)
  }

  async consume(key, points = 1, options = { method: 'unknown' }) {
    if (Settings.disableRateLimits) {
      // Return a fake result in case it's used somewhere
      return {
        msBeforeNext: 0,
        remainingPoints: 100,
        consumedPoints: 0,
        isFirstInDuration: false,
      }
    }

    await this.consumeForRateLimiter(this._rateLimiter, key, options, points)

    if (options.method === 'ip' && this._subnetRateLimiter) {
      const subnetKey = this.getSubnetKeyFromIp(key)
      await this.consumeForRateLimiter(
        this._subnetRateLimiter,
        subnetKey,
        options,
        points,
        'ip-subnet'
      )
    }
  }

  async consumeForRateLimiter(rateLimiter, key, options, points, method) {
    try {
      const res = await rateLimiter.consume(key, points, options)
      return res
    } catch (err) {
      if (err instanceof Error) {
        throw err
      } else {
        // Only log the first time we exceed the rate limit for a given key and
        // duration. This happens when the previous amount of consumed points
        // was below the threshold.
        if (err.consumedPoints - points <= rateLimiter.points) {
          logger.warn({ path: this.name, key }, 'rate limit exceeded')
        }
        Metrics.inc('rate-limit-hit', 1, {
          path: this.name,
          method: method || options.method,
        })
        throw err
      }
    }
  }

  getSubnetKeyFromIp(ip) {
    if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
      throw new OError(
        'Cannot generate subnet key as the ip address is not of the expected format.',
        { ip }
      )
    }

    return ip.split('.').slice(0, 3).join('.')
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
const overleafLoginRateLimiter = new RateLimiter(
  'overleaf-login',
  Settings.rateLimit?.login?.ip || {
    points: 20,
    subnetPoints: 200,
    duration: 60,
  }
)

module.exports = {
  RateLimiter,
  openProjectRateLimiter,
  overleafLoginRateLimiter,
}
