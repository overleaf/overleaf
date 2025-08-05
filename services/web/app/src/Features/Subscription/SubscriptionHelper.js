const { formatCurrency } = require('../../util/currency')
const GroupPlansData = require('./GroupPlansData')
const { isStandaloneAiAddOnPlanCode } = require('./AiHelper')
const { Subscription } = require('../../models/Subscription')

const MILLISECONDS = 1_000
/**
 * Recompute the subscription state for Stripe subscriptions based on pause periods.
 * This function checks if a subscription should transition between 'active' and 'paused'
 * states based on the current time and pause period metadata.
 *
 * @param {Object} subscription - The MongoDB subscription document
 * @returns {Promise<Object>} - The updated subscription document with recomputed state
 */
async function recomputeSubscriptionState(subscription) {
  if (
    !subscription?.paymentProvider?.subscriptionId ||
    !subscription.paymentProvider.pausePeriodStart ||
    !subscription.paymentProvider.pausePeriodEnd ||
    !subscription?.paymentProvider.service.includes('stripe')
  ) {
    return subscription
  }
  const now = Date.now() / MILLISECONDS
  const pauseStartTime =
    new Date(subscription.paymentProvider.pausePeriodStart).getTime() /
    MILLISECONDS
  const currentState = subscription.paymentProvider.state

  const pauseEndTime =
    new Date(subscription.paymentProvider.pausePeriodEnd).getTime() /
    MILLISECONDS

  const shouldBePaused =
    pauseEndTime && now >= pauseStartTime && now < pauseEndTime

  let newState

  if (shouldBePaused && currentState !== 'paused') {
    newState = 'paused'
  } else if (
    !shouldBePaused &&
    currentState === 'paused' &&
    pauseEndTime &&
    now >= pauseEndTime
  ) {
    newState = 'active'
  }

  if (newState) {
    await Subscription.updateOne(
      { _id: subscription._id },
      { 'paymentProvider.state': newState }
    ).exec()

    subscription.paymentProvider.state = newState
  }

  return subscription
}

/**
 * If the user changes to a less expensive plan, we shouldn't apply the change immediately.
 * This is to avoid unintended/artifical credits on users Recurly accounts.
 */
function shouldPlanChangeAtTermEnd(oldPlan, newPlan, isInTrial) {
  if (isInTrial) {
    // we should always upgrade or downgrade immediately if actively in trial
    return false
  }

  if (
    oldPlan.annual === newPlan.annual &&
    isStandaloneAiAddOnPlanCode(oldPlan.planCode) &&
    !isStandaloneAiAddOnPlanCode(newPlan.planCode)
  ) {
    // changing from an standalone AI add-on plan to a non-AI plan should not be considered a downgrade
    return false
  }
  return oldPlan.price_in_cents > newPlan.price_in_cents
}

/**
 * @import { CurrencyCode } from '../../../../types/subscription/currency'
 */

/**
 * @typedef {Object} PlanToPrice
 * @property {string} collaborator
 * @property {string} professional
 */

/**
 * @typedef {Object} LocalizedGroupPrice
 * @property {PlanToPrice} price
 * @property {PlanToPrice} pricePerUser
 */

/**
 * @param {CurrencyCode} recommendedCurrency
 * @param {string} locale
 * @returns {LocalizedGroupPrice}
 */
function generateInitialLocalizedGroupPrice(recommendedCurrency, locale) {
  const INITIAL_LICENSE_SIZE = 2

  // the price is in cents, so divide by 100 to get the value
  const collaboratorPrice =
    GroupPlansData.enterprise.collaborator[recommendedCurrency][
      INITIAL_LICENSE_SIZE
    ].price_in_cents / 100
  const collaboratorPricePerUser = collaboratorPrice / INITIAL_LICENSE_SIZE
  const professionalPrice =
    GroupPlansData.enterprise.professional[recommendedCurrency][
      INITIAL_LICENSE_SIZE
    ].price_in_cents / 100
  const professionalPricePerUser = professionalPrice / INITIAL_LICENSE_SIZE

  /**
   * @param {number} price
   * @returns {string}
   */
  const formatPrice = price =>
    formatCurrency(price, recommendedCurrency, locale, true)

  return {
    price: {
      collaborator: formatPrice(collaboratorPrice),
      professional: formatPrice(professionalPrice),
    },
    pricePerUser: {
      collaborator: formatPrice(collaboratorPricePerUser),
      professional: formatPrice(professionalPricePerUser),
    },
  }
}

function isPaidSubscription(subscription) {
  const hasRecurlySubscription =
    subscription?.recurlySubscription_id &&
    subscription?.recurlySubscription_id !== ''
  const hasStripeSubscription =
    subscription?.paymentProvider?.subscriptionId &&
    subscription?.paymentProvider?.subscriptionId !== ''
  return !!(subscription && (hasRecurlySubscription || hasStripeSubscription))
}

function isIndividualActivePaidSubscription(subscription) {
  return (
    isPaidSubscription(subscription) &&
    subscription?.groupPlan === false &&
    subscription?.recurlyStatus?.state !== 'canceled' &&
    subscription?.paymentProvider?.state !== 'canceled'
  )
}

function getPaymentProviderSubscriptionId(subscription) {
  if (subscription?.recurlySubscription_id) {
    return subscription.recurlySubscription_id
  }
  if (subscription?.paymentProvider?.subscriptionId) {
    return subscription.paymentProvider.subscriptionId
  }
  return null
}

function getPaidSubscriptionState(subscription) {
  if (subscription?.recurlyStatus?.state) {
    return subscription.recurlyStatus.state
  }
  if (subscription?.paymentProvider?.state) {
    return subscription.paymentProvider.state
  }
  return null
}

function getSubscriptionTrialStartedAt(subscription) {
  if (subscription?.recurlyStatus?.trialStartedAt) {
    return subscription.recurlyStatus?.trialStartedAt
  }
  return subscription?.paymentProvider?.trialStartedAt
}

function getSubscriptionTrialEndsAt(subscription) {
  if (subscription?.recurlyStatus?.trialEndsAt) {
    return subscription.recurlyStatus?.trialEndsAt
  }
  return subscription?.paymentProvider?.trialEndsAt
}

function isInTrial(trialEndsAt) {
  if (!trialEndsAt) {
    return false
  }

  return trialEndsAt.getTime() > Date.now()
}

module.exports = {
  shouldPlanChangeAtTermEnd,
  generateInitialLocalizedGroupPrice,
  isPaidSubscription,
  isIndividualActivePaidSubscription,
  getPaymentProviderSubscriptionId,
  getPaidSubscriptionState,
  getSubscriptionTrialStartedAt,
  getSubscriptionTrialEndsAt,
  isInTrial,
  recomputeSubscriptionState,
}
