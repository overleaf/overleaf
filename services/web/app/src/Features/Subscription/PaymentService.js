// @ts-check

const RecurlyClient = require('./RecurlyClient.js')
const logger = require('@overleaf/logger')
const { callbackify } = require('util')

/**
 * @import { RecurlySubscription, RecurlyAccount, RecurlyCoupon } from "./RecurlyEntities"
 * @import { ObjectId } from 'mongodb'
 */

/**
 * this represents a subset of the Mongo Subscription record
 *
 * @typedef {object} MongoSubscription
 * @property {ObjectId} admin_id
 * @property {string} [recurlySubscription_id]
 */

/**
 * @typedef {object} PaymentRecord
 * @property {RecurlySubscription} subscription
 * @property {RecurlyAccount | null} account
 * @property {RecurlyCoupon[]} coupons
 */

/**
 * Get payment information from our Mongo record
 *
 * @param {MongoSubscription} subscription
 * @return {Promise<PaymentRecord | null>}
 */
async function getPaymentFromRecord(subscription) {
  if (subscription == null) {
    logger.debug('no subscription provided')
    return null
  }
  const userId = (subscription.admin_id._id || subscription.admin_id).toString()
  const recurlySubscriptionId = subscription.recurlySubscription_id

  // TODO: handle non-recurly payment records
  if (recurlySubscriptionId == null || recurlySubscriptionId === '') {
    logger.debug(
      { userId },
      "no recurly subscription id found for user's subscription"
    )
    return null
  }

  const subscriptionResponse = await RecurlyClient.promises.getSubscription(
    recurlySubscriptionId
  )
  if (!subscriptionResponse) {
    logger.debug(
      { recurlySubscriptionId },
      'no recurly subscription found for subscription id'
    )
    return null
  }

  const accountResponse =
    await RecurlyClient.promises.getAccountForUserId(userId)
  const accountCoupons =
    await RecurlyClient.promises.getActiveCouponsForUserId(userId)

  // TODO: include account and coupons in subscription class instead of separately here
  // if Recurly is removed (Recurly needs 2 extra requests to get account & coupon data)
  return {
    subscription: subscriptionResponse,
    account: accountResponse,
    coupons: accountCoupons,
  }
}

module.exports = {
  getPaymentFromRecord: callbackify(getPaymentFromRecord),

  promises: {
    getPaymentFromRecord,
  },
}
