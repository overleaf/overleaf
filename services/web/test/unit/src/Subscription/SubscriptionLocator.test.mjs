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

    ctx.isProfessionalGroupPlan = sinon.stub()
    vi.doMock('../../../../app/src/Features/Subscription/PlansHelper', () => ({
      isProfessionalGroupPlan: subscription =>
        ctx.isProfessionalGroupPlan(subscription),
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

  describe('getUserActiveProfessionalGroupSubscriptions', function () {
    beforeEach(function (ctx) {
      ctx.standardSubscription = {
        _id: 'standard-sub',
        groupPlan: true,
        planCode: 'group_standard',
      }
      ctx.professionalSubscription = {
        _id: 'professional-sub',
        groupPlan: true,
        planCode: 'group_professional',
      }
      ctx.Subscription.find.returns({
        exec: sinon
          .stub()
          .resolves([ctx.standardSubscription, ctx.professionalSubscription]),
      })
      ctx.isProfessionalGroupPlan.callsFake(
        subscription => subscription === ctx.professionalSubscription
      )
    })

    it('returns only the professional group subscriptions', async function (ctx) {
      const result =
        await ctx.SubscriptionLocator.promises.getUserActiveProfessionalGroupSubscriptions(
          ctx.user._id
        )
      expect(result).to.deep.equal([ctx.professionalSubscription])
    })

    it('always requests `planCode` and `groupPlan` so professional status can be determined', async function (ctx) {
      await ctx.SubscriptionLocator.promises.getUserActiveProfessionalGroupSubscriptions(
        ctx.user._id,
        { _id: 1, teamName: 1 }
      )
      const projection = ctx.Subscription.find.lastCall.args[1]
      expect(projection).to.include({
        _id: 1,
        teamName: 1,
        planCode: 1,
        groupPlan: 1,
      })
    })

    it('returns an empty list without querying when no userId is provided', async function (ctx) {
      const result =
        await ctx.SubscriptionLocator.promises.getUserActiveProfessionalGroupSubscriptions(
          undefined
        )
      expect(result).to.deep.equal([])
      expect(ctx.Subscription.find.called).to.equal(false)
    })
  })
})
