const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Subscription/RecurlyEventHandler'

describe('RecurlyEventHandler', function () {
  beforeEach(function () {
    this.userId = '123abc234bcd456cde567def'
    this.planCode = 'collaborator-annual'
    this.eventData = {
      account: {
        account_code: this.userId,
      },
      subscription: {
        uuid: '8435ad98c1ce45da99b07f6a6a2e780f',
        plan: {
          plan_code: 'collaborator-annual',
        },
        quantity: 1,
        state: 'active',
        trial_started_at: new Date('2021-01-01 12:34:56'),
        trial_ends_at: new Date('2021-01-08 12:34:56'),
        current_period_started_at: new Date('2021-01-01 12:34:56'),
        current_period_ends_at: new Date('2021-01-08 12:34:56'),
      },
    }

    this.RecurlyEventHandler = SandboxedModule.require(modulePath, {
      requires: {
        'mongodb-legacy': { ObjectId },
        './SubscriptionEmailHandler': (this.SubscriptionEmailHandler = {
          sendTrialOnboardingEmail: sinon.stub(),
        }),
        '../Analytics/AnalyticsManager': (this.AnalyticsManager = {
          recordEventForUserInBackground: sinon.stub(),
          setUserPropertyForUserInBackground: sinon.stub(),
        }),
        '../SplitTests/SplitTestHandler': (this.SplitTestHandler = {
          promises: {
            getAssignmentForUser: sinon.stub().resolves({
              variant: 'default',
            }),
          },
        }),
      },
    })
  })

  it('with new_subscription_notification - free trial', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUserInBackground,
      this.userId,
      'subscription-started',
      {
        plan_code: this.planCode,
        quantity: 1,
        is_trial: true,
        has_ai_add_on: false,
        subscriptionId: this.eventData.subscription.uuid,
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-plan-code',
      this.planCode
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-state',
      'active'
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-is-trial',
      true
    )
  })

  it('sends free trial onboarding email if user starting a trial', async function () {
    await this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      this.eventData
    )

    sinon.assert.called(this.SubscriptionEmailHandler.sendTrialOnboardingEmail)
  })

  it('with new_subscription_notification - no free trial', function () {
    this.eventData.subscription.current_period_started_at = new Date(
      '2021-02-10 12:34:56'
    )
    this.eventData.subscription.current_period_ends_at = new Date(
      '2021-02-17 12:34:56'
    )
    this.eventData.subscription.quantity = 3

    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUserInBackground,
      this.userId,
      'subscription-started',
      {
        plan_code: this.planCode,
        quantity: 3,
        is_trial: false,
        has_ai_add_on: false,
        subscriptionId: this.eventData.subscription.uuid,
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-state',
      'active'
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-is-trial',
      false
    )
  })

  it('with updated_subscription_notification', function () {
    this.planCode = 'new-plan-code'
    this.eventData.subscription.plan.plan_code = this.planCode
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'updated_subscription_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUserInBackground,
      this.userId,
      'subscription-updated',
      {
        plan_code: this.planCode,
        quantity: 1,
        is_trial: true,
        has_ai_add_on: false,
        subscriptionId: this.eventData.subscription.uuid,
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-plan-code',
      this.planCode
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-state',
      'active'
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-is-trial',
      true
    )
  })

  it('with canceled_subscription_notification', async function () {
    this.eventData.subscription.state = 'cancelled'
    await this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'canceled_subscription_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUserInBackground,
      this.userId,
      'subscription-cancelled',
      {
        plan_code: this.planCode,
        quantity: 1,
        is_trial: true,
        has_ai_add_on: false,
        subscriptionId: this.eventData.subscription.uuid,
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-state',
      'cancelled'
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-is-trial',
      true
    )
  })

  it('with expired_subscription_notification', function () {
    this.eventData.subscription.state = 'expired'
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'expired_subscription_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUserInBackground,
      this.userId,
      'subscription-expired',
      {
        plan_code: this.planCode,
        quantity: 1,
        is_trial: true,
        has_ai_add_on: false,
        subscriptionId: this.eventData.subscription.uuid,
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-plan-code',
      this.planCode
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-state',
      'expired'
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUserInBackground,
      this.userId,
      'subscription-is-trial',
      true
    )
  })

  it('with renewed_subscription_notification', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'renewed_subscription_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUserInBackground,
      this.userId,
      'subscription-renewed',
      {
        plan_code: this.planCode,
        quantity: 1,
        is_trial: true,
        has_ai_add_on: false,
        subscriptionId: this.eventData.subscription.uuid,
      }
    )
  })

  it('with reactivated_account_notification', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'reactivated_account_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUserInBackground,
      this.userId,
      'subscription-reactivated',
      {
        plan_code: this.planCode,
        quantity: 1,
        has_ai_add_on: false,
        subscriptionId: this.eventData.subscription.uuid,
      }
    )
  })

  it('with paid_charge_invoice_notification', function () {
    const invoice = {
      invoice_number: 1234,
      currency: 'USD',
      state: 'paid',
      total_in_cents: 720,
      tax_in_cents: 12,
      address: {
        country: 'Liurnia',
      },
      collection_method: 'automatic',
      subscription_ids: ['abcd1234', 'defa3214'],
    }
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'paid_charge_invoice_notification',
      {
        account: {
          account_code: this.userId,
        },
        invoice,
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUserInBackground,
      this.userId,
      'subscription-invoice-collected',
      {
        invoiceNumber: invoice.invoice_number,
        currency: invoice.currency,
        totalInCents: invoice.total_in_cents,
        taxInCents: invoice.tax_in_cents,
        country: invoice.address.country,
        collectionMethod: invoice.collection_method,
        subscriptionId1: invoice.subscription_ids[0],
        subscriptionId2: invoice.subscription_ids[1],
      }
    )
  })

  it('with paid_charge_invoice_notification and total_in_cents 0', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'paid_charge_invoice_notification',
      {
        account: {
          account_code: this.userId,
        },
        invoice: {
          state: 'paid',
          total_in_cents: 0,
        },
      }
    )
    sinon.assert.notCalled(this.AnalyticsManager.recordEventForUserInBackground)
  })

  it('with closed_invoice_notification', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'closed_invoice_notification',
      {
        account: {
          account_code: this.userId,
        },
        invoice: {
          state: 'collected',
          total_in_cents: 720,
        },
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUserInBackground,
      this.userId,
      'subscription-invoice-collected'
    )
  })

  it('with closed_invoice_notification and total_in_cents 0', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'closed_invoice_notification',
      {
        account: {
          account_code: this.userId,
        },
        invoice: {
          state: 'collected',
          total_in_cents: 0,
        },
      }
    )
    sinon.assert.notCalled(this.AnalyticsManager.recordEventForUserInBackground)
  })

  it('nothing is called with invalid account code', function () {
    this.eventData.account.account_code = 'foo_bar'

    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      this.eventData
    )
    sinon.assert.notCalled(this.AnalyticsManager.recordEventForUserInBackground)
    sinon.assert.notCalled(
      this.AnalyticsManager.setUserPropertyForUserInBackground
    )
    sinon.assert.notCalled(
      this.AnalyticsManager.setUserPropertyForUserInBackground
    )
    sinon.assert.notCalled(
      this.AnalyticsManager.setUserPropertyForUserInBackground
    )
  })
})
