// TODO: This file may be deleted when Stripe is fully implemented to all users, so, consider deleting it
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')

/**
 * @typedef {import('../../../../types/subscription/plan').RecurlyPlanCode} RecurlyPlanCode
 * @typedef {import('../../../../types/subscription/plan').RecurlyAddOnCode} RecurlyAddOnCode
 * @typedef {import('../../../../types/subscription/plan').StripeLookupKey} StripeLookupKey
 * @typedef {import('stripe').Stripe.Price.Recurring.Interval} BillingCycleInterval
 */

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

const recurlyPlanCodeToStripeLookupKey = {
  'professional-annual': 'professional_annual',
  professional: 'professional_monthly',
  professional_free_trial_7_days: 'professional_monthly',
  'collaborator-annual': 'standard_annual',
  collaborator: 'standard_monthly',
  collaborator_free_trial_7_days: 'standard_monthly',
  'student-annual': 'student_annual',
  student: 'student_monthly',
  student_free_trial_7_days: 'student_monthly',
  group_professional: 'group_professional_enterprise',
  group_professional_educational: 'group_professional_educational',
  group_collaborator: 'group_standard_enterprise',
  group_collaborator_educational: 'group_standard_educational',
  'assistant-annual': 'error_assist_annual',
  assistant: 'error_assist_monthly',
}

/**
 *
 * @param {RecurlyPlanCode} recurlyPlanCode
 * @returns {StripeLookupKey}
 */
function mapRecurlyPlanCodeToStripeLookupKey(recurlyPlanCode) {
  return recurlyPlanCodeToStripeLookupKey[recurlyPlanCode]
}

/**
 *
 * @param {RecurlyAddOnCode} recurlyAddOnCode
 * @param {BillingCycleInterval} billingCycleInterval
 * @returns {StripeLookupKey|null}
 */
function mapRecurlyAddOnCodeToStripeLookupKey(
  recurlyAddOnCode,
  billingCycleInterval
) {
  // Recurly always uses 'assistant' as the code regardless of the subscription duration
  if (recurlyAddOnCode === 'assistant') {
    if (billingCycleInterval === 'month') {
      return 'error_assist_monthly'
    }
    if (billingCycleInterval === 'year') {
      return 'error_assist_annual'
    }
  }
  return null
}

const recurlyPlanCodeToPlanTypeAndPeriod = {
  collaborator: { planType: 'individual', period: 'monthly' },
  collaborator_free_trial_7_days: { planType: 'individual', period: 'monthly' },
  'collaborator-annual': { planType: 'individual', period: 'annual' },
  professional: { planType: 'individual', period: 'monthly' },
  professional_free_trial_7_days: {
    planType: 'individual',
    period: 'monthly',
  },
  'professional-annual': { planType: 'individual', period: 'annual' },
  student: { planType: 'student', period: 'monthly' },
  student_free_trial_7_days: { planType: 'student', period: 'monthly' },
  'student-annual': { planType: 'student', period: 'annual' },
  group_professional: { planType: 'group', period: 'annual' },
  group_professional_educational: { planType: 'group', period: 'annual' },
  group_collaborator: { planType: 'group', period: 'annual' },
  group_collaborator_educational: { planType: 'group', period: 'annual' },
  assistant: { planType: null, period: 'monthly' },
  'assistant-annual': { planType: null, period: 'annual' },
}

/**
 *
 * @param {RecurlyPlanCode} recurlyPlanCode
 * @returns {{ planType: 'individual' | 'group' | 'student' | null, period: 'annual' | 'monthly'}}
 */
function getPlanTypeAndPeriodFromRecurlyPlanCode(recurlyPlanCode) {
  return recurlyPlanCodeToPlanTypeAndPeriod[recurlyPlanCode]
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
  mapRecurlyPlanCodeToStripeLookupKey,
  mapRecurlyAddOnCodeToStripeLookupKey,
  getPlanTypeAndPeriodFromRecurlyPlanCode,
}
