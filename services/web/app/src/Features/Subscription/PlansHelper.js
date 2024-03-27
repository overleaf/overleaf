const FeaturesHelper = require('./FeaturesHelper')
const PlanLocator = require('./PlansLocator')

function isProfessionalPlan(planCode) {
  const plan = PlanLocator.findLocalPlanInSettings(planCode)
  // only identify "modern" professional group plans as eligible, and do not include legacy plans
  return Boolean(
    planCode?.includes('professional') &&
      FeaturesHelper.getMatchedFeatureSet(plan?.features) === 'professional'
  )
}

function isProfessionalGroupPlan(subscription) {
  const isProfessional = isProfessionalPlan(subscription.planCode)
  return subscription.groupPlan && isProfessional
}

module.exports = {
  isProfessionalPlan,
  isProfessionalGroupPlan,
}
