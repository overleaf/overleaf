const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

function ensurePlansAreSetupCorrectly() {
  Settings.plans.forEach(plan => {
    if (typeof plan.price !== 'number') {
      logger.fatal({ plan }, 'missing price on plan')
      process.exit(1)
    }
  })
}

function findLocalPlanInSettings(planCode) {
  for (let plan of Settings.plans) {
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
