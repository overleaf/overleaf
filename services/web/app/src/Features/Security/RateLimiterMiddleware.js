const logger = require('@overleaf/logger')
const SessionManager = require('../Authentication/SessionManager')
const LoginRateLimiter = require('./LoginRateLimiter')
const settings = require('@overleaf/settings')

/**
 * Return a rate limiting middleware
 *
 * Pass an array of opts.params to segment this based on parameters in the
 * request URL, e.g.:
 *
 *   app.get "/project/:project_id", RateLimiterMiddleware.rateLimit(
 *     rateLimiter, params: ["project_id"]
 *   )
 *
 * will rate limit each project_id separately.
 *
 * Unique clients are identified by user_id if logged in, and IP address if not.
 */
function rateLimit(rateLimiter, opts = {}) {
  const getUserId =
    opts.getUserId || (req => SessionManager.getLoggedInUserId(req.session))
  return function (req, res, next) {
    const userId = getUserId(req) || req.ip
    if (
      settings.smokeTest &&
      settings.smokeTest.userId &&
      settings.smokeTest.userId.toString() === userId.toString()
    ) {
      // ignore smoke test user
      return next()
    }

    let key
    if (opts.ipOnly) {
      key = req.ip
    } else {
      const params = (opts.params || []).map(p => req.params[p])
      params.push(userId)
      key = params.join(':')
    }

    rateLimiter
      .consume(key)
      .then(() => next())
      .catch(err => {
        if (err instanceof Error) {
          next(err)
        } else {
          res.status(429) // Too many requests
          res.write('Rate limit reached, please try again later')
          res.end()
        }
      })
  }
}

function loginRateLimit(req, res, next) {
  const { email } = req.body
  if (!email) {
    return next()
  }
  LoginRateLimiter.processLoginRequest(email, (err, isAllowed) => {
    if (err) {
      return next(err)
    }
    if (isAllowed) {
      next()
    } else {
      logger.warn({ email }, 'rate limit exceeded')
      res.status(429) // Too many requests
      res.write('Rate limit reached, please try again later')
      res.end()
    }
  })
}

const RateLimiterMiddleware = {
  rateLimit,
  loginRateLimit,
}

module.exports = RateLimiterMiddleware
