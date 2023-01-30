const { RateLimiter } = require('../../infrastructure/RateLimiter')
const { promisifyAll } = require('../../util/promises')

const rateLimiter = new RateLimiter('login', {
  points: 10,
  duration: 120,
})

function processLoginRequest(email, callback) {
  rateLimiter
    .consume(email)
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
  rateLimiter
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
