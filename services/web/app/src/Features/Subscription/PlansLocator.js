// TODO: This file may be deleted when Stripe is fully implemented to all users, so, consider deleting it
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')

/**
 * @typedef {import('../../../../types/subscription/plan').RecurlyPlanCode} RecurlyPlanCode
 * @typedef {import('../../../../types/subscription/plan').StripeLookupKey} StripeLookupKey
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
}

const stripeLookupKeyToRecurlyPlanCode = {
  professional_annual: 'professional-annual',
  professional_monthly: 'professional',
  standard_annual: 'collaborator-annual',
  standard_monthly: 'collaborator',
  student_annual: 'student-annual',
  student_monthly: 'student',
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
 * @param {StripeLookupKey} stripeLookupKey
 * @returns {RecurlyPlanCode}
 */
function mapStripeLookupKeyToRecurlyPlanCode(stripeLookupKey) {
  return stripeLookupKeyToRecurlyPlanCode[stripeLookupKey]
}

const recurlyPlanCodeToPlanTypeAndPeriod = {
  collaborator: { planType: 'standard', period: 'monthly' },
  collaborator_free_trial_7_days: { planType: 'standard', period: 'monthly' },
  'collaborator-annual': { planType: 'standard', period: 'annual' },
  professional: { planType: 'professional', period: 'monthly' },
  professional_free_trial_7_days: {
    planType: 'professional',
    period: 'monthly',
  },
  'professional-annual': { planType: 'professional', period: 'annual' },
  student: { planType: 'student', period: 'monthly' },
  student_free_trial_7_days: { planType: 'student', period: 'monthly' },
  'student-annual': { planType: 'student', period: 'annual' },
}

/**
 *
 * @param {RecurlyPlanCode} recurlyPlanCode
 * @returns {{ planType: 'standard' | 'professional' | 'student', period: 'annual' | 'monthly'}}
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
  mapStripeLookupKeyToRecurlyPlanCode,
  getPlanTypeAndPeriodFromRecurlyPlanCode,
}
