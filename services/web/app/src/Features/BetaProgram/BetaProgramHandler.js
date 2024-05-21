const { callbackify } = require('util')
const metrics = require('@overleaf/metrics')
const UserUpdater = require('../User/UserUpdater')
const AnalyticsManager = require('../Analytics/AnalyticsManager')

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

module.exports = {
  optIn: callbackify(optIn),
  optOut: callbackify(optOut),
  promises: {
    optIn,
    optOut,
  },
}
