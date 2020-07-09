const { callbackify } = require('util')
const metrics = require('metrics-sharelatex')
const UserUpdater = require('../User/UserUpdater')

async function optIn(userId) {
  await UserUpdater.promises.updateUser(userId, { $set: { betaProgram: true } })
  metrics.inc('beta-program.opt-in')
}

async function optOut(userId) {
  await UserUpdater.promises.updateUser(userId, {
    $set: { betaProgram: false }
  })
  metrics.inc('beta-program.opt-out')
}

const BetaProgramHandler = {
  optIn: callbackify(optIn),

  optOut: callbackify(optOut)
}

BetaProgramHandler.promises = {
  optIn,
  optOut
}

module.exports = BetaProgramHandler
