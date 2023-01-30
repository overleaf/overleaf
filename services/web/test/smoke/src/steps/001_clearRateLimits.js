const Settings = require('@overleaf/settings')
const {
  overleafLoginRateLimiter,
  openProjectRateLimiter,
} = require('../../../../app/src/infrastructure/RateLimiter')
const LoginRateLimiter = require('../../../../app/src/Features/Security/LoginRateLimiter')

async function clearLoginRateLimit() {
  await LoginRateLimiter.promises.recordSuccessfulLogin(Settings.smokeTest.user)
}

async function clearOverleafLoginRateLimit() {
  if (!Settings.overleaf) return
  await overleafLoginRateLimiter.delete(Settings.smokeTest.rateLimitSubject)
}

async function clearOpenProjectRateLimit() {
  await openProjectRateLimiter.delete(
    `${Settings.smokeTest.projectId}:${Settings.smokeTest.userId}`
  )
}

async function run({ processWithTimeout, timeout }) {
  await processWithTimeout({
    work: Promise.all([
      clearLoginRateLimit(),
      clearOverleafLoginRateLimit(),
      clearOpenProjectRateLimit(),
    ]),
    timeout,
    message: 'cleanupRateLimits timed out',
  })
}

module.exports = { run }
