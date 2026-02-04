import { beforeEach, describe, it, vi, assert, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionUpdater'

const { ObjectId } = mongodb

describe('SubscriptionUpdater', function () {
  beforeEach(async function (ctx) {
    ctx.recurlyPlan = { planCode: 'recurly-plan' }
    ctx.recurlySubscription = {
      uuid: '1238uoijdasjhd',
      plan: {
        plan_code: ctx.recurlyPlan.planCode,
      },
    }

    ctx.adminUser = { _id: (ctx.adminuser_id = '5208dd34438843e2db000007') }
    ctx.otherUserId = '5208dd34438842e2db000005'
    ctx.allUserIds = ['13213', 'dsadas', 'djsaiud89']
    ctx.subscription = {
      _id: '111111111111111111111111',
      admin_id: ctx.adminUser._id,
      manager_ids: [ctx.adminUser._id],
      member_ids: [],
      save: sinon.stub().resolves(),
      planCode: 'student_or_something',
      recurlySubscription_id: 'abc123def456fab789',
    }
    ctx.user_id = ctx.adminuser_id

    ctx.groupSubscription = {
      _id: '222222222222222222222222',
      admin_id: ctx.adminUser._id,
      manager_ids: [ctx.adminUser._id],
      member_ids: ctx.allUserIds,
      save: sinon.stub().resolves(),
      groupPlan: true,
      planCode: 'group_subscription',
      recurlySubscription_id: '456fab789abc123def',
    }
    ctx.betterGroupSubscription = {
      _id: '999999999999999999999999',
      admin_id: ctx.adminUser._id,
      manager_ids: [ctx.adminUser._id],
      member_ids: [ctx.otherUserId],
      save: sinon.stub().resolves(),
      groupPlan: true,
      planCode: 'better_group_subscription',
      recurlySubscription_id: '123def456fab789abc',
    }

    const subscription = ctx.subscription
    ctx.SubscriptionModel = class {
      constructor(opts) {
        // Always return our mock subscription when creating a new one
        subscription.admin_id = opts.admin_id
        subscription.manager_ids = [opts.admin_id]
        return subscription
      }

      save() {
        return Promise.resolve(subscription)
      }
    }
    ctx.SubscriptionModel.deleteOne = sinon
      .stub()
      .returns({ exec: sinon.stub().resolves() })
    ctx.SubscriptionModel.updateOne = sinon
      .stub()
      .returns({ exec: sinon.stub().resolves() })
    ctx.SubscriptionModel.findOne = sinon.stub().resolves()
    ctx.SubscriptionModel.findById = sinon.stub().resolves()
    ctx.SubscriptionModel.updateMany = sinon
      .stub()
      .returns({ exec: sinon.stub().resolves() })
    ctx.SubscriptionModel.findOneAndUpdate = sinon.stub().returns({
      exec: sinon.stub().resolves(ctx.subscription),
    })

    ctx.SSOConfigModel = class {}
    ctx.SSOConfigModel.findOne = sinon.stub().returns({
      lean: sinon.stub().returns({
        exec: sinon.stub().resolves({ enabled: true }),
      }),
    })

    ctx.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub(),
        getGroupSubscriptionMemberOf: sinon.stub(),
        getMemberSubscriptions: sinon.stub().resolves([]),
        getSubscription: sinon.stub(),
      },
    }

    ctx.SubscriptionLocator.promises.getSubscription
      .withArgs(ctx.subscription._id)
      .resolves(ctx.subscription)

    ctx.Settings = {
      defaultPlanCode: 'personal',
      defaultFeatures: { default: 'features' },
      plans: [
        ctx.recurlyPlan,
        { planCode: ctx.subscription.planCode, features: {} },
        {
          planCode: ctx.groupSubscription.planCode,
          features: {
            collaborators: 10,
            compileTimeout: 60,
            dropbox: true,
          },
        },
        {
          planCode: ctx.betterGroupSubscription.planCode,
          features: {
            collaborators: -1,
            compileTimeout: 240,
            dropbox: true,
          },
        },
      ],
      mongo: {
        options: {
          appname: 'web',
          maxPoolSize: 100,
          serverSelectionTimeoutMS: 60000,
          socketTimeoutMS: 60000,
          monitorCommands: true,
          family: 4,
        },
        url: 'mongodb://mongo/test-overleaf',
        hasSecondaries: false,
      },
    }

    ctx.UserFeaturesUpdater = {
      promises: {
        updateFeatures: sinon.stub().resolves(),
      },
    }

    ctx.ReferalFeatures = {
      promises: {
        getBonusFeatures: sinon.stub().resolves(),
      },
    }

    ctx.FeaturesUpdater = {
      promises: {
        scheduleRefreshFeatures: sinon.stub().resolves(),
        refreshFeatures: sinon.stub().resolves({}),
      },
    }

    ctx.DeletedSubscription = {
      findOneAndUpdate: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }

    ctx.AnalyticsManager = {
      recordEventForUserInBackground: sinon.stub().resolves(),
      setUserPropertyForUserInBackground: sinon.stub(),
      registerAccountMapping: sinon.stub(),
    }

    ctx.Features = {
      hasFeature: sinon.stub().returns(false),
    }

    ctx.UserAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }

    ctx.UserUpdater = {
      promises: {
        updateUser: sinon.stub().resolves(),
      },
    }

    vi.doMock('../../../../app/src/models/Subscription', () => ({
      Subscription: ctx.SubscriptionModel,
    }))

    vi.doMock('../../../../app/src/models/SSOConfig', () => ({
      SSOConfig: ctx.SSOConfigModel,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/UserFeaturesUpdater',
      () => ({
        default: ctx.UserFeaturesUpdater,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('../../../../app/src/infrastructure/mongodb', () => ({
      db: {},
      ObjectId,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/FeaturesUpdater',
      () => ({
        default: ctx.FeaturesUpdater,
      })
    )

    vi.doMock('../../../../app/src/models/DeletedSubscription', () => ({
      DeletedSubscription: ctx.DeletedSubscription,
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Analytics/AccountMappingHelper',
      () => ({
        default: (ctx.AccountMappingHelper = {
          generateSubscriptionToRecurlyMapping: sinon.stub(),
        }),
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: ctx.Features,
    }))

    vi.doMock('../../../../app/src/Features/User/UserAuditLogHandler', () => ({
      default: ctx.UserAuditLogHandler,
    }))

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: ctx.UserUpdater,
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: (ctx.Modules = {
        promises: {
          hooks: {
            fire: sinon.stub().resolves(),
          },
        },
      }),
    }))

    ctx.SubscriptionUpdater = (await import(modulePath)).default
  })

  describe('updateAdmin', function () {
    it('should update the subscription admin', async function (ctx) {
      ctx.subscription.groupPlan = true
      await ctx.SubscriptionUpdater.promises.updateAdmin(
        ctx.subscription,
        ctx.otherUserId
      )
      const query = {
        _id: new ObjectId(ctx.subscription._id),
        customAccount: true,
      }
      const update = {
        $set: { admin_id: new ObjectId(ctx.otherUserId) },
        $addToSet: { manager_ids: new ObjectId(ctx.otherUserId) },
      }
      ctx.SubscriptionModel.updateOne.should.have.been.calledOnce
      ctx.SubscriptionModel.updateOne.should.have.been.calledWith(query, update)
    })

    it('should remove the manager for non-group subscriptions', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.updateAdmin(
        ctx.subscription,
        ctx.otherUserId
      )
      const query = {
        _id: new ObjectId(ctx.subscription._id),
        customAccount: true,
      }
      const update = {
        $set: {
          admin_id: new ObjectId(ctx.otherUserId),
          manager_ids: [new ObjectId(ctx.otherUserId)],
        },
      }
      ctx.SubscriptionModel.updateOne.should.have.been.calledOnce
      ctx.SubscriptionModel.updateOne.should.have.been.calledWith(query, update)
    })
  })

  describe('transferSubscriptionOwnership', function () {
    it('should transfer the subscription ownership for group subscriptions', async function (ctx) {
      ctx.subscription.groupPlan = true
      ctx.subscription.paymentProvider = {
        id: 'stripe-123',
        name: 'stripe-us',
      }
      await ctx.SubscriptionUpdater.promises.transferSubscriptionOwnership(
        ctx.subscription,
        ctx.otherUserId,
        false
      )
      const query = {
        _id: new ObjectId(ctx.subscription._id),
      }
      const update = {
        $set: {
          admin_id: new ObjectId(ctx.otherUserId),
          previousPaymentProvider: ctx.subscription.paymentProvider,
        },
        $addToSet: { manager_ids: new ObjectId(ctx.otherUserId) },
      }
      ctx.SubscriptionModel.updateOne.should.have.been.calledOnce
      ctx.SubscriptionModel.updateOne.should.have.been.calledWith(query, update)
    })

    it('should transfer the subscription ownership for non-group subscriptions', async function (ctx) {
      ctx.subscription.paymentProvider = {
        id: 'stripe-123',
        name: 'stripe-us',
      }
      await ctx.SubscriptionUpdater.promises.transferSubscriptionOwnership(
        ctx.subscription,
        ctx.otherUserId,
        false
      )
      const query = {
        _id: new ObjectId(ctx.subscription._id),
      }
      const update = {
        $set: {
          admin_id: new ObjectId(ctx.otherUserId),
          manager_ids: [new ObjectId(ctx.otherUserId)],
          previousPaymentProvider: ctx.subscription.paymentProvider,
        },
      }
      ctx.SubscriptionModel.updateOne.should.have.been.calledOnce
      ctx.SubscriptionModel.updateOne.should.have.been.calledWith(query, update)
    })

    it('should clear previousPaymentProvider when clearPreviousPaymentProvider is true', async function (ctx) {
      ctx.subscription.paymentProvider = {
        id: 'stripe-123',
        name: 'stripe-us',
      }
      await ctx.SubscriptionUpdater.promises.transferSubscriptionOwnership(
        ctx.subscription,
        ctx.otherUserId,
        true
      )
      const query = {
        _id: new ObjectId(ctx.subscription._id),
      }
      const update = {
        $set: {
          admin_id: new ObjectId(ctx.otherUserId),
          manager_ids: [new ObjectId(ctx.otherUserId)],
        },
        $unset: { previousPaymentProvider: 1 },
      }
      ctx.SubscriptionModel.updateOne.should.have.been.calledOnce
      ctx.SubscriptionModel.updateOne.should.have.been.calledWith(query, update)
    })
  })

  describe('syncSubscription', function () {
    beforeEach(function (ctx) {
      ctx.SubscriptionLocator.promises.getUsersSubscription.resolves(
        ctx.subscription
      )
    })

    it('should update the subscription if the user already is admin of one', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.syncSubscription(
        ctx.recurlySubscription,
        ctx.adminUser._id
      )
      ctx.SubscriptionLocator.promises.getUsersSubscription
        .calledWith(ctx.adminUser._id)
        .should.equal(true)
    })

    it('should not call updateFeatures with group subscription if recurly subscription is not expired', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.syncSubscription(
        ctx.recurlySubscription,
        ctx.adminUser._id
      )
      ctx.SubscriptionLocator.promises.getUsersSubscription
        .calledWith(ctx.adminUser._id)
        .should.equal(true)
      ctx.UserFeaturesUpdater.promises.updateFeatures.called.should.equal(false)
    })
  })

  describe('updateSubscriptionFromRecurly', function () {
    afterEach(function (ctx) {
      ctx.subscription.member_ids = []
      delete ctx.subscription.paymentProvider
    })

    it('should update the subscription with token etc when not expired', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        ctx.recurlySubscription,
        ctx.subscription,
        {}
      )
      ctx.subscription.recurlySubscription_id.should.equal(
        ctx.recurlySubscription.uuid
      )
      ctx.subscription.planCode.should.equal(
        ctx.recurlySubscription.plan.plan_code
      )
      ctx.subscription.save.called.should.equal(true)
      expect(
        ctx.FeaturesUpdater.promises.scheduleRefreshFeatures
      ).to.have.been.calledWith(ctx.adminUser._id)
    })

    it('should send a recurly account mapping event', async function (ctx) {
      const createdAt = new Date().toISOString()
      ctx.AccountMappingHelper.generateSubscriptionToRecurlyMapping.returns({
        source: 'recurly',
        sourceEntity: 'subscription',
        sourceEntityId: ctx.recurlySubscription.uuid,
        target: 'v2',
        targetEntity: 'subscription',
        targetEntityId: ctx.subscription._id,
        createdAt,
      })
      await ctx.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        ctx.recurlySubscription,
        ctx.subscription,
        {}
      )
      expect(
        ctx.AccountMappingHelper.generateSubscriptionToRecurlyMapping
      ).to.have.been.calledWith(
        ctx.subscription._id,
        ctx.recurlySubscription.uuid
      )
      expect(
        ctx.AnalyticsManager.registerAccountMapping
      ).to.have.been.calledWith({
        source: 'recurly',
        sourceEntity: 'subscription',
        sourceEntityId: ctx.recurlySubscription.uuid,
        target: 'v2',
        targetEntity: 'subscription',
        targetEntityId: ctx.subscription._id,
        createdAt,
      })
    })

    it('should not update subscription when paymentProvider service contains stripe', async function (ctx) {
      ctx.subscription.paymentProvider = {
        service: 'stripe-uk',
      }
      await ctx.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        ctx.recurlySubscription,
        ctx.subscription,
        {}
      )
      ctx.subscription.save.called.should.equal(false)
      expect(ctx.FeaturesUpdater.promises.scheduleRefreshFeatures).to.not.have
        .been.called
    })

    it('should remove the subscription when expired', async function (ctx) {
      ctx.recurlySubscription.state = 'expired'
      await ctx.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        ctx.recurlySubscription,
        ctx.subscription,
        {}
      )
      ctx.SubscriptionModel.deleteOne.should.have.been.calledWith({
        _id: ctx.subscription._id,
      })
    })

    it('should not remove the subscription when expired if it has Managed Users enabled', async function (ctx) {
      ctx.Features.hasFeature.withArgs('saas').returns(true)
      ctx.subscription.managedUsersEnabled = true

      ctx.recurlySubscription.state = 'expired'
      await ctx.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        ctx.recurlySubscription,
        ctx.subscription,
        {}
      )
      ctx.SubscriptionModel.deleteOne.should.not.have.been.called
    })

    it('should not remove the subscription when expired if it has Group SSO enabled', async function (ctx) {
      ctx.Features.hasFeature.withArgs('saas').returns(true)
      ctx.subscription.ssoConfig = new ObjectId('abc123abc123abc123abc123')

      ctx.recurlySubscription.state = 'expired'
      await ctx.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        ctx.recurlySubscription,
        ctx.subscription,
        {}
      )
      ctx.SubscriptionModel.deleteOne.should.not.have.been.called
    })

    it('should update all the users features', async function (ctx) {
      ctx.subscription.member_ids = ctx.allUserIds
      await ctx.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        ctx.recurlySubscription,
        ctx.subscription,
        {}
      )
      expect(
        ctx.FeaturesUpdater.promises.scheduleRefreshFeatures
      ).to.have.been.calledWith(ctx.adminUser._id)
      expect(
        ctx.FeaturesUpdater.promises.scheduleRefreshFeatures
      ).to.have.been.calledWith(ctx.allUserIds[0])
      expect(
        ctx.FeaturesUpdater.promises.scheduleRefreshFeatures
      ).to.have.been.calledWith(ctx.allUserIds[1])
      expect(
        ctx.FeaturesUpdater.promises.scheduleRefreshFeatures
      ).to.have.been.calledWith(ctx.allUserIds[2])
    })

    it('should set group to true and save how many members can be added to group', async function (ctx) {
      ctx.recurlyPlan.groupPlan = true
      ctx.recurlyPlan.membersLimit = 5
      await ctx.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        ctx.recurlySubscription,
        ctx.subscription,
        {}
      )
      ctx.subscription.membersLimit.should.equal(5)
      ctx.subscription.groupPlan.should.equal(true)
      ctx.subscription.member_ids.should.deep.equal([ctx.subscription.admin_id])
    })

    it('should delete and replace subscription when downgrading from group to individual plan', async function (ctx) {
      ctx.recurlyPlan.groupPlan = false
      await ctx.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        ctx.recurlySubscription,
        ctx.groupSubscription,
        {}
      )
    })

    it('should not set group to true or set groupPlan', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        ctx.recurlySubscription,
        ctx.subscription,
        {}
      )
      assert.notEqual(ctx.subscription.membersLimit, 5)
      assert.notEqual(ctx.subscription.groupPlan, true)
    })

    describe('when the plan allows adding more seats', function () {
      beforeEach(function (ctx) {
        ctx.membersLimitAddOn = 'add_on1'
        ctx.recurlyPlan.groupPlan = true
        ctx.recurlyPlan.membersLimit = 5
        ctx.recurlyPlan.membersLimitAddOn = ctx.membersLimitAddOn
      })

      function expectMembersLimit(limit) {
        it('should set the membersLimit accordingly', async function (ctx) {
          await ctx.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
            ctx.recurlySubscription,
            ctx.subscription,
            {}
          )
          expect(ctx.subscription.membersLimit).to.equal(limit)
        })
      }

      describe('when the recurlySubscription does not have add ons', function () {
        beforeEach(function (ctx) {
          delete ctx.recurlySubscription.subscription_add_ons
        })
        expectMembersLimit(5)
      })

      describe('when the recurlySubscription has non-matching add ons', function () {
        beforeEach(function (ctx) {
          ctx.recurlySubscription.subscription_add_ons = [
            { add_on_code: 'add_on_99', quantity: 3 },
          ]
        })
        expectMembersLimit(5)
      })

      describe('when the recurlySubscription has a matching add on', function () {
        beforeEach(function (ctx) {
          ctx.recurlySubscription.subscription_add_ons = [
            { add_on_code: ctx.membersLimitAddOn, quantity: 10 },
          ]
        })
        expectMembersLimit(15)
      })

      // NOTE: This is unexpected, but we are going to support it anyways.
      describe('when the recurlySubscription has multiple matching add ons', function () {
        beforeEach(function (ctx) {
          ctx.recurlySubscription.subscription_add_ons = [
            { add_on_code: ctx.membersLimitAddOn, quantity: 10 },
            { add_on_code: ctx.membersLimitAddOn, quantity: 3 },
          ]
        })
        expectMembersLimit(18)
      })
    })
  })

  describe('addUserToGroup', function () {
    it('should add the user ids to the group as a set', async function (ctx) {
      ctx.SubscriptionModel.findOne = sinon
        .stub()
        .resolves(ctx.groupSubscription)

      await ctx.SubscriptionUpdater.promises.addUserToGroup(
        ctx.groupSubscription._id,
        ctx.otherUserId
      )
      const searchOps = { _id: ctx.groupSubscription._id }
      const insertOperation = {
        $addToSet: { member_ids: ctx.otherUserId },
      }
      ctx.SubscriptionModel.updateOne
        .calledWith(searchOps, insertOperation)
        .should.equal(true)
      expect(ctx.SubscriptionModel.updateOne.lastCall.args[2].session).to.exist
      sinon.assert.calledWith(
        ctx.AnalyticsManager.recordEventForUserInBackground,
        ctx.otherUserId,
        'group-subscription-joined',
        {
          groupId: ctx.groupSubscription._id,
          subscriptionId: ctx.groupSubscription.recurlySubscription_id,
        }
      )
    })

    it('should update the users features', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.addUserToGroup(
        ctx.subscription._id,
        ctx.otherUserId
      )
      ctx.FeaturesUpdater.promises.refreshFeatures
        .calledWith(ctx.otherUserId)
        .should.equal(true)
    })

    it('should set the group plan code user property to the best plan with 1 group subscription', async function (ctx) {
      ctx.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(ctx.otherUserId)
        .resolves([ctx.groupSubscription])
      await ctx.SubscriptionUpdater.promises.addUserToGroup(
        ctx.groupSubscription._id,
        ctx.otherUserId
      )
      sinon.assert.calledWith(
        ctx.AnalyticsManager.setUserPropertyForUserInBackground,
        ctx.otherUserId,
        'group-subscription-plan-code',
        'group_subscription'
      )
    })

    it('should set the group plan code user property to the best plan with 2 group subscriptions', async function (ctx) {
      ctx.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(ctx.otherUserId)
        .resolves([ctx.groupSubscription, ctx.betterGroupSubscription])
      await ctx.SubscriptionUpdater.promises.addUserToGroup(
        ctx.betterGroupSubscription._id,
        ctx.otherUserId
      )
      sinon.assert.calledWith(
        ctx.AnalyticsManager.setUserPropertyForUserInBackground,
        ctx.otherUserId,
        'group-subscription-plan-code',
        'better_group_subscription'
      )
    })

    it('should set the group plan code user property to the best plan with 2 group subscriptions in reverse order', async function (ctx) {
      ctx.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(ctx.otherUserId)
        .resolves([ctx.betterGroupSubscription, ctx.groupSubscription])
      await ctx.SubscriptionUpdater.promises.addUserToGroup(
        ctx.betterGroupSubscription._id,
        ctx.otherUserId
      )
      sinon.assert.calledWith(
        ctx.AnalyticsManager.setUserPropertyForUserInBackground,
        ctx.otherUserId,
        'group-subscription-plan-code',
        'better_group_subscription'
      )
    })

    it('should add an entry to the user audit log when joining a group', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.addUserToGroup(
        ctx.subscription._id,
        ctx.otherUserId
      )
      sinon.assert.calledWith(
        ctx.UserAuditLogHandler.promises.addEntry,
        ctx.otherUserId,
        'join-group-subscription',
        undefined,
        undefined,
        {
          subscriptionId: ctx.subscription._id,
        }
      )
    })

    it('should add an entry to the group audit log when joining a group', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.addUserToGroup(
        ctx.subscription._id,
        ctx.otherUserId,
        { ipAddress: '0:0:0:0', initiatorId: 'user123' }
      )

      expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
        'addGroupAuditLogEntry',
        {
          groupId: ctx.subscription._id,
          initiatorId: 'user123',
          ipAddress: '0:0:0:0',
          operation: 'join-group',
        }
      )
    })
  })

  describe('removeUserFromGroup', function () {
    beforeEach(function (ctx) {
      ctx.fakeSubscriptions = [
        {
          _id: 'fake-id-1',
        },
        {
          _id: 'fake-id-2',
        },
      ]
      ctx.SubscriptionModel.findOne.resolves(ctx.groupSubscription)
      ctx.SubscriptionModel.findById = sinon
        .stub()
        .resolves(ctx.groupSubscription)
      ctx.SubscriptionLocator.promises.getMemberSubscriptions.resolves(
        ctx.fakeSubscriptions
      )
    })

    it('should pull the users id from the group', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.removeUserFromGroup(
        ctx.subscription._id,
        ctx.otherUserId
      )
      const removeOperation = { $pull: { member_ids: ctx.otherUserId } }
      ctx.SubscriptionModel.updateOne
        .calledWith({ _id: ctx.subscription._id }, removeOperation)
        .should.equal(true)
    })

    it('should remove user enrollment if the group is managed', async function (ctx) {
      ctx.SubscriptionModel.findById.resolves({
        ...ctx.groupSubscription,
        managedUsersEnabled: true,
      })
      await ctx.SubscriptionUpdater.promises.removeUserFromGroup(
        ctx.groupSubscription._id,
        ctx.otherUserId
      )
      ctx.UserUpdater.promises.updateUser
        .calledWith(
          { _id: ctx.otherUserId },
          {
            $unset: {
              'enrollment.managedBy': 1,
              'enrollment.enrolledAt': 1,
            },
          }
        )
        .should.equal(true)
    })

    it('should send a group-subscription-left event', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.removeUserFromGroup(
        ctx.groupSubscription._id,
        ctx.otherUserId
      )
      sinon.assert.calledWith(
        ctx.AnalyticsManager.recordEventForUserInBackground,
        ctx.otherUserId,
        'group-subscription-left',
        {
          groupId: ctx.groupSubscription._id,
          subscriptionId: ctx.groupSubscription.recurlySubscription_id,
        }
      )
    })

    it('should set the group plan code user property when removing user from group', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.removeUserFromGroup(
        ctx.subscription._id,
        ctx.otherUserId
      )
      sinon.assert.calledWith(
        ctx.AnalyticsManager.setUserPropertyForUserInBackground,
        ctx.otherUserId,
        'group-subscription-plan-code',
        null
      )
    })

    it('should update the users features', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.removeUserFromGroup(
        ctx.subscription._id,
        ctx.otherUserId
      )
      ctx.FeaturesUpdater.promises.refreshFeatures
        .calledWith(ctx.otherUserId)
        .should.equal(true)
    })

    it('should add an audit log when a user leaves a group', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.removeUserFromGroup(
        ctx.subscription._id,
        ctx.otherUserId
      )
      sinon.assert.calledWith(
        ctx.UserAuditLogHandler.promises.addEntry,
        ctx.otherUserId,
        'leave-group-subscription',
        undefined,
        undefined,
        {
          subscriptionId: ctx.subscription._id,
        }
      )
    })
  })

  describe('removeUserFromAllGroups', function () {
    beforeEach(function (ctx) {
      ctx.SubscriptionLocator.promises.getMemberSubscriptions.resolves([
        {
          _id: 'fake-id-1',
        },
        {
          _id: 'fake-id-2',
        },
      ])
    })

    it('should set the group plan code user property when removing user from all groups', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.removeUserFromAllGroups(
        ctx.otherUserId
      )
      sinon.assert.calledWith(
        ctx.AnalyticsManager.setUserPropertyForUserInBackground,
        ctx.otherUserId,
        'group-subscription-plan-code',
        null
      )
    })

    it('should pull the users id from all groups', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.removeUserFromAllGroups(
        ctx.otherUserId
      )
      const filter = { _id: ['fake-id-1', 'fake-id-2'] }
      const removeOperation = { $pull: { member_ids: ctx.otherUserId } }
      sinon.assert.calledWith(
        ctx.SubscriptionModel.updateMany,
        filter,
        removeOperation
      )
    })

    it('should send a group-subscription-left event for each group', async function (ctx) {
      ctx.fakeSub1 = {
        _id: 'fake-id-1',
        groupPlan: true,
        recurlySubscription_id: 'fake-sub-1',
      }
      ctx.fakeSub2 = {
        _id: 'fake-id-2',
        groupPlan: true,
        recurlySubscription_id: 'fake-sub-2',
      }
      ctx.SubscriptionModel.findOne
        .withArgs(
          { _id: 'fake-id-1' },
          { recurlySubscription_id: 1, groupPlan: 1 }
        )
        .resolves(ctx.fakeSub1)
        .withArgs(
          { _id: 'fake-id-2' },
          { recurlySubscription_id: 1, groupPlan: 1 }
        )
        .resolves(ctx.fakeSub2)

      await ctx.SubscriptionUpdater.promises.removeUserFromAllGroups(
        ctx.otherUserId
      )
      sinon.assert.calledWith(
        ctx.AnalyticsManager.recordEventForUserInBackground,
        ctx.otherUserId,
        'group-subscription-left',
        {
          groupId: 'fake-id-1',
          subscriptionId: 'fake-sub-1',
        }
      )
      sinon.assert.calledWith(
        ctx.AnalyticsManager.recordEventForUserInBackground,
        ctx.otherUserId,
        'group-subscription-left',
        {
          groupId: 'fake-id-2',
          subscriptionId: 'fake-sub-2',
        }
      )
    })

    it('should add an audit log entry for each group the user leaves', async function (ctx) {
      await ctx.SubscriptionUpdater.promises.removeUserFromAllGroups(
        ctx.otherUserId
      )
      sinon.assert.calledWith(
        ctx.UserAuditLogHandler.promises.addEntry,
        ctx.otherUserId,
        'leave-group-subscription',
        undefined,
        undefined,
        {
          subscriptionId: 'fake-id-1',
        }
      )
      sinon.assert.calledWith(
        ctx.UserAuditLogHandler.promises.addEntry,
        ctx.otherUserId,
        'leave-group-subscription',
        undefined,
        undefined,
        {
          subscriptionId: 'fake-id-2',
        }
      )
    })
  })

  describe('deleteSubscription', function () {
    beforeEach(async function (ctx) {
      ctx.subscription = {
        _id: new ObjectId().toString(),
        mock: 'subscription',
        admin_id: new ObjectId(),
        member_ids: [new ObjectId(), new ObjectId(), new ObjectId()],
      }
      await ctx.SubscriptionUpdater.promises.deleteSubscription(
        ctx.subscription,
        {}
      )
    })

    it('should remove the subscription', function (ctx) {
      ctx.SubscriptionModel.deleteOne
        .calledWith({ _id: ctx.subscription._id })
        .should.equal(true)
    })

    it('should downgrade the admin_id', function (ctx) {
      expect(
        ctx.FeaturesUpdater.promises.scheduleRefreshFeatures
      ).to.have.been.calledWith(ctx.subscription.admin_id)
    })

    it('should downgrade all of the members', function (ctx) {
      for (const userId of ctx.subscription.member_ids) {
        expect(
          ctx.FeaturesUpdater.promises.scheduleRefreshFeatures
        ).to.have.been.calledWith(userId)
      }
    })
  })

  describe('scheduleRefreshFeatures', function () {
    it('should call upgrades feature for personal subscription from admin_id', async function (ctx) {
      ctx.subscription = {
        _id: new ObjectId().toString(),
        mock: 'subscription',
        admin_id: new ObjectId(),
      }

      await ctx.SubscriptionUpdater.promises.scheduleRefreshFeatures(
        ctx.subscription
      )

      expect(
        ctx.FeaturesUpdater.promises.scheduleRefreshFeatures
      ).to.have.been.calledOnceWith(ctx.subscription.admin_id)
    })

    it('should call upgrades feature for group subscription from admin_id and member_ids', async function (ctx) {
      ctx.subscription = {
        _id: new ObjectId().toString(),
        mock: 'subscription',
        admin_id: new ObjectId(),
        member_ids: [new ObjectId(), new ObjectId(), new ObjectId()],
      }
      await ctx.SubscriptionUpdater.promises.scheduleRefreshFeatures(
        ctx.subscription
      )

      expect(
        ctx.FeaturesUpdater.promises.scheduleRefreshFeatures.callCount
      ).to.equal(4)
    })
  })
  describe('setRestorePoint', function () {
    it('should set the restore point with the given plan code and add-ons', async function (ctx) {
      const subscriptionId = new ObjectId()
      const planCode = 'gold-plan'
      const addOns = [
        { addOnCode: 'addon-1', quantity: 2, unitAmountInCents: 500 },
        { addOnCode: 'addon-2', quantity: 1, unitAmountInCents: 1000 },
      ]
      const consumed = false

      await ctx.SubscriptionUpdater.promises.setRestorePoint(
        subscriptionId,
        planCode,
        addOns,
        consumed
      )

      sinon.assert.calledWith(
        ctx.SubscriptionModel.updateOne,
        { _id: subscriptionId },
        {
          $set: {
            'lastSuccesfulSubscription.planCode': planCode,
            'lastSuccesfulSubscription.addOns': addOns,
          },
        }
      )
    })

    it('should increment revertedDueToFailedPayment if consumed is true', async function (ctx) {
      const consumed = true
      const subscriptionId = new ObjectId()

      await ctx.SubscriptionUpdater.promises.setRestorePoint(
        subscriptionId,
        null,
        null,
        consumed
      )

      sinon.assert.calledWith(
        ctx.SubscriptionModel.updateOne,
        { _id: subscriptionId },
        {
          $set: {
            'lastSuccesfulSubscription.planCode': null,
            'lastSuccesfulSubscription.addOns': null,
          },
          $inc: { timesRevertedDueToFailedPayment: 1 },
        }
      )
    })
  })

  describe('setSubscriptionWasReverted', function () {
    it('should clear the restore point and mark the subscription as reverted', async function (ctx) {
      const subscriptionId = new ObjectId().toString()

      await ctx.SubscriptionUpdater.promises.setSubscriptionWasReverted(
        subscriptionId
      )

      ctx.SubscriptionModel.updateOne.should.have.been.calledWith(
        { _id: subscriptionId },
        {
          $set: {
            'lastSuccesfulSubscription.planCode': null,
            'lastSuccesfulSubscription.addOns': null,
          },
          $inc: { timesRevertedDueToFailedPayment: 1 },
        }
      )
    })
  })

  describe('voidRestorePoint', function () {
    it('should clear the restore point without marking the subscription as reverted', async function (ctx) {
      const subscriptionId = new ObjectId().toString()

      await ctx.SubscriptionUpdater.promises.voidRestorePoint(subscriptionId)

      sinon.assert.calledWith(
        ctx.SubscriptionModel.updateOne,
        { _id: subscriptionId },
        {
          $set: {
            'lastSuccesfulSubscription.planCode': null,
            'lastSuccesfulSubscription.addOns': null,
          },
        }
      )
    })
  })
})
