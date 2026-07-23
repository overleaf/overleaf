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

/**
 * The per-month price shown when a plan or add-on is billed annually: the
 * annual price divided by twelve, rounded up to the nearest 0.05 for a tidy
 * display value.
 *
 * @param {number} annual
 * @returns {number}
 */
export function roundedTwelfth(annual) {
  return Math.round(Math.ceil(annual / 12 / 0.05) * 5) / 100
}

export default {
  isProfessionalPlan,
  isProfessionalGroupPlan,
  roundedTwelfth,
}
