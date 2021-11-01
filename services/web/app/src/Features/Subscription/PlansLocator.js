const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')

function ensurePlansAreSetupCorrectly() {
  Settings.plans.forEach(plan => {
    if (typeof plan.price !== 'number') {
      logger.fatal({ plan }, 'missing price on plan')
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
