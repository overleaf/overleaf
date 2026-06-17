import { callbackify } from 'node:util'
import metrics from '@overleaf/metrics'
import UserUpdater from '../User/UserUpdater.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'

async function optIn(session, userId) {
  await UserUpdater.promises.updateUser(userId, { $set: { betaProgram: true } })
  metrics.inc('beta-program.opt-in')
  AnalyticsManager.setUserPropertyForSessionInBackground(
    session,
    'beta-program',
    true
  )
}

async function optOut(session, userId) {
  await UserUpdater.promises.updateUser(userId, {
    $set: { betaProgram: false },
  })
  metrics.inc('beta-program.opt-out')
  AnalyticsManager.setUserPropertyForSessionInBackground(
    session,
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
