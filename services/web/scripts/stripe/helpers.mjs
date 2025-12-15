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
