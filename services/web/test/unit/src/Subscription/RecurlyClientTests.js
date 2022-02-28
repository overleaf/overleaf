const sinon = require('sinon')
const { expect } = require('chai')
const recurly = require('recurly')
const modulePath = '../../../../app/src/Features/Subscription/RecurlyClient'
const SandboxedModule = require('sandboxed-module')

describe('RecurlyClient', function () {
  beforeEach(function () {
    this.settings = {
      apis: {
        recurly: {
          apiKey: 'nonsense',
          privateKey: 'private_nonsense',
        },
      },
    }

    this.user = { _id: '123456', email: 'joe@example.com', first_name: 'Joe' }
    this.subscription = {
      id: 'subscription-123',
      uuid: 'subscription-uuid-123',
    }
    this.subscriptionChange = { id: 'subscription-change-123' }

    this.recurlyAccount = new recurly.Account()
    Object.assign(this.recurlyAccount, { code: this.user._id })

    this.recurlySubscription = new recurly.Subscription()
    Object.assign(this.recurlySubscription, this.subscription)

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
    }
    this.recurly = {
      errors: recurly.errors,
      Client: function () {
        return client
      },
    }

    return (this.RecurlyClient = SandboxedModule.require(modulePath, {
      globals: {
        console: console,
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
        .resolves(this.recurlySubscription)
      await expect(
        this.RecurlyClient.promises.getSubscription(this.subscription.id)
      )
        .to.eventually.be.an.instanceOf(recurly.Subscription)
        .that.has.property('id', this.subscription.id)
    })

    it('should throw any API errors', async function () {
      this.client.getSubscription = sinon.stub().throws()
      await expect(
        this.RecurlyClient.promises.getSubscription(this.user._id)
      ).to.eventually.be.rejectedWith(Error)
    })
  })

  describe('changeSubscription', function () {
    beforeEach(function () {
      this.client.createSubscriptionChange = sinon
        .stub()
        .resolves(this.recurlySubscriptionChange)
    })

    it('should attempt to create a subscription change', async function () {
      this.RecurlyClient.promises.changeSubscription(this.subscription.id, {})
      expect(this.client.createSubscriptionChange).to.be.calledWith(
        this.subscription.id
      )
    })

    it('should return the subscription change event', async function () {
      await expect(
        this.RecurlyClient.promises.changeSubscription(
          this.subscriptionChange.id,
          {}
        )
      )
        .to.eventually.be.an.instanceOf(recurly.SubscriptionChange)
        .that.has.property('id', this.subscriptionChange.id)
    })

    it('should throw any API errors', async function () {
      this.client.createSubscriptionChange = sinon.stub().throws()
      await expect(
        this.RecurlyClient.promises.changeSubscription(this.subscription.id, {})
      ).to.eventually.be.rejectedWith(Error)
    })

    describe('changeSubscriptionByUuid', function () {
      it('should attempt to create a subscription change', async function () {
        this.RecurlyClient.promises.changeSubscriptionByUuid(
          this.subscription.uuid,
          {}
        )
        expect(this.client.createSubscriptionChange).to.be.calledWith(
          'uuid-' + this.subscription.uuid
        )
      })

      it('should return the subscription change event', async function () {
        await expect(
          this.RecurlyClient.promises.changeSubscriptionByUuid(
            this.subscriptionChange.id,
            {}
          )
        )
          .to.eventually.be.an.instanceOf(recurly.SubscriptionChange)
          .that.has.property('id', this.subscriptionChange.id)
      })

      it('should throw any API errors', async function () {
        this.client.createSubscriptionChange = sinon.stub().throws()
        await expect(
          this.RecurlyClient.promises.changeSubscriptionByUuid(
            this.subscription.id,
            {}
          )
        ).to.eventually.be.rejectedWith(Error)
      })
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
      await expect(
        this.RecurlyClient.promises.reactivateSubscriptionByUuid(
          this.subscription.uuid
        )
      ).to.eventually.be.an.instanceOf(recurly.Subscription)
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
      await expect(
        this.RecurlyClient.promises.cancelSubscriptionByUuid(
          this.subscription.uuid
        )
      ).to.eventually.be.an.instanceOf(recurly.Subscription)
      expect(this.client.cancelSubscription).to.be.calledWith(
        'uuid-' + this.subscription.uuid
      )
    })
  })
})
