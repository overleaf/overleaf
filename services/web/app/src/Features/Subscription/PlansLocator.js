const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')

function ensurePlansAreSetupCorrectly() {
  Settings.plans.forEach(plan => {
    if (typeof plan.price_in_cents !== 'number') {
      logger.fatal({ plan }, 'missing price on plan')
      process.exit(1)
    }
    if (plan.price) {
      logger.fatal({ plan }, 'unclear price attribute on plan')
      process.exit(1)
    }
    if (plan.price_in_unit) {
      logger.fatal({ plan }, 'deprecated price_in_unit attribute on plan')
      process.exit(1)
    }
  })
}

function findLocalPlanInSettings(planCode) {
  for (const plan of Settings.plans) {
    if (plan.planCode === planCode) {
      return plan
    }
  }
  return null
}

module.exports = {
  ensurePlansAreSetupCorrectly,
  findLocalPlanInSettings,
}
