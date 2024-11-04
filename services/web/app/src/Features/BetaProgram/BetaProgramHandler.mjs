import { callbackify } from 'node:util'
import metrics from '@overleaf/metrics'
import UserUpdater from '../User/UserUpdater.js'
import AnalyticsManager from '../Analytics/AnalyticsManager.js'

async function optIn(userId) {
  await UserUpdater.promises.updateUser(userId, { $set: { betaProgram: true } })
  metrics.inc('beta-program.opt-in')
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'beta-program',
    true
  )
}

async function optOut(userId) {
  await UserUpdater.promises.updateUser(userId, {
    $set: { betaProgram: false },
  })
  metrics.inc('beta-program.opt-out')
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'beta-program',
    false
  )
}

export default {
  optIn: callbackify(optIn),
  optOut: callbackify(optOut),
  promises: {
    optIn,
    optOut,
  },
}
