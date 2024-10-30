// @ts-check

const recurly = require('recurly')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')
const { callbackify } = require('util')
const UserGetter = require('../User/UserGetter')
const {
  RecurlySubscription,
  RecurlySubscriptionAddOn,
} = require('./RecurlyEntities')

/**
 * @import { RecurlySubscriptionChangeRequest } from './RecurlyEntities'
 */

const recurlySettings = Settings.apis.recurly
const recurlyApiKey = recurlySettings ? recurlySettings.apiKey : undefined

const client = new recurly.Client(recurlyApiKey)

async function getAccountForUserId(userId) {
  try {
    return await client.getAccount(`code-${userId}`)
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      // An expected error, we don't need to handle it, just return nothing
      logger.debug({ userId }, 'no recurly account found for user')
    } else {
      throw err
    }
  }
}

async function createAccountForUserId(userId) {
  const user = await UserGetter.promises.getUser(userId, {
    _id: 1,
    first_name: 1,
    last_name: 1,
    email: 1,
  })
  const accountCreate = {
    code: user._id.toString(),
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
  }
  const account = await client.createAccount(accountCreate)
  logger.debug({ userId, account }, 'created recurly account')
  return account
}

/**
 * Get a subscription from Recurly
 *
 * @param {string} subscriptionId
 * @return {Promise<RecurlySubscription>}
 */
async function getSubscription(subscriptionId) {
  const subscription = await client.getSubscription(`uuid-${subscriptionId}`)
  return makeSubscription(subscription)
}

/**
 * Request a susbcription change from Recurly
 *
 * @param {RecurlySubscriptionChangeRequest} changeRequest
 */
async function applySubscriptionChangeRequest(changeRequest) {
  /** @type {recurly.SubscriptionChangeCreate} */
  const body = {
    timeframe: changeRequest.timeframe,
  }
  if (changeRequest.planCode != null) {
    body.planCode = changeRequest.planCode
  }
  if (changeRequest.addOnUpdates != null) {
    body.addOns = changeRequest.addOnUpdates.map(addOnUpdate => {
      /** @type {recurly.SubscriptionAddOnUpdate} */
      const update = { code: addOnUpdate.code }
      if (addOnUpdate.quantity != null) {
        update.quantity = addOnUpdate.quantity
      }
      if (addOnUpdate.unitPrice != null) {
        update.unitAmount = addOnUpdate.unitPrice
      }
      return update
    })
  }
  const change = await client.createSubscriptionChange(
    `uuid-${changeRequest.subscriptionId}`,
    body
  )
  logger.debug(
    { subscriptionId: changeRequest.subscriptionId, changeId: change.id },
    'created subscription change'
  )
}

async function removeSubscriptionChange(subscriptionId) {
  const removed = await client.removeSubscriptionChange(subscriptionId)
  logger.debug({ subscriptionId }, 'removed pending subscription change')
  return removed
}

async function removeSubscriptionChangeByUuid(subscriptionUuid) {
  return await removeSubscriptionChange('uuid-' + subscriptionUuid)
}

async function reactivateSubscriptionByUuid(subscriptionUuid) {
  return await client.reactivateSubscription('uuid-' + subscriptionUuid)
}

async function cancelSubscriptionByUuid(subscriptionUuid) {
  try {
    return await client.cancelSubscription('uuid-' + subscriptionUuid)
  } catch (err) {
    if (err instanceof recurly.errors.ValidationError) {
      if (
        err.message === 'Only active and future subscriptions can be canceled.'
      ) {
        logger.debug(
          { subscriptionUuid },
          'subscription cancellation failed, subscription not active'
        )
      }
    } else {
      throw err
    }
  }
}

function subscriptionIsCanceledOrExpired(subscription) {
  const state = subscription?.recurlyStatus?.state
  return state === 'canceled' || state === 'expired'
}

/**
 * Build a RecurlySubscription from Recurly API data
 *
 * @param {recurly.Subscription} subscription
 * @return {RecurlySubscription}
 */
function makeSubscription(subscription) {
  if (
    subscription.uuid == null ||
    subscription.plan == null ||
    subscription.plan.code == null ||
    subscription.plan.name == null ||
    subscription.account == null ||
    subscription.account.code == null ||
    subscription.unitAmount == null ||
    subscription.subtotal == null ||
    subscription.total == null ||
    subscription.currency == null
  ) {
    throw new OError('Invalid Recurly subscription', { subscription })
  }
  return new RecurlySubscription({
    id: subscription.uuid,
    userId: subscription.account.code,
    planCode: subscription.plan.code,
    planName: subscription.plan.name,
    planPrice: subscription.unitAmount,
    addOns: (subscription.addOns ?? []).map(makeSubscriptionAddOn),
    subtotal: subscription.subtotal,
    taxRate: subscription.taxInfo?.rate ?? 0,
    taxAmount: subscription.tax ?? 0,
    total: subscription.total,
    currency: subscription.currency,
  })
}

/**
 * Build a RecurlySubscriptionAddOn from Recurly API data
 *
 * @param {recurly.SubscriptionAddOn} addOn
 * @return {RecurlySubscriptionAddOn}
 */
function makeSubscriptionAddOn(addOn) {
  if (
    addOn.addOn == null ||
    addOn.addOn.code == null ||
    addOn.addOn.name == null ||
    addOn.unitAmount == null
  ) {
    throw new OError('Invalid Recurly add-on', { addOn })
  }

  return new RecurlySubscriptionAddOn({
    code: addOn.addOn.code,
    name: addOn.addOn.name,
    quantity: addOn.quantity ?? 1,
    unitPrice: addOn.unitAmount,
  })
}

module.exports = {
  errors: recurly.errors,

  getAccountForUserId: callbackify(getAccountForUserId),
  createAccountForUserId: callbackify(createAccountForUserId),
  getSubscription: callbackify(getSubscription),
  applySubscriptionChangeRequest: callbackify(applySubscriptionChangeRequest),
  removeSubscriptionChange: callbackify(removeSubscriptionChange),
  removeSubscriptionChangeByUuid: callbackify(removeSubscriptionChangeByUuid),
  reactivateSubscriptionByUuid: callbackify(reactivateSubscriptionByUuid),
  cancelSubscriptionByUuid: callbackify(cancelSubscriptionByUuid),
  subscriptionIsCanceledOrExpired,

  promises: {
    getSubscription,
    getAccountForUserId,
    createAccountForUserId,
    applySubscriptionChangeRequest,
    removeSubscriptionChange,
    removeSubscriptionChangeByUuid,
    reactivateSubscriptionByUuid,
    cancelSubscriptionByUuid,
  },
}
