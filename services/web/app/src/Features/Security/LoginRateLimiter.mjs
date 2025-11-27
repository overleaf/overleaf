import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import { callbackify } from '@overleaf/promise-utils'
import Settings from '@overleaf/settings'

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

export default LoginRateLimiter
