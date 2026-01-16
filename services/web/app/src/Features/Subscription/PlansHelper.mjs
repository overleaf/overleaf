import FeaturesHelper from './FeaturesHelper.mjs'
import PlanLocator from './PlansLocator.mjs'

export function isProfessionalPlan(planCode) {
  const plan = PlanLocator.findLocalPlanInSettings(planCode)
  // only identify "modern" professional group plans as eligible, and do not include legacy plans
  return Boolean(
    planCode?.includes('professional') &&
    FeaturesHelper.getMatchedFeatureSet(plan?.features) === 'professional'
  )
}

export function isProfessionalGroupPlan(subscription) {
  const isProfessional = isProfessionalPlan(subscription.planCode)
  return subscription.groupPlan && isProfessional
}

export default {
  isProfessionalPlan,
  isProfessionalGroupPlan,
}
