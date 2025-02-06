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
  RecurlyPlan,
  RecurlyImmediateCharge,
} = require('./RecurlyEntities')
const { MissingBillingInfoError } = require('./Errors')

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
 * Get the subscription for a given user
 *
 * Returns null if the user doesn't have an account or a subscription. Throws an
 * error if the user has more than one subscription.
 *
 * @param {string} userId
 * @return {Promise<RecurlySubscription | null>}
 */
async function getSubscriptionForUser(userId) {
  try {
    const subscriptions = client.listAccountSubscriptions(`code-${userId}`, {
      params: { state: 'active', limit: 2 },
    })

    let result = null

    // The async iterator returns a NotFoundError if the account doesn't exist.
    for await (const subscription of subscriptions.each()) {
      if (result != null) {
        throw new OError('User has more than one Recurly subscription', {
          userId,
        })
      }
      result = subscription
    }
    if (result == null) {
      return null
    }
    return subscriptionFromApi(result)
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      return null
    } else {
      throw err
    }
  }
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

async function pauseSubscriptionByUuid(subscriptionUuid, pauseCycles) {
  return await client.pauseSubscription('uuid-' + subscriptionUuid, {
    remainingPauseCycles: pauseCycles,
  })
}

async function resumeSubscriptionByUuid(subscriptionUuid) {
  return await client.resumeSubscription('uuid-' + subscriptionUuid)
}

/**
 * Get the payment method for the given user
 *
 * @param {string} userId
 * @return {Promise<PaymentMethod>}
 */
async function getPaymentMethod(userId) {
  let billingInfo

  try {
    billingInfo = await client.getBillingInfo(`code-${userId}`)
  } catch (error) {
    if (error instanceof recurly.errors.NotFoundError) {
      throw new MissingBillingInfoError('This account has no billing info', {
        userId,
      })
    }
    throw error
  }

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

/**
 * Get the configuration for a given plan
 *
 * @param {string} planCode
 * @return {Promise<RecurlyPlan>}
 */
async function getPlan(planCode) {
  const plan = await client.getPlan(`code-${planCode}`)
  return planFromApi(plan)
}

function subscriptionIsCanceledOrExpired(subscription) {
  const state = subscription?.recurlyStatus?.state
  return state === 'canceled' || state === 'expired'
}

/**
 * Build a RecurlySubscription from Recurly API data
 *
 * @param {recurly.Subscription} apiSubscription
 * @return {RecurlySubscription}
 */
function subscriptionFromApi(apiSubscription) {
  if (
    apiSubscription.uuid == null ||
    apiSubscription.plan == null ||
    apiSubscription.plan.code == null ||
    apiSubscription.plan.name == null ||
    apiSubscription.account == null ||
    apiSubscription.account.code == null ||
    apiSubscription.unitAmount == null ||
    apiSubscription.subtotal == null ||
    apiSubscription.total == null ||
    apiSubscription.currency == null ||
    apiSubscription.currentPeriodStartedAt == null ||
    apiSubscription.currentPeriodEndsAt == null ||
    apiSubscription.collectionMethod == null
  ) {
    throw new OError('Invalid Recurly subscription', {
      subscription: apiSubscription,
    })
  }

  const subscription = new RecurlySubscription({
    id: apiSubscription.uuid,
    userId: apiSubscription.account.code,
    planCode: apiSubscription.plan.code,
    planName: apiSubscription.plan.name,
    planPrice: apiSubscription.unitAmount,
    addOns: (apiSubscription.addOns ?? []).map(subscriptionAddOnFromApi),
    subtotal: apiSubscription.subtotal,
    taxRate: apiSubscription.taxInfo?.rate ?? 0,
    taxAmount: apiSubscription.tax ?? 0,
    total: apiSubscription.total,
    currency: apiSubscription.currency,
    periodStart: apiSubscription.currentPeriodStartedAt,
    periodEnd: apiSubscription.currentPeriodEndsAt,
    collectionMethod: apiSubscription.collectionMethod,
  })

  if (apiSubscription.pendingChange != null) {
    subscription.pendingChange = subscriptionChangeFromApi(
      subscription,
      apiSubscription.pendingChange
    )
  }

  return subscription
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
    immediateCharge: computeImmediateCharge(subscriptionChange),
  })
}

/**
 * Compute immediate charge based on invoice collection
 *
 * @param {recurly.SubscriptionChange} subscriptionChange - the subscription change returned from the API
 * @return {RecurlyImmediateCharge}
 */
function computeImmediateCharge(subscriptionChange) {
  const roundToTwoDecimal = (/** @type {number} */ num) =>
    Math.round(num * 100) / 100
  let subtotal =
    subscriptionChange.invoiceCollection?.chargeInvoice?.subtotal ?? 0
  let tax = subscriptionChange.invoiceCollection?.chargeInvoice?.tax ?? 0
  let total = subscriptionChange.invoiceCollection?.chargeInvoice?.total ?? 0
  let discount =
    subscriptionChange.invoiceCollection?.chargeInvoice?.discount ?? 0
  for (const creditInvoice of subscriptionChange.invoiceCollection
    ?.creditInvoices ?? []) {
    // The credit invoice numbers are already negative
    subtotal = roundToTwoDecimal(subtotal + (creditInvoice.subtotal ?? 0))
    total = roundToTwoDecimal(total + (creditInvoice.total ?? 0))
    // Tax rate can be different in credit invoice if a user relocates
    tax = roundToTwoDecimal(tax + (creditInvoice.tax ?? 0))
    discount = roundToTwoDecimal(discount + (creditInvoice.discount ?? 0))
  }
  return new RecurlyImmediateCharge({
    subtotal,
    total,
    tax,
    discount,
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
 * Build a RecurlyPlan from Recurly API data
 *
 * @param {recurly.Plan} plan
 * @return {RecurlyPlan}
 */
function planFromApi(plan) {
  if (plan.code == null || plan.name == null) {
    throw new OError('Invalid Recurly add-on', { plan })
  }
  return new RecurlyPlan({
    code: plan.code,
    name: plan.name,
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
  getSubscriptionForUser: callbackify(getSubscriptionForUser),
  previewSubscriptionChange: callbackify(previewSubscriptionChange),
  applySubscriptionChangeRequest: callbackify(applySubscriptionChangeRequest),
  removeSubscriptionChange: callbackify(removeSubscriptionChange),
  removeSubscriptionChangeByUuid: callbackify(removeSubscriptionChangeByUuid),
  reactivateSubscriptionByUuid: callbackify(reactivateSubscriptionByUuid),
  cancelSubscriptionByUuid: callbackify(cancelSubscriptionByUuid),
  getPaymentMethod: callbackify(getPaymentMethod),
  getAddOn: callbackify(getAddOn),
  getPlan: callbackify(getPlan),
  subscriptionIsCanceledOrExpired,
  pauseSubscriptionByUuid: callbackify(pauseSubscriptionByUuid),
  resumeSubscriptionByUuid: callbackify(resumeSubscriptionByUuid),

  promises: {
    getSubscription,
    getSubscriptionForUser,
    getAccountForUserId,
    createAccountForUserId,
    previewSubscriptionChange,
    applySubscriptionChangeRequest,
    removeSubscriptionChange,
    removeSubscriptionChangeByUuid,
    reactivateSubscriptionByUuid,
    cancelSubscriptionByUuid,
    pauseSubscriptionByUuid,
    resumeSubscriptionByUuid,
    getPaymentMethod,
    getAddOn,
    getPlan,
  },
}
