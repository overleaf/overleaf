/* eslint-disable @overleaf/require-script-runner */
// This file contains helper functions used by other scripts.
// The scripts that import these helpers should use Script Runner.

/**
 * @import Stripe from 'stripe'
 * @import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'
 */

/**
 * @export
 * @typedef {Object} CSVSubscriptionChange
 * @property {string} subscription_id
 * @property {string} current_lookup_key
 * @property {string} new_lookup_key
 * @property {string} current_add_on_lookup_key
 * @property {string} new_add_on_lookup_key
 */

/**
 * @export
 * @typedef {'renewal' | 'now'} Timeframe
 */

/**
 * @export
 * @typedef {ReturnType<typeof getRegionClient>} StripeClient
 */

/**
 * Custom error class for reportable errors that should be written to CSV output
 */
export class ReportError extends Error {
  /**
   * @param {string} status - The error status code for CSV output
   * @param {string} message - The error message
   */
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/**
 * Gets the product ID from a Stripe Subscription Item
 *
 * @param {Stripe.SubscriptionItem | Stripe.SubscriptionSchedule.Phase.Item} item
 * @returns {string}
 */
export function getProductIdFromItem(item) {
  const product =
    typeof item.price === 'string'
      ? null
      : 'product' in item.price
        ? item.price.product
        : null
  return typeof product === 'string' ? product : (product?.id ?? '')
}

/**
 * Gets the price ID from a Stripe Subscription Item
 *
 * @param {Stripe.SubscriptionItem | Stripe.SubscriptionSchedule.Phase.Item} item
 * @returns {string}
 */
export function getPriceIdFromItem(item) {
  return typeof item.price === 'string' ? item.price : (item.price?.id ?? '')
}

/**
 * Gets the product ID from a Stripe Price object
 *
 * @param {Stripe.Price} price
 * @returns {string}
 */
export function getProductIdFromPrice(price) {
  return typeof price.product === 'string'
    ? price.product
    : (price.product?.id ?? '')
}

/**
 * Sleep function to respect Stripe rate limits (100 requests per second)
 */
export async function rateLimitSleep() {
  return new Promise(resolve => setTimeout(resolve, 50))
}

/**
 * Convert amount to minor units (cents for most currencies)
 * Some currencies like JPY, KRW, CLP, VND don't have cents
 *
 * Copied from services/web/frontend/js/shared/utils/currency.ts
 *
 * @param {number} amount - Amount in major units (dollars, euros, etc.)
 * @param {string} currency - Currency code (lowercase)
 * @returns {number} Amount in minor units
 */
export function convertToMinorUnits(amount, currency) {
  const isNoCentsCurrency = ['clp', 'jpy', 'krw', 'vnd'].includes(
    currency.toLowerCase()
  )

  // Determine the multiplier based on currency
  let multiplier = 100 // default for most currencies (2 decimal places)

  if (isNoCentsCurrency) {
    multiplier = 1 // no decimal places
  }

  // Convert and round to an integer
  return Math.round(amount * multiplier)
}

/**
 * Convert amount from minor units (cents for most currencies)
 * Some currencies like JPY, KRW, CLP, VND don't have cents
 *
 * Copied from services/web/modules/subscriptions/app/src/StripeClient.mjs
 *
 * @param {number} amount - price in the smallest currency unit (e.g. dollar cents, CLP units, ...)
 * @param {StripeCurrencyCode} currency - currency code
 * @return {number}
 */
export function convertFromMinorUnits(amount, currency) {
  const isNoCentsCurrency = ['clp', 'jpy', 'krw', 'vnd'].includes(
    currency.toLowerCase()
  )
  return isNoCentsCurrency ? amount : amount / 100
}
