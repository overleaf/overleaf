/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let RateLimiterMiddleware
const RateLimiter = require('../../infrastructure/RateLimiter')
const logger = require('logger-sharelatex')
const AuthenticationController = require('../Authentication/AuthenticationController')

module.exports = RateLimiterMiddleware = {
  /*
	Do not allow more than opts.maxRequests from a single client in
	opts.timeInterval. Pass an array of opts.params to segment this based on
	parameters in the request URL, e.g.:

	    app.get "/project/:project_id", RateLimiterMiddleware.rateLimit(endpointName: "open-editor", params: ["project_id"])

	will rate limit each project_id separately.

	Unique clients are identified by user_id if logged in, and IP address if not.
	*/
  rateLimit(opts) {
    return function(req, res, next) {
      const user_id = AuthenticationController.getLoggedInUserId(req) || req.ip
      const params = (opts.params || []).map(p => req.params[p])
      params.push(user_id)
      let subjectName = params.join(':')
      if (opts.ipOnly) {
        subjectName = req.ip
      }
      if (opts.endpointName == null) {
        throw new Error('no endpointName provided')
      }
      const options = {
        endpointName: opts.endpointName,
        timeInterval: opts.timeInterval || 60,
        subjectName,
        throttle: opts.maxRequests || 6
      }
      return RateLimiter.addCount(options, function(error, canContinue) {
        if (error != null) {
          return next(error)
        }
        if (canContinue) {
          return next()
        } else {
          logger.warn(options, 'rate limit exceeded')
          res.status(429) // Too many requests
          res.write('Rate limit reached, please try again later')
          return res.end()
        }
      })
    }
  }
}
