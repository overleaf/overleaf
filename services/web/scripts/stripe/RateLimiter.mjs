/* eslint-disable @overleaf/require-script-runner */
// This file contains helper functions used by other scripts.
// The scripts that import these helpers should use Script Runner.

import { setTimeout } from 'node:timers/promises'

export const DEFAULT_RECURLY_RATE_LIMIT = 10
export const DEFAULT_STRIPE_RATE_LIMIT = 50
export const DEFAULT_RECURLY_API_RETRIES = 5
export const DEFAULT_RECURLY_RETRY_DELAY_MS = 1000
export const DEFAULT_STRIPE_API_RETRIES = 5
export const DEFAULT_STRIPE_RETRY_DELAY_MS = 1000

/**
 * Rate limiter using sliding window algorithm.
 *
 * Rate limits (conservative targets, leaving headroom):
 * - Recurly: 2000 requests per 5 minutes → target 1500/5min = 300/min = 5/sec
 *   https://support.recurly.com/hc/en-us/articles/360034160731-What-Are-Recurly-s-API-Rate-Limits
 * - Stripe: 100 requests per second → target 50/sec (plenty of headroom)
 *   https://docs.stripe.com/rate-limits
 *
 * Recurly is the bottleneck. With 2 Recurly calls per customer (getAccount, getBillingInfo),
 * we can process ~2.5 customers/second = ~150 customers/minute = ~9000 customers/hour.
 * For 150K customers, expect ~17 hours at full throughput.
 */

class RateLimiter {
  /**
   * @param {string} name - Name for logging
   * @param {number} maxRequests - Maximum requests allowed in the window
   * @param {number} windowMs - Window size in milliseconds
   * @param {Function} logDebug - Optional debug logging function
   * @param {Function} logWarn - Optional warning logging function
   */
  constructor(
    name,
    maxRequests,
    windowMs,
    logDebug = () => null,
    logWarn = () => null
  ) {
    this.name = name
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.requests = [] // timestamps of recent requests
    this.totalRequests = 0
    this._pending = Promise.resolve()
    this.logDebug = logDebug
    this.logWarn = logWarn
  }

  /**
   * Wait if necessary to stay within rate limits, then record the request.
   */
  async throttle() {
    this._pending = this._pending
      .catch(error => {
        // this should never happen since setTimeout or logDebug are very unlikely to ever fail
        // but if it does, we log it and continue without blocking the queue (fail-open)
        this.logWarn(`Rate limiter chain error for ${this.name}`, {
          error: error?.message || String(error),
        })
      })
      .then(async () => {
        while (true) {
          const now = Date.now()

          // Remove requests outside the window
          const windowStart = now - this.windowMs
          this.requests = this.requests.filter(ts => ts > windowStart)

          // If at limit, wait until the oldest request exits the window
          if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0]
            const waitTime = oldestRequest - windowStart + 1
            if (waitTime > 0) {
              this.logDebug(
                `Rate limit throttle for ${this.name}`,
                {
                  waitMs: waitTime,
                  currentRequests: this.requests.length,
                  maxRequests: this.maxRequests,
                },
                { verboseOnly: true }
              )
              await setTimeout(waitTime)
              continue
            }
          }

          // Record this request
          this.requests.push(Date.now())
          this.totalRequests++
          break
        }
      })

    return this._pending
  }

  /**
   * Get current rate (requests per second over the last window)
   */
  getCurrentRate() {
    const now = Date.now()
    const windowStart = now - this.windowMs
    const recentRequests = this.requests.filter(ts => ts > windowStart).length
    return (recentRequests / this.windowMs) * 1000 // requests per second
  }

  getStats() {
    return {
      name: this.name,
      totalRequests: this.totalRequests,
      currentWindowRequests: this.requests.length,
      maxRequests: this.maxRequests,
      currentRate: this.getCurrentRate().toFixed(2) + '/sec',
    }
  }
}

/**
 * Helper to extract Stripe rate limit reason from error headers
 */
function getStripeRateLimitReason(error) {
  const headers =
    error?.headers || error?.raw?.headers || error?.response?.headers || {}
  return (
    headers['stripe-rate-limit-reason'] ||
    headers['Stripe-Rate-Limited-Reason'] ||
    headers['stripe-rate-limited-reason'] ||
    null
  )
}

/**
 * Create rate-limited API wrapper with unified service routing.
 *
 * @param {object} config - Configuration options
 * @param {number} config.recurlyRateLimit - Requests per second for Recurly (default: 10)
 * @param {number} config.recurlyApiRetries - Number of retries on Recurly 429s (default: 5)
 * @param {number} config.recurlyRetryDelayMs - Delay between Recurly retries in ms (default: 1000)
 * @param {number} config.stripeRateLimit - Requests per second for Stripe (default: 50)
 * @param {number} config.stripeApiRetries - Number of retries on Stripe 429s (default: 5)
 * @param {number} config.stripeRetryDelayMs - Delay between Stripe retries in ms (default: 1000)
 * @param {Function} config.logDebug - Optional debug logging function
 * @param {Function} config.logWarn - Optional warning logging function
 *
 * @returns {object} Object with unified call function and stats getter
 * @returns {Function} returns.call - Unified wrapper for API calls (service, operation, context)
 * @returns {Function} returns.getRateLimiterStats - Get current rate limiter statistics
 */
export function createRateLimitedApiWrappers(config = {}) {
  const {
    recurlyRateLimit = 10,
    recurlyApiRetries = 5,
    recurlyRetryDelayMs = 1000,
    stripeRateLimit = 50,
    stripeApiRetries = 5,
    stripeRetryDelayMs = 1000,
    logDebug = () => null,
    logWarn = () => null,
  } = config

  const RATE_LIMIT_WINDOW_MS = 1000

  // Service configuration registry
  const serviceConfigs = {
    recurly: {
      rateLimit: recurlyRateLimit,
      apiRetries: recurlyApiRetries,
      retryDelayMs: recurlyRetryDelayMs,
      isStripe: false,
    },
    stripe: {
      rateLimit: stripeRateLimit,
      apiRetries: stripeApiRetries,
      retryDelayMs: stripeRetryDelayMs,
      isStripe: true,
    },
  }

  // Rate limiter instances per service
  const rateLimiters = new Map()

  function getRateLimiter(service) {
    const key = String(service || 'unknown').toLowerCase()
    if (rateLimiters.has(key)) {
      return rateLimiters.get(key)
    }

    // Determine service config
    let serviceConfig
    if (key === 'recurly') {
      serviceConfig = serviceConfigs.recurly
    } else if (key.startsWith('stripe')) {
      serviceConfig = serviceConfigs.stripe
    } else {
      throw new Error(`Unknown service: ${service}`)
    }

    const limiter = new RateLimiter(
      key,
      serviceConfig.rateLimit,
      RATE_LIMIT_WINDOW_MS,
      logDebug,
      logWarn
    )
    rateLimiters.set(key, limiter)
    return limiter
  }

  function getServiceConfig(service) {
    const key = String(service || 'unknown').toLowerCase()
    if (key === 'recurly') {
      return serviceConfigs.recurly
    } else if (key.startsWith('stripe')) {
      return serviceConfigs.stripe
    } else {
      throw new Error(`Unknown service: ${service}`)
    }
  }

  async function requestWithRetries(service, operation, { context } = {}) {
    const serviceConfig = getServiceConfig(service)
    const rateLimiter = getRateLimiter(service)
    let attempt = 0

    while (true) {
      try {
        await rateLimiter.throttle()
        return await operation()
      } catch (error) {
        const statusCode =
          error?.statusCode ?? error?.status ?? error?.raw?.statusCode
        if (statusCode === 429) {
          attempt++
          if (attempt > serviceConfig.apiRetries) {
            logWarn(
              `${service} rate limit exceeded after ${attempt - 1} retries`,
              {
                ...context,
                service,
                attempt,
                ...(serviceConfig.isStripe
                  ? { rateLimitReason: getStripeRateLimitReason(error) }
                  : {}),
              }
            )
            throw error
          }
          logDebug(`${service} rate limited, retrying`, {
            ...context,
            service,
            attempt,
            retryDelayMs: serviceConfig.retryDelayMs,
            ...(serviceConfig.isStripe
              ? { rateLimitReason: getStripeRateLimitReason(error) }
              : {}),
          })
          await setTimeout(serviceConfig.retryDelayMs)
          continue
        }
        throw error
      }
    }
  }

  /**
   * Get rate limiter statistics for logging
   */
  function getRateLimiterStats() {
    const allLimiters = [...rateLimiters.values()]

    // Separate Recurly and Stripe limiters
    const recurlyLimiters = allLimiters.filter(
      limiter => limiter.name === 'recurly'
    )
    const stripeLimiters = allLimiters.filter(limiter =>
      limiter.name.startsWith('stripe')
    )

    const stripeTotalRequests = stripeLimiters.reduce(
      (sum, limiter) => sum + limiter.totalRequests,
      0
    )
    const stripeCurrentRate = stripeLimiters.reduce(
      (sum, limiter) => sum + limiter.getCurrentRate(),
      0
    )

    return {
      recurly:
        recurlyLimiters.length > 0
          ? recurlyLimiters[0].getStats()
          : { totalRequests: 0, currentRate: '0.00/sec' },
      stripe: {
        totalRequests: stripeTotalRequests,
        currentRate: stripeCurrentRate.toFixed(2) + '/sec',
      },
      stripeByRegion: stripeLimiters.map(limiter => limiter.getStats()),
    }
  }

  return {
    requestWithRetries,
    getRateLimiterStats,
  }
}
