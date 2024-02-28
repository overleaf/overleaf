const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionLocator'
const { expect } = require('chai')

describe('Subscription Locator Tests', function () {
  beforeEach(function () {
    this.user = { _id: '5208dd34438842e2db333333' }
    this.subscription = { hello: 'world' }
    this.Subscription = {
      findOne: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
      find: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
    }
    this.DeletedSubscription = {
      findOne: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
      find: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
    }

    this.SubscriptionLocator = SandboxedModule.require(modulePath, {
      requires: {
        './GroupPlansData': {},
        '../../models/Subscription': {
          Subscription: this.Subscription,
        },
        '../../models/DeletedSubscription': {
          DeletedSubscription: this.DeletedSubscription,
        },
        '../../models/SSOConfig': {
          SSOConfig: this.SSOConfig,
        },
      },
    })
  })

  describe('finding users subscription', function () {
    it('should send the users features', async function () {
      this.Subscription.findOne.returns({
        exec: sinon.stub().resolves(this.subscription),
      })
      const subscription =
        await this.SubscriptionLocator.promises.getUsersSubscription(this.user)
      this.Subscription.findOne
        .calledWith({ admin_id: this.user._id })
        .should.equal(true)
      subscription.should.equal(this.subscription)
    })

    it('should error if not found', async function () {
      this.Subscription.findOne.returns({
        exec: sinon.stub().rejects('not found'),
      })
      await expect(
        this.SubscriptionLocator.promises.getUsersSubscription(this.user)
      ).to.be.rejected
    })

    it('should take a user id rather than the user object', async function () {
      this.Subscription.findOne.returns({
        exec: sinon.stub().resolves(this.subscription),
      })
      const subscription =
        await this.SubscriptionLocator.promises.getUsersSubscription(
          this.user._id
        )
      this.Subscription.findOne
        .calledWith({ admin_id: this.user._id })
        .should.equal(true)
      subscription.should.equal(this.subscription)
    })
  })
})
