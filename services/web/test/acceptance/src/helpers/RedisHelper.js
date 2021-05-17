const RateLimiter = require('../../../../app/src/infrastructure/RateLimiter')

async function clearOverleafLoginRateLimit() {
  await RateLimiter.promises.clearRateLimit('overleaf-login', '127.0.0.1')
}

module.exports = {
  initialize() {
    before(clearOverleafLoginRateLimit)
  },
}
