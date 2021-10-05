const { callbackify } = require('util')
const metrics = require('@overleaf/metrics')
const UserUpdater = require('../User/UserUpdater')
const AnalyticsManager = require('../Analytics/AnalyticsManager')

async function optIn(userId) {
  await UserUpdater.promises.updateUser(userId, { $set: { betaProgram: true } })
  metrics.inc('beta-program.opt-in')
  AnalyticsManager.setUserPropertyForUser(userId, 'beta-program', true)
}

async function optOut(userId) {
  await UserUpdater.promises.updateUser(userId, {
    $set: { betaProgram: false },
  })
  metrics.inc('beta-program.opt-out')
  AnalyticsManager.setUserPropertyForUser(userId, 'beta-program', false)
}

const BetaProgramHandler = {
  optIn: callbackify(optIn),

  optOut: callbackify(optOut),
}

BetaProgramHandler.promises = {
  optIn,
  optOut,
}

module.exports = BetaProgramHandler
