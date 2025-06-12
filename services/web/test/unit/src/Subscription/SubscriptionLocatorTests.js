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
        populate: sinon.stub().returns({
          populate: sinon.stub().returns({
            exec: sinon.stub().resolves([]),
          }),
        }),
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

  describe('getUserSubscriptionStatus', function () {
    it('should return no active personal or group subscription when no user is passed', async function () {
      const subscriptionStatus =
        await this.SubscriptionLocator.promises.getUserSubscriptionStatus(
          undefined
        )
      expect(subscriptionStatus).to.deep.equal({
        personal: false,
        group: false,
      })
    })

    it('should return no active personal or group subscription when the user has no subscription', async function () {
      const subscriptionStatus =
        await this.SubscriptionLocator.promises.getUserSubscriptionStatus(
          this.user._id
        )
      expect(subscriptionStatus).to.deep.equal({
        personal: false,
        group: false,
      })
    })

    it('should return active personal subscription', async function () {
      this.Subscription.findOne.returns({
        exec: sinon.stub().resolves({
          recurlyStatus: {
            state: 'active',
          },
        }),
      })
      const subscriptionStatus =
        await this.SubscriptionLocator.promises.getUserSubscriptionStatus(
          this.user._id
        )
      expect(subscriptionStatus).to.deep.equal({ personal: true, group: false })
    })

    it('should return active group subscription when member of a group plan', async function () {
      this.Subscription.find.returns({
        populate: sinon.stub().returns({
          populate: sinon.stub().returns({
            exec: sinon.stub().resolves([
              {
                recurlyStatus: {
                  state: 'active',
                },
                groupPlan: true,
              },
            ]),
          }),
        }),
      })
      const subscriptionStatus =
        await this.SubscriptionLocator.promises.getUserSubscriptionStatus(
          this.user._id
        )
      expect(subscriptionStatus).to.deep.equal({ personal: false, group: true })
    })

    it('should return active group subscription when owner of a group plan', async function () {
      this.Subscription.findOne.returns({
        exec: sinon.stub().resolves({
          recurlyStatus: {
            state: 'active',
          },
          groupPlan: true,
        }),
      })
      const subscriptionStatus =
        await this.SubscriptionLocator.promises.getUserSubscriptionStatus(
          this.user._id
        )
      expect(subscriptionStatus).to.deep.equal({ personal: false, group: true })
    })

    it('should return active personal and group subscription when has personal subscription and member of a group', async function () {
      this.Subscription.find.returns({
        populate: sinon.stub().returns({
          populate: sinon.stub().returns({
            exec: sinon.stub().resolves([
              {
                recurlyStatus: {
                  state: 'active',
                },
                groupPlan: true,
              },
            ]),
          }),
        }),
      })
      this.Subscription.findOne.returns({
        exec: sinon.stub().resolves({
          recurlyStatus: {
            state: 'active',
          },
        }),
      })
      const subscriptionStatus =
        await this.SubscriptionLocator.promises.getUserSubscriptionStatus(
          this.user._id
        )
      expect(subscriptionStatus).to.deep.equal({ personal: true, group: true })
    })
  })
})
