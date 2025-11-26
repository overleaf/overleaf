import Settings from '@overleaf/settings'
import {
  overleafLoginRateLimiter,
  openProjectRateLimiter,
} from '../../../../app/src/infrastructure/RateLimiter.mjs'
import LoginRateLimiter from '../../../../app/src/Features/Security/LoginRateLimiter.mjs'

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

export default { run }
