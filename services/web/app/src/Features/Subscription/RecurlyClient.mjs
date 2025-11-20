// @ts-check

import recurly from 'recurly'

import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import { callbackify } from 'node:util'
import UserGetter from '../User/UserGetter.mjs'
import {
  PaymentProviderSubscription,
  PaymentProviderSubscriptionAddOn,
  PaymentProviderSubscriptionChange,
  PaypalPaymentMethod,
  CreditCardPaymentMethod,
  PaymentProviderAddOn,
  PaymentProviderPlan,
  PaymentProviderCoupon,
  PaymentProviderAccount,
  PaymentProviderImmediateCharge,
} from './PaymentProviderEntities.mjs'
import {
  MissingBillingInfoError,
  SubtotalLimitExceededError,
} from './Errors.mjs'
import RecurlyMetrics from './RecurlyMetrics.mjs'
import { isStandaloneAiAddOnPlanCode, AI_ADD_ON_CODE } from './AiHelper.mjs'

/**
 * @import { PaymentProviderSubscriptionChangeRequest } from './PaymentProviderEntities.mjs'
 * @import { PaymentProviderSubscriptionUpdateRequest } from './PaymentProviderEntities.mjs'
 * @import { PaymentMethod } from './types'
 * @import { CurrencyCode } from '../../../../types/subscription/currency'
 */

class RecurlyClientWithErrorHandling extends recurly.Client {
  /**
   * @param {import('recurly/lib/recurly/Http').Response} response
   * @return {Error | null}
   * @private
   */
  _errorFromResponse(response) {
    RecurlyMetrics.recordMetrics(
      response.status,
      response.rateLimit,
      response.rateLimitRemaining,
      response.rateLimitReset.getTime()
    )
    // @ts-ignore
    return super._errorFromResponse(response)
  }
}

const recurlySettings = Settings.apis.recurly
const recurlyApiKey = recurlySettings ? recurlySettings.apiKey : undefined

const client = new RecurlyClientWithErrorHandling(recurlyApiKey)

/**
 * Get account for a given user
 *
 * @param {string} userId
 * @return {Promise<PaymentProviderAccount | null>}
 */
async function getAccountForUserId(userId) {
  try {
    const account = await client.getAccount(`code-${userId}`)
    return accountFromApi(account)
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      // An expected error, we don't need to handle it, just return nothing
      logger.debug({ userId }, 'no recurly account found for user')
      return null
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
  return accountFromApi(account)
}

/**
 * Get active coupons for a given user
 *
 * @param {string} userId
 * @return {Promise<PaymentProviderCoupon[]>}
 */
async function getActiveCouponsForUserId(userId) {
  try {
    const redemptions = await client.listActiveCouponRedemptions(
      `code-${userId}`
    )

    const coupons = []
    for await (const redemption of redemptions.each()) {
      coupons.push(couponFromApi(redemption))
    }

    return coupons
  } catch (err) {
    // An expected error if no coupons have been redeemed
    if (err instanceof recurly.errors.NotFoundError) {
      return []
    } else {
      throw err
    }
  }
}

/**
 * Get hosted customer management link
 *
 * @param {string} userId
 * @param {string} pageType
 * @return {Promise<string|null>}
 */
async function getCustomerManagementLink(userId, pageType) {
  try {
    const account = await client.getAccount(`code-${userId}`)
    const recurlySubdomain = Settings.apis.recurly.subdomain
    const hostedLoginToken = account.hostedLoginToken
    if (!hostedLoginToken) {
      throw new OError('recurly account does not have hosted login token')
    }
    let path = ''
    if (pageType === 'billing-details') {
      path = 'billing_info/edit?ht='
    }
    return [
      'https://',
      recurlySubdomain,
      '.recurly.com/account/',
      path,
      hostedLoginToken,
    ].join('')
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      // An expected error, we don't need to handle it, just return nothing
      logger.debug({ userId }, 'no recurly account found for user')
      return null
    } else {
      throw err
    }
  }
}

/**
 * Get a subscription from Recurly
 *
 * @param {string} subscriptionId
 * @return {Promise<PaymentProviderSubscription>}
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
 * @return {Promise<PaymentProviderSubscription | null>}
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
 * Request a subscription update from Recurly
 *
 * @param {PaymentProviderSubscriptionUpdateRequest} updateRequest
 */
async function updateSubscriptionDetails(updateRequest) {
  const body = subscriptionUpdateRequestToApi(updateRequest)

  const updatedSubscription = await client.updateSubscription(
    `uuid-${updateRequest.subscription.id}`,
    body
  )

  logger.debug(
    {
      subscriptionId: updateRequest.subscription.id,
      updateId: updatedSubscription.id,
    },
    'updated subscription'
  )
}

/**
 * Request a subscription change from Recurly
 *
 * @param {PaymentProviderSubscriptionChangeRequest} changeRequest
 */
async function applySubscriptionChangeRequest(changeRequest) {
  const body = subscriptionChangeRequestToApi(changeRequest)

  try {
    const change = await client.createSubscriptionChange(
      `uuid-${changeRequest.subscription.id}`,
      body
    )
    logger.debug(
      { subscriptionId: changeRequest.subscription.id, changeId: change.id },
      'created subscription change'
    )
  } catch (err) {
    if (err instanceof recurly.errors.ValidationError) {
      /**
       * @type {{params?: { param?: string }[] | null}}
       */
      const validationError = err
      if (
        validationError.params?.some(
          p => p.param === 'subtotal_amount_in_cents'
        )
      ) {
        throw new SubtotalLimitExceededError(
          'Subtotal amount in cents exceeded error',
          {
            subscriptionId: changeRequest.subscription.id,
          }
        )
      }
    }
    throw err
  }
}

/**
 * Preview a subscription change
 *
 * @param {PaymentProviderSubscriptionChangeRequest} changeRequest
 * @return {Promise<PaymentProviderSubscriptionChange>}
 */
async function previewSubscriptionChange(changeRequest) {
  const body = subscriptionChangeRequestToApi(changeRequest)

  try {
    const subscriptionChange = await client.previewSubscriptionChange(
      `uuid-${changeRequest.subscription.id}`,
      body
    )

    return subscriptionChangeFromApi(
      changeRequest.subscription,
      subscriptionChange
    )
  } catch (err) {
    if (err instanceof recurly.errors.ValidationError) {
      /**
       * @type {{params?: { param?: string }[] | null}}
       */
      const validationError = err
      if (
        validationError.params?.some(
          p => p.param === 'subtotal_amount_in_cents'
        )
      ) {
        throw new SubtotalLimitExceededError(
          'Subtotal amount in cents exceeded error',
          {
            subscriptionId: changeRequest.subscription.id,
          }
        )
      }
    }
    throw err
  }
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
    if (!(err instanceof recurly.errors.ValidationError)) {
      throw err
    }

    const errorMessage = err.message || ''

    if (
      errorMessage === 'Only active and future subscriptions can be canceled.'
    ) {
      logger.debug(
        { subscriptionUuid },
        'subscription cancellation failed, subscription not active'
      )
    } else if (
      errorMessage.includes(
        'Cannot cancel a paused subscription in the last cycle of the term'
      )
    ) {
      logger.debug(
        { subscriptionUuid },
        'Terminating subscription in last cycle of paused term'
      )
      return await terminateSubscriptionByUuid(subscriptionUuid)
    }

    throw err
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
 * @return {Promise<PaymentProviderAddOn>}
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
 * @return {Promise<PaymentProviderPlan>}
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
 * Build a PaymentProviderAccount from Recurly API data
 *
 * @param {recurly.Account} apiAccount
 * @return {PaymentProviderAccount}
 */
function accountFromApi(apiAccount) {
  if (apiAccount.code == null || apiAccount.email == null) {
    throw new OError('Invalid Recurly account', {
      account: apiAccount,
    })
  }
  return new PaymentProviderAccount({
    code: apiAccount.code,
    email: apiAccount.email,
    hasPastDueInvoice: apiAccount.hasPastDueInvoice ?? false,
  })
}

/**
 * Build a PaymentProviderCoupon from Recurly API data
 *
 * @param {recurly.CouponRedemption} apiRedemption
 * @return {PaymentProviderCoupon}
 */
function couponFromApi(apiRedemption) {
  if (apiRedemption.coupon == null || apiRedemption.coupon.code == null) {
    throw new OError('Invalid Recurly coupon', {
      coupon: apiRedemption,
    })
  }
  return new PaymentProviderCoupon({
    code: apiRedemption.coupon.code,
    name: apiRedemption.coupon.name ?? '',
    description: apiRedemption.coupon.hostedPageDescription ?? '',
  })
}

/**
 * Build a PaymentProviderSubscription from Recurly API data
 *
 * @param {recurly.Subscription} apiSubscription
 * @return {PaymentProviderSubscription}
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
    apiSubscription.collectionMethod == null ||
    apiSubscription.netTerms == null ||
    // The values below could be null initially if the subscription has never updated
    !('poNumber' in apiSubscription) ||
    !('termsAndConditions' in apiSubscription)
  ) {
    throw new OError('Invalid Recurly subscription', {
      subscription: apiSubscription,
    })
  }

  const subscription = new PaymentProviderSubscription({
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
    currency: /** @type {CurrencyCode} */ (apiSubscription.currency),
    periodStart: apiSubscription.currentPeriodStartedAt,
    periodEnd: apiSubscription.currentPeriodEndsAt,
    collectionMethod: apiSubscription.collectionMethod,
    netTerms: apiSubscription.netTerms ?? 0,
    poNumber: apiSubscription.poNumber ?? '',
    termsAndConditions: apiSubscription.termsAndConditions ?? '',
    service: 'recurly',
    state: apiSubscription.state ?? 'active',
    trialPeriodStart: apiSubscription.trialStartedAt,
    trialPeriodEnd: apiSubscription.trialEndsAt,
    pausePeriodStart: apiSubscription.pausedAt,
    remainingPauseCycles: apiSubscription.remainingPauseCycles,
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
 * Build a PaymentProviderSubscriptionAddOn from Recurly API data
 *
 * @param {recurly.SubscriptionAddOn} addOn
 * @return {PaymentProviderSubscriptionAddOn}
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

  return new PaymentProviderSubscriptionAddOn({
    code: addOn.addOn.code,
    name: addOn.addOn.name,
    quantity: addOn.quantity ?? 1,
    unitPrice: addOn.unitAmount,
  })
}

/**
 * Build a PaymentProviderSubscriptionChange from Recurly API data
 *
 * @param {PaymentProviderSubscription} subscription - the current subscription
 * @param {recurly.SubscriptionChange} subscriptionChange - the subscription change returned from the API
 * @return {PaymentProviderSubscriptionChange}
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

  return new PaymentProviderSubscriptionChange({
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
 * @return {PaymentProviderImmediateCharge}
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

  const lineItems = []

  for (const lineItem of subscriptionChange.invoiceCollection?.chargeInvoice
    ?.lineItems || []) {
    lineItems.push({
      planCode: lineItem.planCode,
      isAiAssist:
        lineItem.addOnCode === AI_ADD_ON_CODE ||
        isStandaloneAiAddOnPlanCode(lineItem.planCode),
      description: lineItem.description ?? '',
      subtotal: roundToTwoDecimal(lineItem.subtotal ?? 0),
      discount: roundToTwoDecimal(lineItem.discount ?? 0),
      tax: roundToTwoDecimal(lineItem.tax ?? 0),
    })
  }

  for (const creditInvoice of subscriptionChange.invoiceCollection
    ?.creditInvoices ?? []) {
    // The credit invoice numbers are already negative
    subtotal = roundToTwoDecimal(subtotal + (creditInvoice.subtotal ?? 0))
    total = roundToTwoDecimal(total + (creditInvoice.total ?? 0))
    // Tax rate can be different in credit invoice if a user relocates
    tax = roundToTwoDecimal(tax + (creditInvoice.tax ?? 0))
    discount = roundToTwoDecimal(discount + (creditInvoice.discount ?? 0))

    for (const lineItem of creditInvoice.lineItems || []) {
      lineItems.push({
        planCode: lineItem.planCode,
        isAiAssist:
          lineItem.addOnCode === AI_ADD_ON_CODE ||
          isStandaloneAiAddOnPlanCode(lineItem.planCode),
        description: lineItem.description ?? '',
        subtotal: roundToTwoDecimal(lineItem.subtotal ?? 0),
        discount: roundToTwoDecimal(lineItem.discount ?? 0),
        tax: roundToTwoDecimal(lineItem.tax ?? 0),
      })
    }
  }
  return new PaymentProviderImmediateCharge({
    subtotal,
    total,
    tax,
    discount,
    lineItems,
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
 * Build a PaymentProviderAddOn from Recurly API data
 *
 * @param {recurly.AddOn} addOn
 * @return {PaymentProviderAddOn}
 */
function addOnFromApi(addOn) {
  if (addOn.code == null || addOn.name == null) {
    throw new OError('Invalid Recurly add-on', { addOn })
  }
  return new PaymentProviderAddOn({
    code: addOn.code,
    name: addOn.name,
  })
}

/**
 * Build a PaymentProviderPlan from Recurly API data
 *
 * @param {recurly.Plan} plan
 * @return {PaymentProviderPlan}
 */
function planFromApi(plan) {
  if (plan.code == null || plan.name == null) {
    throw new OError('Invalid Recurly add-on', { plan })
  }
  return new PaymentProviderPlan({
    code: plan.code,
    name: plan.name,
  })
}

/**
 * Build an API request from a PaymentProviderSubscriptionChangeRequest
 *
 * @param {PaymentProviderSubscriptionChangeRequest} changeRequest
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

/**
 * Build an API request from a PaymentProviderSubscriptionUpdateRequest
 *
 * @param {PaymentProviderSubscriptionUpdateRequest} updateRequest
 */
function subscriptionUpdateRequestToApi(updateRequest) {
  const requestBody = {}
  if (updateRequest.poNumber) {
    requestBody.poNumber = updateRequest.poNumber
  }
  if (updateRequest.termsAndConditions) {
    requestBody.termsAndConditions = updateRequest.termsAndConditions
  }
  return requestBody
}

/**
 * Retrieves a list of failed invoices for a given Recurly subscription ID.
 *
 * @async
 * @function
 * @param {string} subscriptionId - The ID of the Recurly subscription to fetch failed invoices for.
 * @returns {Promise<Array<recurly.Invoice>>} A promise that resolves to an array of failed invoice objects.
 */
async function getPastDueInvoices(subscriptionId) {
  const failed = []
  const invoices = client.listSubscriptionInvoices(`uuid-${subscriptionId}`, {
    params: { state: 'past_due' },
  })

  for await (const invoice of invoices.each()) {
    failed.push(invoice)
  }
  return failed
}

/**
 * Marks an invoice as failed using the Recurly client.
 *
 * @async
 * @function failInvoice
 * @param {string} invoiceId - The ID of the invoice to be marked as failed.
 * @returns {Promise<void>} Resolves when the invoice has been successfully marked as failed.
 */
async function failInvoice(invoiceId) {
  await client.markInvoiceFailed(invoiceId)
}

async function terminateSubscriptionByUuid(subscriptionUuid) {
  const subscription = await client.terminateSubscription(
    'uuid-' + subscriptionUuid,
    {
      body: {
        refund: 'none',
      },
    }
  )

  logger.debug({ subscriptionUuid }, 'subscription terminated')

  return subscription
}

export default {
  errors: recurly.errors,

  getAccountForUserId: callbackify(getAccountForUserId),
  createAccountForUserId: callbackify(createAccountForUserId),
  getActiveCouponsForUserId: callbackify(getActiveCouponsForUserId),
  getSubscription: callbackify(getSubscription),
  getSubscriptionForUser: callbackify(getSubscriptionForUser),
  previewSubscriptionChange: callbackify(previewSubscriptionChange),
  updateSubscriptionDetails: callbackify(updateSubscriptionDetails),
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
  getPastDueInvoices: callbackify(getPastDueInvoices),
  failInvoice: callbackify(failInvoice),
  terminateSubscriptionByUuid: callbackify(terminateSubscriptionByUuid),

  promises: {
    getSubscription,
    getSubscriptionForUser,
    getAccountForUserId,
    createAccountForUserId,
    getActiveCouponsForUserId,
    getCustomerManagementLink,
    previewSubscriptionChange,
    updateSubscriptionDetails,
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
    getPastDueInvoices,
    failInvoice,
    terminateSubscriptionByUuid,
  },
}
