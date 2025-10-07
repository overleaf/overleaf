const { RateLimiter } = require('../../infrastructure/RateLimiter')
const { callbackify } = require('@overleaf/promise-utils')
const Settings = require('@overleaf/settings')

const rateLimiterLoginEmail = new RateLimiter(
  'login',
  Settings.rateLimit?.login?.email || {
    points: 10,
    duration: 120,
  }
)

async function processLoginRequest(email) {
  try {
    await rateLimiterLoginEmail.consume(email.trim().toLowerCase(), 1, {
      method: 'email',
    })
    return true
  } catch (err) {
    if (err instanceof Error) {
      throw err
    } else {
      return false
    }
  }
}

async function recordSuccessfulLogin(email) {
  await rateLimiterLoginEmail.delete(email)
}

const LoginRateLimiter = {
  processLoginRequest: callbackify(processLoginRequest),
  recordSuccessfulLogin: callbackify(recordSuccessfulLogin),
}
LoginRateLimiter.promises = {
  processLoginRequest,
  recordSuccessfulLogin,
}

module.exports = LoginRateLimiter
