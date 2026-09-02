// @ts-check

import Settings from '@overleaf/settings'

import logger from '@overleaf/logger'

import { DEFAULT_PRICE_VERSION, PRICE_VERSIONS } from './PriceVersions.mjs'

/**
 * @typedef {import('../../../../types/subscription/plan').RecurlyPlanCode} RecurlyPlanCode
 * @typedef {import('../../../../types/subscription/plan').StripeLookupKey} StripeLookupKey
 * @typedef {import('../../../../types/subscription/plan').StripeBaseLookupKey} StripeBaseLookupKey
 * @typedef {import('../../../../types/subscription/plan').StripeLookupKeyVersion} StripeLookupKeyVersion
 * @typedef {import('../../../../types/subscription/plan').Plan} Plan
 * @typedef {import('../../../../types/subscription/currency').StripeCurrencyCode} StripeCurrencyCode
 * @typedef {import('stripe').Stripe.Price.Recurring.Interval} BillingCycleInterval
 */

function ensurePlansAreSetupCorrectly() {
  Settings.plans.forEach(
    /** @param {any} plan */ plan => {
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
    }
  )
}

/**
 * @type {Record<RecurlyPlanCode, StripeBaseLookupKey>}
 */
const recurlyCodeToStripeBaseLookupKey = {
  collaborator: 'standard_monthly',
  'collaborator-annual': 'standard_annual',
  collaborator_free_trial_7_days: 'standard_monthly',

  professional: 'professional_monthly',
  'professional-annual': 'professional_annual',
  professional_free_trial_7_days: 'professional_monthly',

  student: 'student_monthly',
  'student-annual': 'student_annual',
  student_free_trial_7_days: 'student_monthly',

  group_collaborator: 'group_standard_enterprise',
  group_collaborator_educational: 'group_standard_educational',
  group_professional: 'group_professional_enterprise',
  group_professional_educational: 'group_professional_educational',

  assistant: 'assistant_monthly',
  'assistant-annual': 'assistant_annual',
}

const DEFAULT_STRIPE_LOOKUP_KEY_VERSION = DEFAULT_PRICE_VERSION
const STRIPE_LOOKUP_KEY_VERSIONS = PRICE_VERSIONS

/**
 * Extract the version from a Stripe lookup key, so that changes to an existing
 * subscription can be priced at the version it was created with.
 *
 * Only currently served versions are recognised: a subscription still priced at
 * a retired version returns undefined, so we fall back to the default.
 *
 * @param {string|null|undefined} lookupKey
 * @returns {StripeLookupKeyVersion|undefined} undefined if the key has no
 * currently served version
 */
function getVersionFromStripeLookupKey(lookupKey) {
  if (!lookupKey) {
    return undefined
  }
  return STRIPE_LOOKUP_KEY_VERSIONS.find(version =>
    lookupKey.includes(`_${version}_`)
  )
}

/**
 * Build the Stripe lookup key, will be in this format:
 * `${productCode}_${billingInterval}_${version}_${currency}`
 * (for example: 'assistant_annual_jun2025_clp')
 *
 * @param {RecurlyPlanCode} recurlyCode
 * @param {StripeCurrencyCode} currency
 * @param {BillingCycleInterval} [billingCycleInterval] -- needed for handling 'assistant' add-on
 * @param {StripeLookupKeyVersion} [lookupKeyVersion]
 * @returns {StripeLookupKey|null}
 */
function buildStripeLookupKey(
  recurlyCode,
  currency,
  billingCycleInterval,
  lookupKeyVersion = DEFAULT_STRIPE_LOOKUP_KEY_VERSION
) {
  let stripeBaseLookupKey = recurlyCodeToStripeBaseLookupKey[recurlyCode]

  // Recurly always uses 'assistant' as the code regardless of the subscription duration
  if (recurlyCode === 'assistant' && billingCycleInterval) {
    if (billingCycleInterval === 'month') {
      stripeBaseLookupKey = 'assistant_monthly'
    }
    if (billingCycleInterval === 'year') {
      stripeBaseLookupKey = 'assistant_annual'
    }
  }

  if (stripeBaseLookupKey == null) {
    return null
  }

  return `${stripeBaseLookupKey}_${lookupKeyVersion}_${currency}`
}

/**
 * @typedef {{ planType: 'individual' | 'group' | 'student' | null, period: 'annual' | 'monthly' }} PlanTypeAndPeriod
 * @type {Record<RecurlyPlanCode, PlanTypeAndPeriod>}
 */
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
 * @param {string} key
 * @returns {key is RecurlyPlanCode}
 */
function isRecurlyPlanCode(key) {
  return Object.hasOwn(recurlyPlanCodeToPlanTypeAndPeriod, key)
}

/**
 * @param {string} recurlyPlanCode
 * @returns {PlanTypeAndPeriod | undefined}
 */
function getPlanTypeAndPeriodFromRecurlyPlanCode(recurlyPlanCode) {
  if (!isRecurlyPlanCode(recurlyPlanCode)) return undefined
  return recurlyPlanCodeToPlanTypeAndPeriod[recurlyPlanCode]
}

/**
 * Prefer this over `getPlanTypeAndPeriodFromRecurlyPlanCode` when you have the
 * plan: that map misses legacy plan codes and license-count group plan codes.
 *
 * @param {{ plan?: { annual?: boolean } } | null} [subscription] anything carrying a local plan
 * @returns {'annual' | 'monthly' | null}
 */
function getPlanCadence(subscription) {
  if (!subscription?.plan) return null
  return subscription.plan.annual ? 'annual' : 'monthly'
}

/**
 * @param {string|null} [planCode]
 * @returns {Plan|null}
 */
function findLocalPlanInSettings(planCode) {
  for (const plan of Settings.plans) {
    if (plan.planCode === planCode) {
      return plan
    }
  }
  return null
}

/**
 * Returns whether the given plan code is a group plan
 *
 * @param {string} planCode
 */
function isGroupPlanCode(planCode) {
  return planCode.includes('group')
}

/**
 * Adapts a legacy Recurly group plan code (e.g., `group_professional_5_educational`)
 * into its corresponding Stripe-compatible plan code (e.g., `group_professional_educational`),
 * extracting the license quantity where applicable.
 *
 *  @param {string} planCode
 * @returns {{ planCode: string, quantity: number }}
 */
function convertLegacyGroupPlanCodeToConsolidatedGroupPlanCodeIfNeeded(
  planCode
) {
  const pattern =
    /^group_(collaborator|professional)_(2|3|4|5|10|20|50)_(educational|enterprise)$/

  const match = planCode.match(pattern)
  if (match == null) {
    return { planCode, quantity: 1 }
  }

  const [, tier, size, usage] = match
  const newPlanCode = /** @type {RecurlyPlanCode} */ (
    usage === 'enterprise' ? `group_${tier}` : `group_${tier}_${usage}`
  )

  return { planCode: newPlanCode, quantity: Number(size) }
}

export default {
  ensurePlansAreSetupCorrectly,
  findLocalPlanInSettings,
  buildStripeLookupKey,
  getPlanTypeAndPeriodFromRecurlyPlanCode,
  getPlanCadence,
  isGroupPlanCode,
  convertLegacyGroupPlanCodeToConsolidatedGroupPlanCodeIfNeeded,
  getVersionFromStripeLookupKey,
  DEFAULT_STRIPE_LOOKUP_KEY_VERSION,
  STRIPE_LOOKUP_KEY_VERSIONS,
}
