import { callbackify } from 'node:util'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import UserUpdater from '../User/UserUpdater.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import Modules from '../../infrastructure/Modules.mjs'

function setBetaProgramUserProperty(userId, betaProgram) {
  Modules.promises.hooks
    .fire('setUserProperties', userId, { beta_program: betaProgram })
    .catch(err => {
      logger.error(
        { err, userId },
        'Failed to set beta_program user property for customer.io'
      )
    })
}

async function optIn(session, userId) {
  await UserUpdater.promises.updateUser(userId, { $set: { betaProgram: true } })
  metrics.inc('beta-program.opt-in')
  AnalyticsManager.setUserPropertyForSessionInBackground(
    session,
    'beta-program',
    true
  )
  setBetaProgramUserProperty(userId, true)
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
  setBetaProgramUserProperty(userId, false)
}

export default {
  optIn: callbackify(optIn),
  optOut: callbackify(optOut),
  promises: {
    optIn,
    optOut,
  },
}
