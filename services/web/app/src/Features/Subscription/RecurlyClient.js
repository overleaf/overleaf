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
  RecurlySubscriptionChange,
  PaypalPaymentMethod,
  CreditCardPaymentMethod,
  RecurlyAddOn,
} = require('./RecurlyEntities')

/**
 * @import { RecurlySubscriptionChangeRequest } from './RecurlyEntities'
 * @import { PaymentMethod } from './types'
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
  return subscriptionFromApi(subscription)
}

/**
 * Request a susbcription change from Recurly
 *
 * @param {RecurlySubscriptionChangeRequest} changeRequest
 */
async function applySubscriptionChangeRequest(changeRequest) {
  const body = subscriptionChangeRequestToApi(changeRequest)
  const change = await client.createSubscriptionChange(
    `uuid-${changeRequest.subscription.id}`,
    body
  )
  logger.debug(
    { subscriptionId: changeRequest.subscription.id, changeId: change.id },
    'created subscription change'
  )
}

/**
 * Preview a subscription change
 *
 * @param {RecurlySubscriptionChangeRequest} changeRequest
 * @return {Promise<RecurlySubscriptionChange>}
 */
async function previewSubscriptionChange(changeRequest) {
  const body = subscriptionChangeRequestToApi(changeRequest)
  const subscriptionChange = await client.previewSubscriptionChange(
    `uuid-${changeRequest.subscription.id}`,
    body
  )
  return subscriptionChangeFromApi(
    changeRequest.subscription,
    subscriptionChange
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

/**
 * Get the payment method for the given user
 *
 * @param {string} userId
 * @return {Promise<PaymentMethod>}
 */
async function getPaymentMethod(userId) {
  const billingInfo = await client.getBillingInfo(`code-${userId}`)
  return paymentMethodFromApi(billingInfo)
}

/**
 * Get the configuration for a given add-on
 *
 * @param {string} planCode
 * @param {string} addOnCode
 * @return {Promise<RecurlyAddOn>}
 */
async function getAddOn(planCode, addOnCode) {
  const addOn = await client.getPlanAddOn(
    `code-${planCode}`,
    `code-${addOnCode}`
  )
  return addOnFromApi(addOn)
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
function subscriptionFromApi(subscription) {
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
    subscription.currency == null ||
    subscription.currentPeriodStartedAt == null ||
    subscription.currentPeriodEndsAt == null
  ) {
    throw new OError('Invalid Recurly subscription', { subscription })
  }
  return new RecurlySubscription({
    id: subscription.uuid,
    userId: subscription.account.code,
    planCode: subscription.plan.code,
    planName: subscription.plan.name,
    planPrice: subscription.unitAmount,
    addOns: (subscription.addOns ?? []).map(subscriptionAddOnFromApi),
    subtotal: subscription.subtotal,
    taxRate: subscription.taxInfo?.rate ?? 0,
    taxAmount: subscription.tax ?? 0,
    total: subscription.total,
    currency: subscription.currency,
    periodStart: subscription.currentPeriodStartedAt,
    periodEnd: subscription.currentPeriodEndsAt,
  })
}

/**
 * Build a RecurlySubscriptionAddOn from Recurly API data
 *
 * @param {recurly.SubscriptionAddOn} addOn
 * @return {RecurlySubscriptionAddOn}
 */
function subscriptionAddOnFromApi(addOn) {
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

/**
 * Build a RecurlySubscriptionChange from Recurly API data
 *
 * @param {RecurlySubscription} subscription - the current subscription
 * @param {recurly.SubscriptionChange} subscriptionChange - the subscription change returned from the API
 * @return {RecurlySubscriptionChange}
 */
function subscriptionChangeFromApi(subscription, subscriptionChange) {
  if (
    subscriptionChange.plan == null ||
    subscriptionChange.plan.code == null ||
    subscriptionChange.plan.name == null ||
    subscriptionChange.unitAmount == null
  ) {
    throw new OError('Invalid Recurly subscription change', {
      subscriptionChange,
    })
  }
  const nextAddOns = (subscriptionChange.addOns ?? []).map(
    subscriptionAddOnFromApi
  )
  return new RecurlySubscriptionChange({
    subscription,
    nextPlanCode: subscriptionChange.plan.code,
    nextPlanName: subscriptionChange.plan.name,
    nextPlanPrice: subscriptionChange.unitAmount,
    nextAddOns,
    immediateCharge:
      subscriptionChange.invoiceCollection?.chargeInvoice?.total ?? 0,
  })
}

/**
 * Returns a payment method from Recurly API data
 *
 * @param {recurly.BillingInfo} billingInfo
 * @return {PaymentMethod}
 */
function paymentMethodFromApi(billingInfo) {
  if (billingInfo.paymentMethod == null) {
    throw new OError('Invalid Recurly billing info', { billingInfo })
  }
  const paymentMethod = billingInfo.paymentMethod

  if (paymentMethod.billingAgreementId != null) {
    return new PaypalPaymentMethod()
  }

  if (paymentMethod.cardType == null || paymentMethod.lastFour == null) {
    throw new OError('Invalid Recurly billing info', { billingInfo })
  }
  return new CreditCardPaymentMethod({
    cardType: paymentMethod.cardType,
    lastFour: paymentMethod.lastFour,
  })
}

/**
 * Build a RecurlyAddOn from Recurly API data
 *
 * @param {recurly.AddOn} addOn
 * @return {RecurlyAddOn}
 */
function addOnFromApi(addOn) {
  if (addOn.code == null || addOn.name == null) {
    throw new OError('Invalid Recurly add-on', { addOn })
  }
  return new RecurlyAddOn({
    code: addOn.code,
    name: addOn.name,
  })
}

/**
 * Build an API request from a RecurlySubscriptionChangeRequest
 *
 * @param {RecurlySubscriptionChangeRequest} changeRequest
 * @return {recurly.SubscriptionChangeCreate}
 */
function subscriptionChangeRequestToApi(changeRequest) {
  /** @type {recurly.SubscriptionChangeCreate} */
  const requestBody = {
    timeframe: changeRequest.timeframe,
  }
  if (changeRequest.planCode != null) {
    requestBody.planCode = changeRequest.planCode
  }
  if (changeRequest.addOnUpdates != null) {
    requestBody.addOns = changeRequest.addOnUpdates.map(addOnUpdate => {
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
  return requestBody
}

module.exports = {
  errors: recurly.errors,

  getAccountForUserId: callbackify(getAccountForUserId),
  createAccountForUserId: callbackify(createAccountForUserId),
  getSubscription: callbackify(getSubscription),
  previewSubscriptionChange: callbackify(previewSubscriptionChange),
  applySubscriptionChangeRequest: callbackify(applySubscriptionChangeRequest),
  removeSubscriptionChange: callbackify(removeSubscriptionChange),
  removeSubscriptionChangeByUuid: callbackify(removeSubscriptionChangeByUuid),
  reactivateSubscriptionByUuid: callbackify(reactivateSubscriptionByUuid),
  cancelSubscriptionByUuid: callbackify(cancelSubscriptionByUuid),
  getPaymentMethod: callbackify(getPaymentMethod),
  getAddOn: callbackify(getAddOn),
  subscriptionIsCanceledOrExpired,

  promises: {
    getSubscription,
    getAccountForUserId,
    createAccountForUserId,
    previewSubscriptionChange,
    applySubscriptionChangeRequest,
    removeSubscriptionChange,
    removeSubscriptionChangeByUuid,
    reactivateSubscriptionByUuid,
    cancelSubscriptionByUuid,
    getPaymentMethod,
    getAddOn,
  },
}
