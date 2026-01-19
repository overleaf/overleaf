import { vi } from 'vitest'
import mongodb from 'mongodb-legacy'
import sinon from 'sinon'

const { ObjectId } = mongodb

const modulePath =
  '../../../../app/src/Features/Subscription/RecurlyEventHandler.mjs'

describe('RecurlyEventHandler', function () {
  beforeEach(async function (ctx) {
    ctx.userId = '123abc234bcd456cde567def'
    ctx.planCode = 'collaborator-annual'
    ctx.eventData = {
      account: {
        account_code: ctx.userId,
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

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionEmailHandler',
      () => ({
        default: (ctx.SubscriptionEmailHandler = {
          sendTrialOnboardingEmail: sinon.stub(),
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: (ctx.AnalyticsManager = {
          recordEventForUserInBackground: sinon.stub(),
          setUserPropertyForUserInBackground: sinon.stub(),
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: (ctx.SplitTestHandler = {
          promises: {
            getAssignmentForUser: sinon.stub().resolves({
              variant: 'default',
            }),
            hasUserBeenAssignedToVariant: sinon.stub().resolves(false),
          },
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: (ctx.SubscriptionLocator = {
          promises: {
            getUsersSubscription: sinon.stub().resolves(null),
          },
        }),
      })
    )

    ctx.RecurlyEventHandler = (await import(modulePath)).default
  })

  it('should not send events for subscriptions managed by stripe', async function (ctx) {
    ctx.SubscriptionLocator.promises.getUsersSubscription.resolves({
      _id: 'sub123',
      paymentProvider: {
        service: 'stripe-uk',
      },
    })

    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      ctx.eventData
    )

    sinon.assert.notCalled(ctx.AnalyticsManager.recordEventForUserInBackground)
    sinon.assert.notCalled(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground
    )
    sinon.assert.notCalled(
      ctx.SubscriptionEmailHandler.sendTrialOnboardingEmail
    )
  })

  it('should send events for subscriptions without stripe payment provider', async function (ctx) {
    ctx.SubscriptionLocator.promises.getUsersSubscription.resolves({
      _id: 'sub123',
      paymentProvider: {
        service: 'recurly',
      },
    })

    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      ctx.eventData
    )

    sinon.assert.called(ctx.AnalyticsManager.recordEventForUserInBackground)
    sinon.assert.called(ctx.AnalyticsManager.setUserPropertyForUserInBackground)
  })

  it('with new_subscription_notification - free trial', async function (ctx) {
    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      ctx.eventData
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.recordEventForUserInBackground,
      ctx.userId,
      'subscription-started',
      {
        plan_code: ctx.planCode,
        quantity: 1,
        is_trial: true,
        has_ai_add_on: false,
        subscriptionId: ctx.eventData.subscription.uuid,
        payment_provider: 'recurly',
        'customerio-integration': false,
      }
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-plan-code',
      ctx.planCode
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-state',
      'active'
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-is-trial',
      true
    )
  })

  it('with new_subscription_notification - free trial with customerio integration enabled', async function (ctx) {
    ctx.SplitTestHandler.promises.hasUserBeenAssignedToVariant.resolves(true)

    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      ctx.eventData
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.recordEventForUserInBackground,
      ctx.userId,
      'subscription-started',
      {
        plan_code: ctx.planCode,
        quantity: 1,
        is_trial: true,
        has_ai_add_on: false,
        subscriptionId: ctx.eventData.subscription.uuid,
        payment_provider: 'recurly',
        'customerio-integration': true,
      }
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-plan-code',
      ctx.planCode
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-state',
      'active'
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-is-trial',
      true
    )
  })

  it('sends free trial onboarding email if user starting a trial', async function (ctx) {
    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      ctx.eventData
    )

    sinon.assert.called(ctx.SubscriptionEmailHandler.sendTrialOnboardingEmail)
  })

  it('with new_subscription_notification - no free trial', async function (ctx) {
    ctx.eventData.subscription.current_period_started_at = new Date(
      '2021-02-10 12:34:56'
    )
    ctx.eventData.subscription.current_period_ends_at = new Date(
      '2021-02-17 12:34:56'
    )
    ctx.eventData.subscription.quantity = 3

    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      ctx.eventData
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.recordEventForUserInBackground,
      ctx.userId,
      'subscription-started',
      {
        plan_code: ctx.planCode,
        quantity: 3,
        is_trial: false,
        has_ai_add_on: false,
        subscriptionId: ctx.eventData.subscription.uuid,
        payment_provider: 'recurly',
        'customerio-integration': false,
      }
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-state',
      'active'
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-is-trial',
      false
    )
  })

  it('with updated_subscription_notification', async function (ctx) {
    ctx.planCode = 'new-plan-code'
    ctx.eventData.subscription.plan.plan_code = ctx.planCode
    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'updated_subscription_notification',
      ctx.eventData
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.recordEventForUserInBackground,
      ctx.userId,
      'subscription-updated',
      {
        plan_code: ctx.planCode,
        quantity: 1,
        is_trial: true,
        has_ai_add_on: false,
        subscriptionId: ctx.eventData.subscription.uuid,
        payment_provider: 'recurly',
        'customerio-integration': false,
      }
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-plan-code',
      ctx.planCode
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-state',
      'active'
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-is-trial',
      true
    )
  })

  it('with updated_subscription_notification with customerio integration enabled', async function (ctx) {
    ctx.SplitTestHandler.promises.hasUserBeenAssignedToVariant.resolves(true)
    ctx.planCode = 'new-plan-code'
    ctx.eventData.subscription.plan.plan_code = ctx.planCode

    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'updated_subscription_notification',
      ctx.eventData
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.recordEventForUserInBackground,
      ctx.userId,
      'subscription-updated',
      {
        plan_code: ctx.planCode,
        quantity: 1,
        is_trial: true,
        has_ai_add_on: false,
        subscriptionId: ctx.eventData.subscription.uuid,
        payment_provider: 'recurly',
        'customerio-integration': true,
      }
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-plan-code',
      ctx.planCode
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-state',
      'active'
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-is-trial',
      true
    )
  })

  it('with canceled_subscription_notification', async function (ctx) {
    ctx.eventData.subscription.state = 'cancelled'
    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'canceled_subscription_notification',
      ctx.eventData
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.recordEventForUserInBackground,
      ctx.userId,
      'subscription-cancelled',
      {
        plan_code: ctx.planCode,
        quantity: 1,
        is_trial: true,
        has_ai_add_on: false,
        subscriptionId: ctx.eventData.subscription.uuid,
        payment_provider: 'recurly',
        'customerio-integration': false,
      }
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-state',
      'cancelled'
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-is-trial',
      true
    )
  })

  it('with expired_subscription_notification', async function (ctx) {
    ctx.eventData.subscription.state = 'expired'
    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'expired_subscription_notification',
      ctx.eventData
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.recordEventForUserInBackground,
      ctx.userId,
      'subscription-expired',
      {
        plan_code: ctx.planCode,
        quantity: 1,
        is_trial: true,
        has_ai_add_on: false,
        subscriptionId: ctx.eventData.subscription.uuid,
        payment_provider: 'recurly',
        'customerio-integration': false,
      }
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-plan-code',
      ctx.planCode
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-state',
      'expired'
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground,
      ctx.userId,
      'subscription-is-trial',
      true
    )
  })

  it('with renewed_subscription_notification', async function (ctx) {
    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'renewed_subscription_notification',
      ctx.eventData
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.recordEventForUserInBackground,
      ctx.userId,
      'subscription-renewed',
      {
        plan_code: ctx.planCode,
        quantity: 1,
        is_trial: true,
        has_ai_add_on: false,
        subscriptionId: ctx.eventData.subscription.uuid,
        payment_provider: 'recurly',
        'customerio-integration': false,
      }
    )
  })

  it('with reactivated_account_notification', async function (ctx) {
    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'reactivated_account_notification',
      ctx.eventData
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.recordEventForUserInBackground,
      ctx.userId,
      'subscription-reactivated',
      {
        plan_code: ctx.planCode,
        quantity: 1,
        has_ai_add_on: false,
        subscriptionId: ctx.eventData.subscription.uuid,
        payment_provider: 'recurly',
        'customerio-integration': false,
      }
    )
  })

  it('with paid_charge_invoice_notification', async function (ctx) {
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
    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'paid_charge_invoice_notification',
      {
        account: {
          account_code: ctx.userId,
        },
        invoice,
      }
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.recordEventForUserInBackground,
      ctx.userId,
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
        payment_provider: 'recurly',
      }
    )
  })

  it('with paid_charge_invoice_notification and total_in_cents 0', async function (ctx) {
    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'paid_charge_invoice_notification',
      {
        account: {
          account_code: ctx.userId,
        },
        invoice: {
          state: 'paid',
          total_in_cents: 0,
        },
      }
    )
    sinon.assert.notCalled(ctx.AnalyticsManager.recordEventForUserInBackground)
  })

  it('with closed_invoice_notification', async function (ctx) {
    await ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'closed_invoice_notification',
      {
        account: {
          account_code: ctx.userId,
        },
        invoice: {
          state: 'collected',
          total_in_cents: 720,
        },
      }
    )
    sinon.assert.calledWith(
      ctx.AnalyticsManager.recordEventForUserInBackground,
      ctx.userId,
      'subscription-invoice-collected'
    )
  })

  it('with closed_invoice_notification and total_in_cents 0', function (ctx) {
    ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'closed_invoice_notification',
      {
        account: {
          account_code: ctx.userId,
        },
        invoice: {
          state: 'collected',
          total_in_cents: 0,
        },
      }
    )
    sinon.assert.notCalled(ctx.AnalyticsManager.recordEventForUserInBackground)
  })

  it('nothing is called with invalid account code', function (ctx) {
    ctx.eventData.account.account_code = 'foo_bar'

    ctx.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      ctx.eventData
    )
    sinon.assert.notCalled(ctx.AnalyticsManager.recordEventForUserInBackground)
    sinon.assert.notCalled(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground
    )
    sinon.assert.notCalled(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground
    )
    sinon.assert.notCalled(
      ctx.AnalyticsManager.setUserPropertyForUserInBackground
    )
  })
})
