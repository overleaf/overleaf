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
  ...(Settings.additionalPriceVersions ?? []),
]

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
