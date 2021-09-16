const AnalyticsManager = require('../Analytics/AnalyticsManager')

function sendRecurlyAnalyticsEvent(event, eventData) {
  switch (event) {
    case 'new_subscription_notification':
      _sendSubscriptionStartedEvent(eventData)
      break
    case 'updated_subscription_notification':
      _sendSubscriptionUpdatedEvent(eventData)
      break
    case 'canceled_subscription_notification':
      _sendSubscriptionCancelledEvent(eventData)
      break
    case 'expired_subscription_notification':
      _sendSubscriptionExpiredEvent(eventData)
      break
    case 'renewed_subscription_notification':
      _sendSubscriptionRenewedEvent(eventData)
      break
    case 'reactivated_account_notification':
      _sendSubscriptionReactivatedEvent(eventData)
      break
    case 'paid_charge_invoice_notification':
      if (
        eventData.invoice.state === 'paid' &&
        eventData.invoice.total_in_cents > 0
      ) {
        _sendInvoicePaidEvent(eventData)
      }
      break
    case 'closed_invoice_notification':
      if (
        eventData.invoice.state === 'collected' &&
        eventData.invoice.total_in_cents > 0
      ) {
        _sendInvoicePaidEvent(eventData)
      }
      break
  }
}

async function _sendSubscriptionStartedEvent(eventData) {
  const userId = _getUserId(eventData)
  const { planCode, quantity, state, isTrial } = _getSubscriptionData(eventData)
  AnalyticsManager.recordEventForUser(userId, 'subscription-started', {
    plan_code: planCode,
    quantity,
    is_trial: isTrial,
  })
  AnalyticsManager.setUserPropertyForUser(
    userId,
    'subscription-plan-code',
    planCode
  )
  AnalyticsManager.setUserPropertyForUser(userId, 'subscription-state', state)
  AnalyticsManager.setUserPropertyForUser(
    userId,
    'subscription-is-trial',
    isTrial
  )
}

async function _sendSubscriptionUpdatedEvent(eventData) {
  const userId = _getUserId(eventData)
  const { planCode, quantity, state, isTrial } = _getSubscriptionData(eventData)
  AnalyticsManager.recordEventForUser(userId, 'subscription-updated', {
    plan_code: planCode,
    quantity,
    is_trial: isTrial,
  })
  AnalyticsManager.setUserPropertyForUser(
    userId,
    'subscription-plan-code',
    planCode
  )
  AnalyticsManager.setUserPropertyForUser(userId, 'subscription-state', state)
  AnalyticsManager.setUserPropertyForUser(
    userId,
    'subscription-is-trial',
    isTrial
  )
}

async function _sendSubscriptionCancelledEvent(eventData) {
  const userId = _getUserId(eventData)
  const { planCode, quantity, state, isTrial } = _getSubscriptionData(eventData)
  AnalyticsManager.recordEventForUser(userId, 'subscription-cancelled', {
    plan_code: planCode,
    quantity,
    is_trial: isTrial,
  })
  AnalyticsManager.setUserPropertyForUser(userId, 'subscription-state', state)
  AnalyticsManager.setUserPropertyForUser(
    userId,
    'subscription-is-trial',
    isTrial
  )
}

async function _sendSubscriptionExpiredEvent(eventData) {
  const userId = _getUserId(eventData)
  const { planCode, quantity, state, isTrial } = _getSubscriptionData(eventData)
  AnalyticsManager.recordEventForUser(userId, 'subscription-expired', {
    plan_code: planCode,
    quantity,
    is_trial: isTrial,
  })
  AnalyticsManager.setUserPropertyForUser(
    userId,
    'subscription-plan-code',
    planCode
  )
  AnalyticsManager.setUserPropertyForUser(userId, 'subscription-state', state)
  AnalyticsManager.setUserPropertyForUser(
    userId,
    'subscription-is-trial',
    isTrial
  )
}

async function _sendSubscriptionRenewedEvent(eventData) {
  const userId = _getUserId(eventData)
  const { planCode, quantity, state, isTrial } = _getSubscriptionData(eventData)
  AnalyticsManager.recordEventForUser(userId, 'subscription-renewed', {
    plan_code: planCode,
    quantity,
    is_trial: isTrial,
  })
  AnalyticsManager.setUserPropertyForUser(
    userId,
    'subscription-plan-code',
    planCode
  )
  AnalyticsManager.setUserPropertyForUser(userId, 'subscription-state', state)
  AnalyticsManager.setUserPropertyForUser(
    userId,
    'subscription-is-trial',
    isTrial
  )
}

async function _sendSubscriptionReactivatedEvent(eventData) {
  const userId = _getUserId(eventData)
  const { planCode, quantity, state, isTrial } = _getSubscriptionData(eventData)
  AnalyticsManager.recordEventForUser(userId, 'subscription-reactivated', {
    plan_code: planCode,
    quantity,
  })
  AnalyticsManager.setUserPropertyForUser(
    userId,
    'subscription-plan-code',
    planCode
  )
  AnalyticsManager.setUserPropertyForUser(userId, 'subscription-state', state)
  AnalyticsManager.setUserPropertyForUser(
    userId,
    'subscription-is-trial',
    isTrial
  )
}

async function _sendInvoicePaidEvent(eventData) {
  const userId = _getUserId(eventData)
  AnalyticsManager.recordEventForUser(userId, 'subscription-invoice-collected')
  AnalyticsManager.setUserPropertyForUser(
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
    isTrial,
  }
}

module.exports = {
  sendRecurlyAnalyticsEvent,
}
