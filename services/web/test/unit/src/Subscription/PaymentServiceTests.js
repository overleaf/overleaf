const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const {
  RecurlySubscription,
  RecurlyAccount,
  RecurlyCoupon,
} = require('../../../../app/src/Features/Subscription/RecurlyEntities')

const MODULE_PATH = '../../../../app/src/Features/Subscription/PaymentService'

describe('PaymentService', function () {
  beforeEach(function () {
    this.user = {
      _id: '123456',
    }
    this.recurlySubscription = new RecurlySubscription({
      id: 'subscription-id',
      userId: this.user._id,
      currency: 'EUR',
      planCode: 'plan-code',
      planName: 'plan-name',
      planPrice: 13,
      addOns: [],
      subtotal: 15,
      taxRate: 0.1,
      taxAmount: 1.5,
      total: 14.5,
      periodStart: new Date(),
      periodEnd: new Date(),
      collectionMethod: 'automatic',
    })
    this.recurlyAccount = new RecurlyAccount({
      code: this.user._id,
      email: 'example@example.com',
      hasPastDueInvoice: true,
    })
    this.recurlyCoupons = [
      new RecurlyCoupon({
        code: 'coupon-code',
        name: 'coupon name',
        description: 'coupon description',
      }),
    ]
    this.mongoSubscription = {
      admin_id: this.user,
      recurlySubscription_id: this.recurlySubscription.id,
    }
    this.RecurlyClient = {
      promises: {
        getSubscription: sinon.stub(),
        getAccountForUserId: sinon.stub(),
        getActiveCouponsForUserId: sinon.stub(),
      },
    }
    return (this.PaymentService = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './RecurlyClient': this.RecurlyClient,
      },
    }))
  })

  describe('getPaymentFromRecord', function () {
    it('should return null for a missing subscription', async function () {
      const response =
        await this.PaymentService.promises.getPaymentFromRecord(null)
      expect(response).to.equal(null)
    })

    it('should return null if payment service subscription id is missing', async function () {
      this.mongoSubscription.recurlySubscription_id = null
      const response = await this.PaymentService.promises.getPaymentFromRecord(
        this.mongoSubscription
      )
      expect(response).to.equal(null)
    })

    it('should return the subscription', async function () {
      this.RecurlyClient.promises.getSubscription.returns(
        this.recurlySubscription
      )
      const response = await this.PaymentService.promises.getPaymentFromRecord(
        this.mongoSubscription
      )
      expect(response.subscription).to.deep.equal(this.recurlySubscription)
    })

    it('should return account information if found', async function () {
      this.RecurlyClient.promises.getSubscription.returns(
        this.recurlySubscription
      )
      this.RecurlyClient.promises.getAccountForUserId.returns(
        this.recurlyAccount
      )
      const response = await this.PaymentService.promises.getPaymentFromRecord(
        this.mongoSubscription
      )
      expect(response.account.email).to.equal(this.recurlyAccount.email)
      expect(response.account.hasPastDueInvoice).to.equal(
        this.recurlyAccount.hasPastDueInvoice
      )
    })

    it('should include coupons if found', async function () {
      this.RecurlyClient.promises.getSubscription.returns(
        this.recurlySubscription
      )
      this.RecurlyClient.promises.getActiveCouponsForUserId.returns(
        this.recurlyCoupons
      )
      const response = await this.PaymentService.promises.getPaymentFromRecord(
        this.mongoSubscription
      )
      expect(response.coupons).to.deep.equal(this.recurlyCoupons)
    })
  })
})
