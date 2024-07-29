const { RateLimiter } = require('../../infrastructure/RateLimiter')
const { promisifyAll } = require('@overleaf/promise-utils')
const Settings = require('@overleaf/settings')

const rateLimiterLoginEmail = new RateLimiter(
  'login',
  Settings.rateLimit?.login?.email || {
    points: 10,
    duration: 120,
  }
)

function processLoginRequest(email, callback) {
  rateLimiterLoginEmail
    .consume(email.trim().toLowerCase(), 1, { method: 'email' })
    .then(() => {
      callback(null, true)
    })
    .catch(err => {
      if (err instanceof Error) {
        callback(err)
      } else {
        callback(null, false)
      }
    })
}

function recordSuccessfulLogin(email, callback) {
  rateLimiterLoginEmail
    .delete(email)
    .then(() => {
      callback()
    })
    .catch(err => {
      callback(err)
    })
}

const LoginRateLimiter = {
  processLoginRequest,
  recordSuccessfulLogin,
}
LoginRateLimiter.promises = promisifyAll(LoginRateLimiter)

module.exports = LoginRateLimiter
