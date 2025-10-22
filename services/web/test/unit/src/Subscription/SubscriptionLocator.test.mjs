import { vi, expect } from 'vitest'
import sinon from 'sinon'
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionLocator'

describe('Subscription Locator Tests', function () {
  beforeEach(async function (ctx) {
    ctx.user = { _id: '5208dd34438842e2db333333' }
    ctx.subscription = { hello: 'world' }
    ctx.Subscription = {
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
    ctx.DeletedSubscription = {
      findOne: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
      find: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
    }

    vi.doMock(
      '../../../../app/src/Features/Subscription/GroupPlansData',
      () => ({
        default: {},
      })
    )

    vi.doMock('../../../../app/src/models/Subscription', () => ({
      Subscription: ctx.Subscription,
    }))

    vi.doMock('../../../../app/src/models/DeletedSubscription', () => ({
      DeletedSubscription: ctx.DeletedSubscription,
    }))

    vi.doMock('../../../../app/src/models/SSOConfig', () => ({
      SSOConfig: ctx.SSOConfig,
    }))

    ctx.SubscriptionLocator = (await import(modulePath)).default
  })

  describe('finding users subscription', function () {
    it('should send the users features', async function (ctx) {
      ctx.Subscription.findOne.returns({
        exec: sinon.stub().resolves(ctx.subscription),
      })
      const subscription =
        await ctx.SubscriptionLocator.promises.getUsersSubscription(ctx.user)
      ctx.Subscription.findOne
        .calledWith({ admin_id: ctx.user._id })
        .should.equal(true)
      subscription.should.equal(ctx.subscription)
    })

    it('should error if not found', async function (ctx) {
      ctx.Subscription.findOne.returns({
        exec: sinon.stub().rejects('not found'),
      })
      await expect(
        ctx.SubscriptionLocator.promises.getUsersSubscription(ctx.user)
      ).to.be.rejected
    })

    it('should take a user id rather than the user object', async function (ctx) {
      ctx.Subscription.findOne.returns({
        exec: sinon.stub().resolves(ctx.subscription),
      })
      const subscription =
        await ctx.SubscriptionLocator.promises.getUsersSubscription(
          ctx.user._id
        )
      ctx.Subscription.findOne
        .calledWith({ admin_id: ctx.user._id })
        .should.equal(true)
      subscription.should.equal(ctx.subscription)
    })
  })

  describe('getUserSubscriptionStatus', function () {
    it('should return no active personal or group subscription when no user is passed', async function (ctx) {
      const subscriptionStatus =
        await ctx.SubscriptionLocator.promises.getUserSubscriptionStatus(
          undefined
        )
      expect(subscriptionStatus).to.deep.equal({
        personal: false,
        group: false,
      })
    })

    it('should return no active personal or group subscription when the user has no subscription', async function (ctx) {
      const subscriptionStatus =
        await ctx.SubscriptionLocator.promises.getUserSubscriptionStatus(
          ctx.user._id
        )
      expect(subscriptionStatus).to.deep.equal({
        personal: false,
        group: false,
      })
    })

    it('should return active personal subscription', async function (ctx) {
      ctx.Subscription.findOne.returns({
        exec: sinon.stub().resolves({
          recurlyStatus: {
            state: 'active',
          },
        }),
      })
      const subscriptionStatus =
        await ctx.SubscriptionLocator.promises.getUserSubscriptionStatus(
          ctx.user._id
        )
      expect(subscriptionStatus).to.deep.equal({ personal: true, group: false })
    })

    it('should return active group subscription when member of a group plan', async function (ctx) {
      ctx.Subscription.find.returns({
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
        await ctx.SubscriptionLocator.promises.getUserSubscriptionStatus(
          ctx.user._id
        )
      expect(subscriptionStatus).to.deep.equal({ personal: false, group: true })
    })

    it('should return active group subscription when owner of a group plan', async function (ctx) {
      ctx.Subscription.findOne.returns({
        exec: sinon.stub().resolves({
          recurlyStatus: {
            state: 'active',
          },
          groupPlan: true,
        }),
      })
      const subscriptionStatus =
        await ctx.SubscriptionLocator.promises.getUserSubscriptionStatus(
          ctx.user._id
        )
      expect(subscriptionStatus).to.deep.equal({ personal: false, group: true })
    })

    it('should return active personal and group subscription when has personal subscription and member of a group', async function (ctx) {
      ctx.Subscription.find.returns({
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
      ctx.Subscription.findOne.returns({
        exec: sinon.stub().resolves({
          recurlyStatus: {
            state: 'active',
          },
        }),
      })
      const subscriptionStatus =
        await ctx.SubscriptionLocator.promises.getUserSubscriptionStatus(
          ctx.user._id
        )
      expect(subscriptionStatus).to.deep.equal({ personal: true, group: true })
    })
  })
})
