const RateLimiter = require('../../infrastructure/RateLimiter')
const { promisifyAll } = require('../../util/promises')

const ONE_MIN = 60
const ATTEMPT_LIMIT = 10

function processLoginRequest(email, callback) {
  const opts = {
    endpointName: 'login',
    throttle: ATTEMPT_LIMIT,
    timeInterval: ONE_MIN * 2,
    subjectName: email
  }
  RateLimiter.addCount(opts, (err, shouldAllow) => callback(err, shouldAllow))
}

function recordSuccessfulLogin(email, callback) {
  if (callback == null) {
    callback = function() {}
  }
  RateLimiter.clearRateLimit('login', email, callback)
}

const LoginRateLimiter = {
  processLoginRequest,
  recordSuccessfulLogin
}
LoginRateLimiter.promises = promisifyAll(LoginRateLimiter)

module.exports = LoginRateLimiter
