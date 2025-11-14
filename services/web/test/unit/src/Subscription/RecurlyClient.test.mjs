import { vi, expect } from 'vitest'
import sinon from 'sinon'
import recurly from 'recurly'
import PaymentProviderEntities from '../../../../app/src/Features/Subscription/PaymentProviderEntities.mjs'

const {
  PaymentProviderSubscription,
  PaymentProviderSubscriptionChangeRequest,
  PaymentProviderSubscriptionUpdateRequest,
  PaymentProviderSubscriptionAddOnUpdate,
  PaymentProviderAccount,
  PaymentProviderCoupon,
} = PaymentProviderEntities
const MODULE_PATH = '../../../../app/src/Features/Subscription/RecurlyClient'

describe('RecurlyClient', function () {
  beforeEach(async function (ctx) {
    ctx.settings = {
      apis: {
        recurly: {
          apiKey: 'nonsense',
          privateKey: 'private_nonsense',
          subdomain: 'test',
        },
      },
      plans: [],
      features: [],
    }

    ctx.user = { _id: '123456', email: 'joe@example.com', first_name: 'Joe' }
    ctx.subscriptionChange = { id: 'subscription-change-123' }
    ctx.recurlyAccount = new recurly.Account()
    Object.assign(ctx.recurlyAccount, {
      code: ctx.user._id,
      email: ctx.user.email,
    })

    ctx.subscriptionAddOn = {
      code: 'addon-code',
      name: 'My Add-On',
      quantity: 1,
      unitPrice: 2,
      preTaxTotal: 2,
    }

    ctx.subscription = new PaymentProviderSubscription({
      id: 'subscription-id',
      userId: 'user-id',
      currency: 'EUR',
      planCode: 'plan-code',
      planName: 'plan-name',
      planPrice: 13,
      addOns: [ctx.subscriptionAddOn],
      subtotal: 15,
      taxRate: 0.1,
      taxAmount: 1.5,
      total: 16.5,
      periodStart: new Date(),
      periodEnd: new Date(),
      collectionMethod: 'automatic',
      netTerms: 0,
      poNumber: '',
      termsAndConditions: '',
    })

    ctx.recurlySubscription = {
      uuid: ctx.subscription.id,
      account: {
        code: ctx.subscription.userId,
      },
      plan: {
        code: ctx.subscription.planCode,
        name: ctx.subscription.planName,
      },
      addOns: [
        {
          addOn: {
            code: ctx.subscriptionAddOn.code,
            name: ctx.subscriptionAddOn.name,
          },
          quantity: ctx.subscriptionAddOn.quantity,
          unitAmount: ctx.subscriptionAddOn.unitPrice,
        },
      ],
      unitAmount: ctx.subscription.planPrice,
      subtotal: ctx.subscription.subtotal,
      taxInfo: { rate: ctx.subscription.taxRate },
      tax: ctx.subscription.taxAmount,
      total: ctx.subscription.total,
      currency: ctx.subscription.currency,
      currentPeriodStartedAt: ctx.subscription.periodStart,
      currentPeriodEndsAt: ctx.subscription.periodEnd,
      collectionMethod: ctx.subscription.collectionMethod,
      netTerms: ctx.subscription.netTerms,
      poNumber: ctx.subscription.poNumber,
      termsAndConditions: ctx.subscription.termsAndConditions,
    }

    ctx.recurlySubscriptionChange = new recurly.SubscriptionChange()
    Object.assign(ctx.recurlySubscriptionChange, ctx.subscriptionChange)

    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().callsFake(userId => {
          if (userId === ctx.user._id) {
            return ctx.user
          }
        }),
      },
    }

    let client
    ctx.client = client = {
      getAccount: sinon.stub(),
      getBillingInfo: sinon.stub(),
      listAccountSubscriptions: sinon.stub(),
      listActiveCouponRedemptions: sinon.stub(),
      previewSubscriptionChange: sinon.stub(),
      listSubscriptionInvoices: sinon.stub(),
    }
    ctx.recurly = {
      errors: recurly.errors,
      Client: function () {
        return client
      },
    }
    ctx.Errors = {
      MissingBillingInfoError: class extends Error {},
      SubtotalLimitExceededError: class extends Error {},
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('recurly', () => ({
      default: ctx.recurly,
    }))

    vi.doMock('@overleaf/logger', () => ({
      default: {
        err: sinon.stub(),
        error: sinon.stub(),
        warn: sinon.stub(),
        log: sinon.stub(),
        debug: sinon.stub(),
      },
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/Errors',
      () => ctx.Errors
    )

    vi.doMock('../../../../app/src/models/Subscription', () => ({}))

    ctx.RecurlyClient = (await import(MODULE_PATH)).default
  })

  describe('initializing recurly client with undefined API key parameter', function () {
    it('should create a client without error', function () {
      let testClient
      expect(() => {
        testClient = new recurly.Client(undefined)
      }).to.not.throw()
      expect(testClient).to.be.instanceOf(recurly.Client)
    })
  })

  describe('getAccountForUserId', function () {
    it('should return an Account if one exists', async function (ctx) {
      ctx.client.getAccount = sinon.stub().resolves(ctx.recurlyAccount)
      const account = await ctx.RecurlyClient.promises.getAccountForUserId(
        ctx.user._id
      )
      const expectedAccount = new PaymentProviderAccount({
        code: ctx.user._id,
        email: ctx.user.email,
        hasPastDueInvoice: false,
      })
      expect(account).to.deep.equal(expectedAccount)
    })

    it('should return null if no account found', async function (ctx) {
      ctx.client.getAccount = sinon
        .stub()
        .throws(new recurly.errors.NotFoundError())
      const account =
        await ctx.RecurlyClient.promises.getAccountForUserId('nonsense')
      expect(account).to.equal(null)
    })

    it('should re-throw caught errors', async function (ctx) {
      ctx.client.getAccount = sinon.stub().throws()
      await expect(
        ctx.RecurlyClient.promises.getAccountForUserId(ctx.user._id)
      ).to.eventually.be.rejectedWith(Error)
    })
  })

  describe('createAccountForUserId', function () {
    it('should return the Account as created by recurly', async function (ctx) {
      ctx.client.createAccount = sinon.stub().resolves(ctx.recurlyAccount)
      const result = await ctx.RecurlyClient.promises.createAccountForUserId(
        ctx.user._id
      )
      expect(result).to.has.property('code', ctx.user._id)
    })

    it('should throw any API errors', async function (ctx) {
      ctx.client.createAccount = sinon.stub().throws()
      await expect(
        ctx.RecurlyClient.promises.createAccountForUserId(ctx.user._id)
      ).to.eventually.be.rejectedWith(Error)
    })
  })

  describe('getActiveCouponsForUserId', function () {
    it('should return an empty array if no coupons returned', async function (ctx) {
      ctx.client.listActiveCouponRedemptions.returns({
        each: async function* () {},
      })
      const coupons =
        await ctx.RecurlyClient.promises.getActiveCouponsForUserId('some-user')
      expect(coupons).to.deep.equal([])
    })

    it('should return a coupons returned by recurly', async function (ctx) {
      const recurlyCoupon = {
        coupon: {
          code: 'coupon-code',
          name: 'Coupon Name',
          hostedPageDescription: 'hosted page description',
          invoiceDescription: 'invoice description',
        },
      }
      ctx.client.listActiveCouponRedemptions.returns({
        each: async function* () {
          yield recurlyCoupon
        },
      })
      const coupons =
        await ctx.RecurlyClient.promises.getActiveCouponsForUserId('some-user')
      const expectedCoupons = [
        new PaymentProviderCoupon({
          code: 'coupon-code',
          name: 'Coupon Name',
          description: 'hosted page description',
        }),
      ]
      expect(coupons).to.deep.equal(expectedCoupons)
    })

    it('should not throw for Recurly not found error', async function (ctx) {
      ctx.client.listActiveCouponRedemptions = sinon
        .stub()
        .throws(new recurly.errors.NotFoundError())
      const coupons =
        await ctx.RecurlyClient.promises.getActiveCouponsForUserId('some-user')
      expect(coupons).to.deep.equal([])
    })

    it('should throw any other API errors', async function (ctx) {
      ctx.client.listActiveCouponRedemptions = sinon.stub().throws()
      await expect(
        ctx.RecurlyClient.promises.getActiveCouponsForUserId('some-user')
      ).to.eventually.be.rejectedWith(Error)
    })
  })

  describe('getCustomerManagementLink', function () {
    it('should throw if recurly token is not returned', async function (ctx) {
      ctx.client.getAccount.resolves({})
      await expect(
        ctx.RecurlyClient.promises.getCustomerManagementLink(
          '12345',
          'account-management',
          'en-US'
        )
      ).to.be.rejectedWith('recurly account does not have hosted login token')
    })

    it('should generate the correct account management url', async function (ctx) {
      ctx.client.getAccount.resolves({
        hostedLoginToken: '987654321',
      })
      const result = await ctx.RecurlyClient.promises.getCustomerManagementLink(
        '12345',
        'account-management',
        'en-US'
      )

      expect(result).to.equal('https://test.recurly.com/account/987654321')
    })

    it('should generate the correct billing details url', async function (ctx) {
      ctx.client.getAccount.resolves({
        hostedLoginToken: '987654321',
      })
      const result = await ctx.RecurlyClient.promises.getCustomerManagementLink(
        '12345',
        'billing-details',
        'en-US'
      )

      expect(result).to.equal(
        'https://test.recurly.com/account/billing_info/edit?ht=987654321'
      )
    })
  })

  describe('getSubscription', function () {
    it('should return the subscription found by recurly', async function (ctx) {
      ctx.client.getSubscription = sinon
        .stub()
        .withArgs('uuid-subscription-id')
        .resolves(ctx.recurlySubscription)
      const subscription = await ctx.RecurlyClient.promises.getSubscription(
        ctx.subscription.id
      )
      expect(subscription).to.deep.equal(ctx.subscription)
    })

    it('should throw any API errors', async function (ctx) {
      ctx.client.getSubscription = sinon.stub().throws()
      await expect(
        ctx.RecurlyClient.promises.getSubscription(ctx.user._id)
      ).to.eventually.be.rejectedWith(Error)
    })
  })

  describe('getSubscriptionForUser', function () {
    it("should return null if the account doesn't exist", async function (ctx) {
      ctx.client.listAccountSubscriptions.returns({
        // eslint-disable-next-line require-yield
        each: async function* () {
          throw new recurly.errors.NotFoundError('account not found')
        },
      })
      const subscription =
        await ctx.RecurlyClient.promises.getSubscriptionForUser('some-user')
      expect(subscription).to.be.null
    })

    it("should return null if the account doesn't have subscriptions", async function (ctx) {
      ctx.client.listAccountSubscriptions.returns({
        each: async function* () {},
      })
      const subscription =
        await ctx.RecurlyClient.promises.getSubscriptionForUser('some-user')
      expect(subscription).to.be.null
    })

    it('should return the subscription if the account has one subscription', async function (ctx) {
      const recurlySubscription = ctx.recurlySubscription
      ctx.client.listAccountSubscriptions.returns({
        each: async function* () {
          yield recurlySubscription
        },
      })
      const subscription =
        await ctx.RecurlyClient.promises.getSubscriptionForUser('some-user')
      expect(subscription).to.deep.equal(ctx.subscription)
    })

    it('should throw an error if the account has more than one subscription', async function (ctx) {
      const recurlySubscription = ctx.recurlySubscription
      ctx.client.listAccountSubscriptions.returns({
        each: async function* () {
          yield recurlySubscription
          yield { another: 'subscription' }
        },
      })
      await expect(
        ctx.RecurlyClient.promises.getSubscriptionForUser('some-user')
      ).to.be.rejected
    })
  })

  describe('applySubscriptionChangeRequest', function () {
    beforeEach(function (ctx) {
      ctx.client.createSubscriptionChange = sinon
        .stub()
        .resolves(ctx.recurlySubscriptionChange)
    })

    it('handles plan changes', async function (ctx) {
      await ctx.RecurlyClient.promises.applySubscriptionChangeRequest(
        new PaymentProviderSubscriptionChangeRequest({
          subscription: ctx.subscription,
          timeframe: 'now',
          planCode: 'new-plan',
        })
      )
      expect(ctx.client.createSubscriptionChange).to.be.calledWith(
        'uuid-subscription-id',
        { timeframe: 'now', planCode: 'new-plan' }
      )
    })

    it('handles add-on changes', async function (ctx) {
      await ctx.RecurlyClient.promises.applySubscriptionChangeRequest(
        new PaymentProviderSubscriptionChangeRequest({
          subscription: ctx.subscription,
          timeframe: 'now',
          addOnUpdates: [
            new PaymentProviderSubscriptionAddOnUpdate({
              code: 'new-add-on',
              quantity: 2,
              unitPrice: 8.99,
            }),
          ],
        })
      )
      expect(ctx.client.createSubscriptionChange).to.be.calledWith(
        'uuid-subscription-id',
        {
          timeframe: 'now',
          addOns: [{ code: 'new-add-on', quantity: 2, unitAmount: 8.99 }],
        }
      )
    })

    it('should throw any API errors', async function (ctx) {
      ctx.client.createSubscriptionChange = sinon.stub().throws()
      await expect(
        ctx.RecurlyClient.promises.applySubscriptionChangeRequest({
          subscription: ctx.subscription,
        })
      ).to.eventually.be.rejectedWith(Error)
    })

    it('should throw SubtotalLimitExceededError', async function (ctx) {
      class ValidationError extends recurly.errors.ValidationError {
        constructor() {
          super()
          this.params = [{ param: 'subtotal_amount_in_cents' }]
        }
      }
      ctx.client.createSubscriptionChange = sinon
        .stub()
        .throws(new ValidationError())
      await expect(
        ctx.RecurlyClient.promises.applySubscriptionChangeRequest({
          subscription: ctx.subscription,
        })
      ).to.be.rejectedWith(ctx.Errors.SubtotalLimitExceededError)
    })

    it('should rethrow errors different than SubtotalLimitExceededError', async function (ctx) {
      ctx.client.createSubscriptionChange = sinon.stub().throws(new Error())
      await expect(
        ctx.RecurlyClient.promises.applySubscriptionChangeRequest({
          subscription: ctx.subscription,
        })
      ).to.be.rejectedWith(Error)
    })
  })

  describe('updateSubscriptionDetails', function () {
    beforeEach(function (ctx) {
      ctx.client.updateSubscription = sinon
        .stub()
        .resolves({ id: ctx.subscription.id })
    })

    it('handles subscription update', async function (ctx) {
      await ctx.RecurlyClient.promises.updateSubscriptionDetails(
        new PaymentProviderSubscriptionUpdateRequest({
          subscription: ctx.subscription,
          poNumber: '012345',
          termsAndConditions: 'T&C',
        })
      )
      expect(ctx.client.updateSubscription).to.be.calledWith(
        'uuid-subscription-id',
        { poNumber: '012345', termsAndConditions: 'T&C' }
      )
    })

    it('should throw any API errors', async function (ctx) {
      ctx.client.updateSubscription = sinon.stub().throws()
      await expect(
        ctx.RecurlyClient.promises.updateSubscriptionDetails({
          subscription: ctx.subscription,
        })
      ).to.eventually.be.rejectedWith(Error)
    })
  })

  describe('removeSubscriptionChange', function () {
    beforeEach(function (ctx) {
      ctx.client.removeSubscriptionChange = sinon.stub().resolves()
    })

    it('should attempt to remove a pending subscription change', async function (ctx) {
      ctx.RecurlyClient.promises.removeSubscriptionChange(
        ctx.subscription.id,
        {}
      )
      expect(ctx.client.removeSubscriptionChange).to.be.calledWith(
        ctx.subscription.id
      )
    })

    it('should throw any API errors', async function (ctx) {
      ctx.client.removeSubscriptionChange = sinon.stub().throws()
      await expect(
        ctx.RecurlyClient.promises.removeSubscriptionChange(
          ctx.subscription.id,
          {}
        )
      ).to.eventually.be.rejectedWith(Error)
    })

    describe('removeSubscriptionChangeByUuid', function () {
      it('should attempt to remove a pending subscription change', async function (ctx) {
        ctx.RecurlyClient.promises.removeSubscriptionChangeByUuid(
          ctx.subscription.uuid,
          {}
        )
        expect(ctx.client.removeSubscriptionChange).to.be.calledWith(
          'uuid-' + ctx.subscription.uuid
        )
      })

      it('should throw any API errors', async function (ctx) {
        ctx.client.removeSubscriptionChange = sinon.stub().throws()
        await expect(
          ctx.RecurlyClient.promises.removeSubscriptionChangeByUuid(
            ctx.subscription.id,
            {}
          )
        ).to.eventually.be.rejectedWith(Error)
      })
    })
  })

  describe('reactivateSubscriptionByUuid', function () {
    it('should attempt to reactivate the subscription', async function (ctx) {
      ctx.client.reactivateSubscription = sinon
        .stub()
        .resolves(ctx.recurlySubscription)
      const subscription =
        await ctx.RecurlyClient.promises.reactivateSubscriptionByUuid(
          ctx.subscription.uuid
        )
      expect(subscription).to.deep.equal(ctx.recurlySubscription)
      expect(ctx.client.reactivateSubscription).to.be.calledWith(
        'uuid-' + ctx.subscription.uuid
      )
    })
  })

  describe('cancelSubscriptionByUuid', function () {
    it('should attempt to cancel the subscription', async function (ctx) {
      ctx.client.cancelSubscription = sinon
        .stub()
        .resolves(ctx.recurlySubscription)
      const subscription =
        await ctx.RecurlyClient.promises.cancelSubscriptionByUuid(
          ctx.subscription.uuid
        )
      expect(subscription).to.deep.equal(ctx.recurlySubscription)
      expect(ctx.client.cancelSubscription).to.be.calledWith(
        'uuid-' + ctx.subscription.uuid
      )
    })

    it('should terminate subscription when cancellation fails due to being in last cycle of paused term', async function (ctx) {
      const validationError = new recurly.errors.ValidationError()
      validationError.message =
        'Cannot cancel a paused subscription in the last cycle of the term'

      ctx.client.cancelSubscription = sinon.stub().throws(validationError)
      ctx.client.terminateSubscription = sinon
        .stub()
        .resolves(ctx.recurlySubscription)

      const subscription =
        await ctx.RecurlyClient.promises.cancelSubscriptionByUuid(
          ctx.subscription.uuid
        )

      expect(ctx.client.cancelSubscription).to.be.calledWith(
        'uuid-' + ctx.subscription.uuid
      )
      expect(ctx.client.terminateSubscription).to.be.calledWith(
        'uuid-' + ctx.subscription.uuid
      )
      expect(subscription).to.deep.equal(ctx.recurlySubscription)
    })
  })

  describe('pauseSubscriptionByUuid', function () {
    it('should attempt to pause the subscription', async function (ctx) {
      ctx.client.pauseSubscription = sinon
        .stub()
        .resolves(ctx.recurlySubscription)
      const subscription =
        await ctx.RecurlyClient.promises.pauseSubscriptionByUuid(
          ctx.subscription.uuid,
          3
        )
      expect(subscription).to.deep.equal(ctx.recurlySubscription)
      expect(ctx.client.pauseSubscription).to.be.calledWith(
        'uuid-' + ctx.subscription.uuid,
        { remainingPauseCycles: 3 }
      )
    })
  })

  describe('previewSubscriptionChange', function () {
    describe('compute immediate charge', function () {
      it('only has charge invoice', async function (ctx) {
        ctx.client.previewSubscriptionChange.resolves({
          plan: { code: 'test_code', name: 'test name' },
          unitAmount: 0,
          invoiceCollection: {
            chargeInvoice: {
              subtotal: 100,
              tax: 20,
              total: 120,
            },
          },
        })
        const { immediateCharge } =
          await ctx.RecurlyClient.promises.previewSubscriptionChange(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
              timeframe: 'now',
              planCode: 'new-plan',
            })
          )
        expect(immediateCharge.subtotal).to.be.equal(100)
        expect(immediateCharge.tax).to.be.equal(20)
        expect(immediateCharge.total).to.be.equal(120)
      })

      it('credit invoice with imprecise float number', async function (ctx) {
        ctx.client.previewSubscriptionChange.resolves({
          plan: { code: 'test_code', name: 'test name' },
          unitAmount: 0,
          invoiceCollection: {
            chargeInvoice: {
              subtotal: 100.3,
              tax: 20.3,
              total: 120.3,
            },
            creditInvoices: [
              {
                subtotal: -20.1,
                tax: -4.1,
                total: -24.1,
              },
            ],
          },
        })
        const { immediateCharge } =
          await ctx.RecurlyClient.promises.previewSubscriptionChange(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
              timeframe: 'now',
              planCode: 'new-plan',
            })
          )
        expect(immediateCharge.subtotal).to.be.equal(80.2)
        expect(immediateCharge.tax).to.be.equal(16.2)
        expect(immediateCharge.total).to.be.equal(96.2)
      })
    })

    it('should throw SubtotalLimitExceededError', async function (ctx) {
      class ValidationError extends recurly.errors.ValidationError {
        constructor() {
          super()
          this.params = [{ param: 'subtotal_amount_in_cents' }]
        }
      }
      ctx.client.previewSubscriptionChange = sinon
        .stub()
        .throws(new ValidationError())
      await expect(
        ctx.RecurlyClient.promises.previewSubscriptionChange(
          new PaymentProviderSubscriptionChangeRequest({
            subscription: ctx.subscription,
            timeframe: 'now',
            planCode: 'new-plan',
          })
        )
      ).to.be.rejectedWith(ctx.Errors.SubtotalLimitExceededError)
    })

    it('should rethrow errors different than SubtotalLimitExceededError', async function (ctx) {
      ctx.client.previewSubscriptionChange = sinon.stub().throws(new Error())
      await expect(
        ctx.RecurlyClient.promises.previewSubscriptionChange(
          new PaymentProviderSubscriptionChangeRequest({
            subscription: ctx.subscription,
            timeframe: 'now',
            planCode: 'new-plan',
          })
        )
      ).to.be.rejectedWith(Error)
    })
  })

  describe('getPaymentMethod', function () {
    it('should throw MissingBillingInfoError', async function (ctx) {
      ctx.client.getBillingInfo = sinon
        .stub()
        .throws(new recurly.errors.NotFoundError())
      await expect(
        ctx.RecurlyClient.promises.getPaymentMethod(ctx.user._id)
      ).to.be.rejectedWith(ctx.Errors.MissingBillingInfoError)
    })

    it('should rethrow errors different than MissingBillingInfoError', async function (ctx) {
      ctx.client.getBillingInfo = sinon.stub().throws(new Error())
      await expect(
        ctx.RecurlyClient.promises.getPaymentMethod(ctx.user._id)
      ).to.be.rejectedWith(Error)
    })
  })

  describe('terminateSubscriptionByUuid', function () {
    it('should attempt to terminate the subscription', async function (ctx) {
      ctx.client.terminateSubscription = sinon
        .stub()
        .resolves(ctx.recurlySubscription)
      const subscription =
        await ctx.RecurlyClient.promises.terminateSubscriptionByUuid(
          ctx.subscription.uuid
        )
      expect(subscription).to.deep.equal(ctx.recurlySubscription)
      expect(ctx.client.terminateSubscription).to.be.calledWith(
        'uuid-' + ctx.subscription.uuid
      )
    })
  })

  describe('getPastDueInvoices', function () {
    beforeEach(function (ctx) {
      ctx.client.listSubscriptionInvoices = sinon.stub()
    })

    it('should return empty if no past due are found', async function (ctx) {
      ctx.client.listSubscriptionInvoices.returns({
        each: async function* () {},
      })
      const invoices = await ctx.RecurlyClient.promises.getPastDueInvoices(
        ctx.subscription.id
      )
      expect(invoices).to.deep.equal([])
    })

    it('should return past due invoice', async function (ctx) {
      const pastDueInvoice = { id: 'invoice-1', state: 'past_due' }
      ctx.client.listSubscriptionInvoices.returns({
        each: async function* () {
          yield pastDueInvoice
        },
      })
      const invoices = await ctx.RecurlyClient.promises.getPastDueInvoices(
        ctx.subscription.id
      )
      expect(invoices).to.deep.equal([pastDueInvoice])
    })

    it('should return multiple invoices if multiple past due exist', async function (ctx) {
      const pastDueInvoices = [
        { id: 'invoice-1', state: 'past_due' },
        { id: 'invoice-2', state: 'past_due' },
      ]
      ctx.client.listSubscriptionInvoices.returns({
        each: async function* () {
          for (const invoice of pastDueInvoices) {
            yield invoice
          }
        },
      })
      const invoices = await ctx.RecurlyClient.promises.getPastDueInvoices(
        ctx.subscription.id
      )
      expect(invoices).to.deep.equal(pastDueInvoices)
    })
  })
})
