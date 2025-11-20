import logger from '@overleaf/logger'
import SessionManager from '../Authentication/SessionManager.mjs'
import LoginRateLimiter from './LoginRateLimiter.mjs'
import settings from '@overleaf/settings'

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
 * The method label is used to identify this in our metrics.
 */
function rateLimit(rateLimiter, opts = {}) {
  const getUserId =
    opts.getUserId || (req => SessionManager.getLoggedInUserId(req.session))
  return function (req, res, next) {
    const clientId = opts.ipOnly ? req.ip : getUserId(req) || req.ip
    const method = clientId === req.ip ? 'ip' : 'userId'

    if (
      settings.smokeTest &&
      settings.smokeTest.userId &&
      settings.smokeTest.userId.toString() === clientId.toString()
    ) {
      // ignore smoke test user
      return next()
    }

    let key = clientId
    if (!opts.ipOnly) {
      const params = (opts.params || []).map(p => req.params[p])
      params.push(clientId)
      key = params.join(':')
    }

    rateLimiter
      .consume(key, 1, { method })
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

function loginRateLimitEmail(emailField = 'email') {
  return function (req, res, next) {
    const email = req.body[emailField]
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
        res.json({
          message: {
            type: 'error',
            text: req.i18n.translate('to_many_login_requests_2_mins'),
            key: 'to-many-login-requests-2-mins',
          },
        })
      }
    })
  }
}

const RateLimiterMiddleware = {
  rateLimit,
  loginRateLimitEmail,
}

export default RateLimiterMiddleware
