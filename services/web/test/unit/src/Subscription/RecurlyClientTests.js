const sinon = require('sinon')
const { expect } = require('chai')
const recurly = require('recurly')
const SandboxedModule = require('sandboxed-module')
const {
  RecurlySubscription,
  RecurlySubscriptionChangeRequest,
  RecurlySubscriptionAddOnUpdate,
} = require('../../../../app/src/Features/Subscription/RecurlyEntities')

const MODULE_PATH = '../../../../app/src/Features/Subscription/RecurlyClient'

describe('RecurlyClient', function () {
  beforeEach(function () {
    this.settings = {
      apis: {
        recurly: {
          apiKey: 'nonsense',
          privateKey: 'private_nonsense',
        },
      },
      plans: [],
      features: [],
    }

    this.user = { _id: '123456', email: 'joe@example.com', first_name: 'Joe' }
    this.subscriptionChange = { id: 'subscription-change-123' }
    this.recurlyAccount = new recurly.Account()
    Object.assign(this.recurlyAccount, { code: this.user._id })

    this.subscriptionAddOn = {
      code: 'addon-code',
      name: 'My Add-On',
      quantity: 1,
      unitPrice: 2,
      preTaxTotal: 2,
    }

    this.subscription = new RecurlySubscription({
      id: 'subscription-id',
      userId: 'user-id',
      currency: 'EUR',
      planCode: 'plan-code',
      planName: 'plan-name',
      planPrice: 13,
      addOns: [this.subscriptionAddOn],
      subtotal: 15,
      taxRate: 0.1,
      taxAmount: 1.5,
      total: 16.5,
      periodStart: new Date(),
      periodEnd: new Date(),
      collectionMethod: 'automatic',
    })

    this.recurlySubscription = {
      uuid: this.subscription.id,
      account: {
        code: this.subscription.userId,
      },
      plan: {
        code: this.subscription.planCode,
        name: this.subscription.planName,
      },
      addOns: [
        {
          addOn: {
            code: this.subscriptionAddOn.code,
            name: this.subscriptionAddOn.name,
          },
          quantity: this.subscriptionAddOn.quantity,
          unitAmount: this.subscriptionAddOn.unitPrice,
        },
      ],
      unitAmount: this.subscription.planPrice,
      subtotal: this.subscription.subtotal,
      taxInfo: { rate: this.subscription.taxRate },
      tax: this.subscription.taxAmount,
      total: this.subscription.total,
      currency: this.subscription.currency,
      currentPeriodStartedAt: this.subscription.periodStart,
      currentPeriodEndsAt: this.subscription.periodEnd,
      collectionMethod: this.subscription.collectionMethod,
    }

    this.recurlySubscriptionChange = new recurly.SubscriptionChange()
    Object.assign(this.recurlySubscriptionChange, this.subscriptionChange)

    this.UserGetter = {
      promises: {
        getUser: sinon.stub().callsFake(userId => {
          if (userId === this.user._id) {
            return this.user
          }
        }),
      },
    }

    let client
    this.client = client = {
      getAccount: sinon.stub(),
      getBillingInfo: sinon.stub(),
      listAccountSubscriptions: sinon.stub(),
      previewSubscriptionChange: sinon.stub(),
    }
    this.recurly = {
      errors: recurly.errors,
      Client: function () {
        return client
      },
    }
    this.Errors = {
      MissingBillingInfoError: class extends Error {},
    }

    return (this.RecurlyClient = SandboxedModule.require(MODULE_PATH, {
      globals: {
        console,
      },
      requires: {
        '@overleaf/settings': this.settings,
        recurly: this.recurly,
        '@overleaf/logger': {
          err: sinon.stub(),
          error: sinon.stub(),
          warn: sinon.stub(),
          log: sinon.stub(),
          debug: sinon.stub(),
        },
        '../User/UserGetter': this.UserGetter,
        './Errors': this.Errors,
      },
    }))
  })

  describe('initalizing recurly client with undefined API key parameter', function () {
    it('should create a client without error', function () {
      let testClient
      expect(() => {
        testClient = new recurly.Client(undefined)
      }).to.not.throw()
      expect(testClient).to.be.instanceOf(recurly.Client)
    })
  })

  describe('getAccountForUserId', function () {
    it('should return an Account if one exists', async function () {
      this.client.getAccount = sinon.stub().resolves(this.recurlyAccount)
      await expect(
        this.RecurlyClient.promises.getAccountForUserId(this.user._id)
      )
        .to.eventually.be.an.instanceOf(recurly.Account)
        .that.has.property('code', this.user._id)
    })

    it('should return nothing if no account found', async function () {
      this.client.getAccount = sinon
        .stub()
        .throws(new recurly.errors.NotFoundError())
      expect(
        this.RecurlyClient.promises.getAccountForUserId('nonsense')
      ).to.eventually.equal(undefined)
    })

    it('should re-throw caught errors', async function () {
      this.client.getAccount = sinon.stub().throws()
      await expect(
        this.RecurlyClient.promises.getAccountForUserId(this.user._id)
      ).to.eventually.be.rejectedWith(Error)
    })
  })

  describe('createAccountForUserId', function () {
    it('should return the Account as created by recurly', async function () {
      this.client.createAccount = sinon.stub().resolves(this.recurlyAccount)
      await expect(
        this.RecurlyClient.promises.createAccountForUserId(this.user._id)
      )
        .to.eventually.be.an.instanceOf(recurly.Account)
        .that.has.property('code', this.user._id)
    })

    it('should throw any API errors', async function () {
      this.client.createAccount = sinon.stub().throws()
      await expect(
        this.RecurlyClient.promises.createAccountForUserId(this.user._id)
      ).to.eventually.be.rejectedWith(Error)
    })
  })

  describe('getSubscription', function () {
    it('should return the subscription found by recurly', async function () {
      this.client.getSubscription = sinon
        .stub()
        .withArgs('uuid-subscription-id')
        .resolves(this.recurlySubscription)
      const subscription = await this.RecurlyClient.promises.getSubscription(
        this.subscription.id
      )
      expect(subscription).to.deep.equal(this.subscription)
    })

    it('should throw any API errors', async function () {
      this.client.getSubscription = sinon.stub().throws()
      await expect(
        this.RecurlyClient.promises.getSubscription(this.user._id)
      ).to.eventually.be.rejectedWith(Error)
    })
  })

  describe('getSubscriptionForUser', function () {
    it("should return null if the account doesn't exist", async function () {
      this.client.listAccountSubscriptions.returns({
        // eslint-disable-next-line require-yield
        each: async function* () {
          throw new recurly.errors.NotFoundError('account not found')
        },
      })
      const subscription =
        await this.RecurlyClient.promises.getSubscriptionForUser('some-user')
      expect(subscription).to.be.null
    })

    it("should return null if the account doesn't have subscriptions", async function () {
      this.client.listAccountSubscriptions.returns({
        each: async function* () {},
      })
      const subscription =
        await this.RecurlyClient.promises.getSubscriptionForUser('some-user')
      expect(subscription).to.be.null
    })

    it('should return the subscription if the account has one subscription', async function () {
      const recurlySubscription = this.recurlySubscription
      this.client.listAccountSubscriptions.returns({
        each: async function* () {
          yield recurlySubscription
        },
      })
      const subscription =
        await this.RecurlyClient.promises.getSubscriptionForUser('some-user')
      expect(subscription).to.deep.equal(this.subscription)
    })

    it('should throw an error if the account has more than one subscription', async function () {
      const recurlySubscription = this.recurlySubscription
      this.client.listAccountSubscriptions.returns({
        each: async function* () {
          yield recurlySubscription
          yield { another: 'subscription' }
        },
      })
      await expect(
        this.RecurlyClient.promises.getSubscriptionForUser('some-user')
      ).to.be.rejected
    })
  })

  describe('applySubscriptionChangeRequest', function () {
    beforeEach(function () {
      this.client.createSubscriptionChange = sinon
        .stub()
        .resolves(this.recurlySubscriptionChange)
    })

    it('handles plan changes', async function () {
      await this.RecurlyClient.promises.applySubscriptionChangeRequest(
        new RecurlySubscriptionChangeRequest({
          subscription: this.subscription,
          timeframe: 'now',
          planCode: 'new-plan',
        })
      )
      expect(this.client.createSubscriptionChange).to.be.calledWith(
        'uuid-subscription-id',
        { timeframe: 'now', planCode: 'new-plan' }
      )
    })

    it('handles add-on changes', async function () {
      await this.RecurlyClient.promises.applySubscriptionChangeRequest(
        new RecurlySubscriptionChangeRequest({
          subscription: this.subscription,
          timeframe: 'now',
          addOnUpdates: [
            new RecurlySubscriptionAddOnUpdate({
              code: 'new-add-on',
              quantity: 2,
              unitPrice: 8.99,
            }),
          ],
        })
      )
      expect(this.client.createSubscriptionChange).to.be.calledWith(
        'uuid-subscription-id',
        {
          timeframe: 'now',
          addOns: [{ code: 'new-add-on', quantity: 2, unitAmount: 8.99 }],
        }
      )
    })

    it('should throw any API errors', async function () {
      this.client.createSubscriptionChange = sinon.stub().throws()
      await expect(
        this.RecurlyClient.promises.applySubscriptionChangeRequest({
          subscription: this.subscription,
        })
      ).to.eventually.be.rejectedWith(Error)
    })
  })

  describe('removeSubscriptionChange', function () {
    beforeEach(function () {
      this.client.removeSubscriptionChange = sinon.stub().resolves()
    })

    it('should attempt to remove a pending subscription change', async function () {
      this.RecurlyClient.promises.removeSubscriptionChange(
        this.subscription.id,
        {}
      )
      expect(this.client.removeSubscriptionChange).to.be.calledWith(
        this.subscription.id
      )
    })

    it('should throw any API errors', async function () {
      this.client.removeSubscriptionChange = sinon.stub().throws()
      await expect(
        this.RecurlyClient.promises.removeSubscriptionChange(
          this.subscription.id,
          {}
        )
      ).to.eventually.be.rejectedWith(Error)
    })

    describe('removeSubscriptionChangeByUuid', function () {
      it('should attempt to remove a pending subscription change', async function () {
        this.RecurlyClient.promises.removeSubscriptionChangeByUuid(
          this.subscription.uuid,
          {}
        )
        expect(this.client.removeSubscriptionChange).to.be.calledWith(
          'uuid-' + this.subscription.uuid
        )
      })

      it('should throw any API errors', async function () {
        this.client.removeSubscriptionChange = sinon.stub().throws()
        await expect(
          this.RecurlyClient.promises.removeSubscriptionChangeByUuid(
            this.subscription.id,
            {}
          )
        ).to.eventually.be.rejectedWith(Error)
      })
    })
  })

  describe('reactivateSubscriptionByUuid', function () {
    it('should attempt to reactivate the subscription', async function () {
      this.client.reactivateSubscription = sinon
        .stub()
        .resolves(this.recurlySubscription)
      const subscription =
        await this.RecurlyClient.promises.reactivateSubscriptionByUuid(
          this.subscription.uuid
        )
      expect(subscription).to.deep.equal(this.recurlySubscription)
      expect(this.client.reactivateSubscription).to.be.calledWith(
        'uuid-' + this.subscription.uuid
      )
    })
  })

  describe('cancelSubscriptionByUuid', function () {
    it('should attempt to cancel the subscription', async function () {
      this.client.cancelSubscription = sinon
        .stub()
        .resolves(this.recurlySubscription)
      const subscription =
        await this.RecurlyClient.promises.cancelSubscriptionByUuid(
          this.subscription.uuid
        )
      expect(subscription).to.deep.equal(this.recurlySubscription)
      expect(this.client.cancelSubscription).to.be.calledWith(
        'uuid-' + this.subscription.uuid
      )
    })
  })

  describe('pauseSubscriptionByUuid', function () {
    it('should attempt to pause the subscription', async function () {
      this.client.pauseSubscription = sinon
        .stub()
        .resolves(this.recurlySubscription)
      const subscription =
        await this.RecurlyClient.promises.pauseSubscriptionByUuid(
          this.subscription.uuid,
          3
        )
      expect(subscription).to.deep.equal(this.recurlySubscription)
      expect(this.client.pauseSubscription).to.be.calledWith(
        'uuid-' + this.subscription.uuid,
        { remainingPauseCycles: 3 }
      )
    })
  })

  describe('previewSubscriptionChange', function () {
    describe('compute immediate charge', function () {
      it('only has charge invoice', async function () {
        this.client.previewSubscriptionChange.resolves({
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
          await this.RecurlyClient.promises.previewSubscriptionChange(
            new RecurlySubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              planCode: 'new-plan',
            })
          )
        expect(immediateCharge.subtotal).to.be.equal(100)
        expect(immediateCharge.tax).to.be.equal(20)
        expect(immediateCharge.total).to.be.equal(120)
      })

      it('credit invoice with imprecise float number', async function () {
        this.client.previewSubscriptionChange.resolves({
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
          await this.RecurlyClient.promises.previewSubscriptionChange(
            new RecurlySubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              planCode: 'new-plan',
            })
          )
        expect(immediateCharge.subtotal).to.be.equal(80.2)
        expect(immediateCharge.tax).to.be.equal(16.2)
        expect(immediateCharge.total).to.be.equal(96.2)
      })
    })
  })

  describe('getPaymentMethod', function () {
    it('should throw MissingBillingInfoError', async function () {
      this.client.getBillingInfo = sinon
        .stub()
        .throws(new recurly.errors.NotFoundError())
      await expect(
        this.RecurlyClient.promises.getPaymentMethod(this.user._id)
      ).to.be.rejectedWith(this.Errors.MissingBillingInfoError)
    })

    it('should rethrow errors different than MissingBillingInfoError', async function () {
      this.client.getBillingInfo = sinon.stub().throws(new Error())
      await expect(
        this.RecurlyClient.promises.getPaymentMethod(this.user._id)
      ).to.be.rejectedWith(Error)
    })
  })
})
