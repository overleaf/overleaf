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

function _sendSubscriptionStartedEvent(eventData) {
  const userId = _getUserId(eventData)
  const { planCode, quantity, state, isTrial } = _getSubscriptionData(eventData)
  AnalyticsManager.recordEvent(userId, 'subscription-started', {
    plan_code: planCode,
    quantity,
    is_trial: isTrial,
  })
  AnalyticsManager.setUserProperty(userId, 'subscription-plan-code', planCode)
  AnalyticsManager.setUserProperty(userId, 'subscription-state', state)
  AnalyticsManager.setUserProperty(userId, 'subscription-is-trial', isTrial)
}

function _sendSubscriptionUpdatedEvent(eventData) {
  const userId = _getUserId(eventData)
  const { planCode, quantity, state, isTrial } = _getSubscriptionData(eventData)
  AnalyticsManager.recordEvent(userId, 'subscription-updated', {
    plan_code: planCode,
    quantity,
  })
  AnalyticsManager.setUserProperty(userId, 'subscription-plan-code', planCode)
  AnalyticsManager.setUserProperty(userId, 'subscription-state', state)
  AnalyticsManager.setUserProperty(userId, 'subscription-is-trial', isTrial)
}

function _sendSubscriptionCancelledEvent(eventData) {
  const userId = _getUserId(eventData)
  const { planCode, quantity, state, isTrial } = _getSubscriptionData(eventData)
  AnalyticsManager.recordEvent(userId, 'subscription-cancelled', {
    plan_code: planCode,
    quantity,
    is_trial: isTrial,
  })
  AnalyticsManager.setUserProperty(userId, 'subscription-state', state)
  AnalyticsManager.setUserProperty(userId, 'subscription-is-trial', isTrial)
}

function _sendSubscriptionExpiredEvent(eventData) {
  const userId = _getUserId(eventData)
  const { planCode, quantity, state, isTrial } = _getSubscriptionData(eventData)
  AnalyticsManager.recordEvent(userId, 'subscription-expired', {
    plan_code: planCode,
    quantity,
    is_trial: isTrial,
  })
  AnalyticsManager.setUserProperty(userId, 'subscription-plan-code', planCode)
  AnalyticsManager.setUserProperty(userId, 'subscription-state', state)
  AnalyticsManager.setUserProperty(userId, 'subscription-is-trial', isTrial)
}

function _sendSubscriptionRenewedEvent(eventData) {
  const userId = _getUserId(eventData)
  const { planCode, quantity, state, isTrial } = _getSubscriptionData(eventData)
  AnalyticsManager.recordEvent(userId, 'subscription-renewed', {
    plan_code: planCode,
    quantity,
    is_trial: isTrial,
  })
  AnalyticsManager.setUserProperty(userId, 'subscription-plan-code', planCode)
  AnalyticsManager.setUserProperty(userId, 'subscription-state', state)
  AnalyticsManager.setUserProperty(userId, 'subscription-is-trial', isTrial)
}

function _sendSubscriptionReactivatedEvent(eventData) {
  const userId = _getUserId(eventData)
  const { planCode, quantity, state, isTrial } = _getSubscriptionData(eventData)
  AnalyticsManager.recordEvent(userId, 'subscription-reactivated', {
    plan_code: planCode,
    quantity,
  })
  AnalyticsManager.setUserProperty(userId, 'subscription-plan-code', planCode)
  AnalyticsManager.setUserProperty(userId, 'subscription-state', state)
  AnalyticsManager.setUserProperty(userId, 'subscription-is-trial', isTrial)
}

function _sendInvoicePaidEvent(eventData) {
  const userId = _getUserId(eventData)
  AnalyticsManager.recordEvent(userId, 'subscription-invoice-collected')
  AnalyticsManager.setUserProperty(userId, 'subscription-is-trial', false)
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
