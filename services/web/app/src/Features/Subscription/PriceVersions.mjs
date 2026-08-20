// @ts-check

import Settings from '@overleaf/settings'

/**
 * @typedef {import('../../../../types/subscription/plan').StripeLookupKeyVersion} StripeLookupKeyVersion
 */

// The version new subscriptions are priced at, unless overridden by the getPriceVersion/getPriceVersionForUser hooks.
/** @type {StripeLookupKeyVersion} */
export const DEFAULT_PRICE_VERSION = 'feb2026'

// Every version we currently serve prices at: the default, plus any additional defined
// versions. Only prices NEW subscriptions
// can start at, not retired prices that existing subscriptions might still be
// on.
/** @type {StripeLookupKeyVersion[]} */
export const PRICE_VERSIONS = [
  DEFAULT_PRICE_VERSION,
  // These additional versions include the new price
  ...(Settings.additionalPriceVersions ?? []),
]

// How coarsely the per-month price of an annually billed plan is rounded for
// display, unless a price version overrides it.
const DEFAULT_ROUNDING_INCREMENT = 0.05
const NEW_PRICES_ROUNDING_INCREMENT = 0.25

/**
 * The per-month price shown when a plan or add-on is billed annually: the
 * annual price divided by twelve, rounded up to the nearest increment for a
 * tidy display value.
 *
 * @param {StripeLookupKeyVersion} version
 * @returns {(annual: number) => number}
 */
export function getRoundedTwelfth(version) {
  const increment =
    version === DEFAULT_PRICE_VERSION
      ? DEFAULT_ROUNDING_INCREMENT
      : NEW_PRICES_ROUNDING_INCREMENT
  return annual =>
    Math.round(Math.ceil(annual / 12 / increment) * increment * 100) / 100
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

/** @type {Map<StripeLookupKeyVersion, any>} */
const localizedPlanPricingCache = new Map()

/**
 * The localized plan pricing table for a price version:
 * Settings.localizedPlanPricing with the version's overrides from
 * Settings.localizedPlanPricingByVersion applied on top.
 *
 * @param {StripeLookupKeyVersion} version
 * @returns {any}
 */
export function getLocalizedPlanPricing(version) {
  const overrides = Settings.localizedPlanPricingByVersion?.[version]
  if (!overrides) {
    return Settings.localizedPlanPricing
  }
  let pricing = localizedPlanPricingCache.get(version)
  if (!pricing) {
    pricing = {}
    for (const [currency, plans] of Object.entries(
      Settings.localizedPlanPricing
    )) {
      pricing[currency] = {}
      for (const [plan, prices] of Object.entries(plans)) {
        pricing[currency][plan] = {
          ...prices,
          ...overrides[currency]?.[plan],
        }
      }
    }
    localizedPlanPricingCache.set(version, pricing)
  }
  return pricing
}
