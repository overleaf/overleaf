/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const RateLimiter = require('../../infrastructure/RateLimiter')

const ONE_MIN = 60
const ATTEMPT_LIMIT = 10

module.exports = {
  processLoginRequest(email, callback) {
    const opts = {
      endpointName: 'login',
      throttle: ATTEMPT_LIMIT,
      timeInterval: ONE_MIN * 2,
      subjectName: email
    }
    RateLimiter.addCount(opts, (err, shouldAllow) => callback(err, shouldAllow))
  },

  recordSuccessfulLogin(email, callback) {
    if (callback == null) {
      callback = function() {}
    }
    RateLimiter.clearRateLimit('login', email, callback)
  }
}
