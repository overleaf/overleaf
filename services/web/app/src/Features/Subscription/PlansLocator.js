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
  collaborator: 'collaborator_may2025',
  'collaborator-annual': 'collaborator_annual_may2025',
  collaborator_free_trial_7_days: 'collaborator_may2025',

  professional: 'professional_may2025',
  'professional-annual': 'professional_annual_may2025',
  professional_free_trial_7_days: 'professional_may2025',

  student: 'student_may2025',
  'student-annual': 'student_annual_may2025',
  student_free_trial_7_days: 'student_may2025',

  // TODO: change all group plans' lookup_keys to match the UK account after they have been added
  group_collaborator: 'group_standard_enterprise',
  group_collaborator_educational: 'group_standard_educational',
  group_professional: 'group_professional_enterprise',
  group_professional_educational: 'group_professional_educational',

  assistant: 'assistant_may2025',
  'assistant-annual': 'assistant_annual_may2025',
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
      return 'assistant_may2025'
    }
    if (billingCycleInterval === 'year') {
      return 'assistant_annual_may2025'
    }
  }
  return null
}

const recurlyPlanCodeToPlanTypeAndPeriod = {
  collaborator: { planType: 'individual', period: 'monthly' },
  'collaborator-annual': { planType: 'individual', period: 'annual' },
  collaborator_free_trial_7_days: { planType: 'individual', period: 'monthly' },

  professional: { planType: 'individual', period: 'monthly' },
  'professional-annual': { planType: 'individual', period: 'annual' },
  professional_free_trial_7_days: {
    planType: 'individual',
    period: 'monthly',
  },

  student: { planType: 'student', period: 'monthly' },
  'student-annual': { planType: 'student', period: 'annual' },
  student_free_trial_7_days: { planType: 'student', period: 'monthly' },

  group_collaborator: { planType: 'group', period: 'annual' },
  group_collaborator_educational: { planType: 'group', period: 'annual' },
  group_professional: { planType: 'group', period: 'annual' },
  group_professional_educational: { planType: 'group', period: 'annual' },

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
