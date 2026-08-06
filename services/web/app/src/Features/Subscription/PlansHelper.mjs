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

// How coarsely the per-month price of an annually billed plan is rounded for
// display, unless a price version overrides it.
export const DEFAULT_ROUNDING_INCREMENT = 0.05

/**
 * The per-month price shown when a plan or add-on is billed annually: the
 * annual price divided by twelve, rounded up to the nearest increment for a
 * tidy display value.
 *
 * @param {number} annual
 * @param {number} [increment]
 * @returns {number}
 */
export function roundedTwelfth(annual, increment = DEFAULT_ROUNDING_INCREMENT) {
  return Math.round(Math.ceil(annual / 12 / increment) * increment * 100) / 100
}

/**
 * The saving from billing annually rather than monthly, as a fraction of what a
 * year of monthly billing would cost.
 *
 * @param {number} monthly
 * @param {number} annual
 * @returns {number}
 */
export function annualSavings(monthly, annual) {
  return 1 - annual / (monthly * 12)
}

export default {
  isProfessionalPlan,
  isProfessionalGroupPlan,
  roundedTwelfth,
  annualSavings,
}
