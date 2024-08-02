const AnalyticsManager = require('../Analytics/AnalyticsManager')
const SubscriptionEmailHandler = require('./SubscriptionEmailHandler')
const { ObjectId } = require('mongodb-legacy')

const INVOICE_SUBSCRIPTION_LIMIT = 10

async function sendRecurlyAnalyticsEvent(event, eventData) {
  const userId = _getUserId(eventData)
  if (!ObjectId.isValid(userId)) {
    return
  }

  switch (event) {
    case 'new_subscription_notification':
      await _sendSubscriptionStartedEvent(userId, eventData)
      break
    case 'updated_subscription_notification':
      await _sendSubscriptionUpdatedEvent(userId, eventData)
      break
    case 'canceled_subscription_notification':
      await _sendSubscriptionCancelledEvent(userId, eventData)
      break
    case 'expired_subscription_notification':
      await _sendSubscriptionExpiredEvent(userId, eventData)
      break
    case 'renewed_subscription_notification':
      await _sendSubscriptionRenewedEvent(userId, eventData)
      break
    case 'reactivated_account_notification':
      await _sendSubscriptionReactivatedEvent(userId, eventData)
      break
    case 'paid_charge_invoice_notification':
      if (
        eventData.invoice.state === 'paid' &&
        eventData.invoice.total_in_cents > 0
      ) {
        await _sendInvoicePaidEvent(userId, eventData)
      }
      break
    case 'closed_invoice_notification':
      if (
        eventData.invoice.state === 'collected' &&
        eventData.invoice.total_in_cents > 0
      ) {
        await _sendInvoicePaidEvent(userId, eventData)
      }
      break
  }
}

async function _sendSubscriptionStartedEvent(userId, eventData) {
  const { planCode, quantity, state, isTrial, subscriptionId } =
    _getSubscriptionData(eventData)
  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'subscription-started',
    {
      plan_code: planCode,
      quantity,
      is_trial: isTrial,
      subscriptionId,
    }
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-plan-code',
    planCode
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-state',
    state
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-is-trial',
    isTrial
  )

  if (isTrial) {
    await SubscriptionEmailHandler.sendTrialOnboardingEmail(userId, planCode)
  }
}

async function _sendSubscriptionUpdatedEvent(userId, eventData) {
  const { planCode, quantity, state, isTrial, subscriptionId } =
    _getSubscriptionData(eventData)
  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'subscription-updated',
    {
      plan_code: planCode,
      quantity,
      is_trial: isTrial,
      subscriptionId,
    }
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-plan-code',
    planCode
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-state',
    state
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-is-trial',
    isTrial
  )
}

async function _sendSubscriptionCancelledEvent(userId, eventData) {
  const { planCode, quantity, state, isTrial, subscriptionId } =
    _getSubscriptionData(eventData)
  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'subscription-cancelled',
    {
      plan_code: planCode,
      quantity,
      is_trial: isTrial,
      subscriptionId,
    }
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-state',
    state
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-is-trial',
    isTrial
  )
}

async function _sendSubscriptionExpiredEvent(userId, eventData) {
  const { planCode, quantity, state, isTrial, subscriptionId } =
    _getSubscriptionData(eventData)
  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'subscription-expired',
    {
      plan_code: planCode,
      quantity,
      is_trial: isTrial,
      subscriptionId,
    }
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-plan-code',
    planCode
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-state',
    state
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-is-trial',
    isTrial
  )
}

async function _sendSubscriptionRenewedEvent(userId, eventData) {
  const { planCode, quantity, state, isTrial, subscriptionId } =
    _getSubscriptionData(eventData)
  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'subscription-renewed',
    {
      plan_code: planCode,
      quantity,
      is_trial: isTrial,
      subscriptionId,
    }
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-plan-code',
    planCode
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-state',
    state
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-is-trial',
    isTrial
  )
}

async function _sendSubscriptionReactivatedEvent(userId, eventData) {
  const { planCode, quantity, state, isTrial, subscriptionId } =
    _getSubscriptionData(eventData)
  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'subscription-reactivated',
    {
      plan_code: planCode,
      quantity,
      subscriptionId,
    }
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-plan-code',
    planCode
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-state',
    state
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-is-trial',
    isTrial
  )
}

async function _sendInvoicePaidEvent(userId, eventData) {
  const invoice = eventData.invoice
  if (!invoice) {
    return
  }
  const invoiceNumber = invoice.invoice_number
  const currency = invoice.currency
  const totalInCents = invoice.total_in_cents
  const taxInCents = invoice.tax_in_cents
  const country = invoice.address?.country
  const collectionMethod = invoice.collection_method
  const subscriptionIds = {}
  invoice.subscription_ids?.forEach((e, idx) => {
    if (idx < INVOICE_SUBSCRIPTION_LIMIT) {
      subscriptionIds[`subscriptionId${idx + 1}`] = e
    }
  })
  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'subscription-invoice-collected',
    {
      invoiceNumber,
      currency,
      totalInCents,
      taxInCents,
      country,
      collectionMethod,
      ...subscriptionIds,
    }
  )
  AnalyticsManager.setUserPropertyForUserInBackground(
    userId,
    'subscription-is-trial',
    false
  )
}

function _getUserId(eventData) {
  let userId
  if (eventData && eventData.account && eventData.account.account_code) {
    userId = eventData.account.account_code
  } else {
    throw new Error(
      'account.account_code missing in event data to identity user ID'
    )
  }
  return userId
}

function _getSubscriptionData(eventData) {
  const isTrial =
    eventData.subscription.trial_started_at &&
    eventData.subscription.current_period_started_at &&
    eventData.subscription.trial_started_at.getTime() ===
      eventData.subscription.current_period_started_at.getTime()
  return {
    planCode: eventData.subscription.plan.plan_code,
    quantity: eventData.subscription.quantity,
    state: eventData.subscription.state,
    subscriptionId: eventData.subscription.uuid,
    isTrial,
  }
}

module.exports = {
  sendRecurlyAnalyticsEvent,
}
