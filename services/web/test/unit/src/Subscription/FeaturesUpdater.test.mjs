import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import { AI_ADD_ON_CODE } from '../../../../app/src/Features/Subscription/AiHelper.mjs'

const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/src/Features/Subscription/FeaturesUpdater'

describe('FeaturesUpdater', function () {
  beforeEach(async function (ctx) {
    ctx.renewalDate = new Date('2099-04-01T00:00:00Z')
    ctx.v1UserId = 12345
    ctx.user = {
      _id: new ObjectId(),
      features: {},
      overleaf: { id: ctx.v1UserId },
    }
    ctx.aiAddOn = { addOnCode: AI_ADD_ON_CODE, quantity: 1 }
    ctx.subscriptions = {
      individual: {
        planCode: 'individual-plan',
        groupPlan: false,
        recurlySubscription_id: 'sub-individual',
        recurlyStatus: { state: 'active' },
      },
      group1: { planCode: 'group-plan-1', groupPlan: true },
      group2: { planCode: 'group-plan-2', groupPlan: true },
      noDropbox: { planCode: 'no-dropbox' },
      individualPlusAiAddOn: {
        planCode: 'individual-plan',
        addOns: [ctx.aiAddOn],
      },
      groupPlusAiAddOn: {
        planCode: 'group-plan-1',
        groupPlan: true,
        addOns: [ctx.aiAddOn],
      },
    }

    ctx.UserFeaturesUpdater = {
      promises: {
        updateFeatures: sinon
          .stub()
          .resolves({ features: { some: 'features' }, featuresChanged: true }),
      },
    }

    ctx.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub(),
        getGroupSubscriptionsMemberOf: sinon.stub(),
      },
    }
    ctx.SubscriptionLocator.promises.getUsersSubscription
      .withArgs(ctx.user._id)
      .resolves(ctx.subscriptions.individual)
    ctx.SubscriptionLocator.promises.getGroupSubscriptionsMemberOf
      .withArgs(ctx.user._id)
      .resolves([ctx.subscriptions.group1, ctx.subscriptions.group2])

    ctx.Settings = {
      defaultFeatures: { default: 'features' },
      plans: [
        { planCode: 'individual-plan', features: { individual: 'features' } },
        { planCode: 'group-plan-1', features: { group1: 'features' } },
        { planCode: 'group-plan-2', features: { group2: 'features' } },
        { planCode: 'no-dropbox', features: { dropbox: false } },
      ],
      features: {
        all: {
          default: 'features',
          individual: 'features',
          group1: 'features',
          group2: 'features',
          institutions: 'features',
          grandfathered: 'features',
          bonus: 'features',
        },
      },
      writefull: {
        overleafApiUrl: 'https://www.writefull.com',
        quotaTierGranted: 'unlimited',
      },
      aiFeatures: {
        freeQuota: 'free',
        standardQuota: 'standard',
        basicQuota: 'basic',
        unlimitedQuota: 'unlimited',
      },
      quotaGrants: {
        ai: {
          free: 5,
          basic: 5,
          standard: 10,
          unlimited: 200,
        },
      },
    }

    ctx.ReferalFeatures = {
      promises: {
        getBonusFeatures: sinon.stub().resolves({ bonus: 'features' }),
      },
    }
    ctx.V1SubscriptionManager = {
      getGrandfatheredFeaturesForV1User: sinon.stub(),
    }
    ctx.V1SubscriptionManager.getGrandfatheredFeaturesForV1User
      .withArgs(ctx.v1UserId)
      .returns({ grandfathered: 'features' })

    ctx.InstitutionsFeatures = {
      promises: {
        getInstitutionsFeatures: sinon
          .stub()
          .resolves({ institutions: 'features' }),
      },
    }

    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null),
        getWritefullData: sinon.stub().resolves(null),
      },
    }
    ctx.UserGetter.promises.getUser.withArgs(ctx.user._id).resolves(ctx.user)
    ctx.UserGetter.promises.getUser
      .withArgs({ 'overleaf.id': ctx.v1UserId })
      .resolves(ctx.user)

    ctx.AnalyticsManager = {
      setUserPropertyForMongoUserInBackground: sinon.stub(),
    }
    ctx.Modules = {
      promises: { hooks: { fire: sinon.stub().resolves([]) } },
    }
    ctx.Modules.promises.hooks.fire
      .withArgs('getPaymentFromRecordPromise', ctx.subscriptions.individual)
      .resolves([
        {
          subscription: {
            state: 'active',
            periodEnd: ctx.renewalDate,
          },
        },
      ])
    ctx.SubscriptionViewModelBuilder = {
      promises: {
        getUsersSubscriptionDetails: sinon.stub().resolves({
          bestSubscription: { type: 'individual' },
          individualSubscription: ctx.subscriptions.individual,
          memberGroupSubscriptions: [],
          managedGroupSubscriptions: [],
        }),
      },
    }
    ctx.Queues = {
      getQueue: sinon.stub().returns({
        add: sinon.stub().resolves(),
      }),
    }

    ctx.SplitTestHandler = {
      promises: {
        featureFlagEnabledForMongoUser: sinon.stub().resolves(false),
      },
    }

    ctx.GroupPolicy = {
      find: sinon.stub().returns({ exec: sinon.stub().resolves([]) }),
    }

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

    vi.doMock('../../../../app/src/Features/Referal/ReferalFeatures', () => ({
      default: ctx.ReferalFeatures,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/V1SubscriptionManager',
      () => ({
        default: ctx.V1SubscriptionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsFeatures',
      () => ({
        default: ctx.InstitutionsFeatures,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionViewModelBuilder',
      () => ({
        default: ctx.SubscriptionViewModelBuilder,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Queues', () => ({
      default: ctx.Queues,
    }))

    vi.doMock('../../../../app/src/models/Subscription', () => ({}))

    vi.doMock('../../../../app/src/models/GroupPolicy', () => ({
      GroupPolicy: ctx.GroupPolicy,
    }))

    vi.doMock('@overleaf/fetch-utils', () => ({
      fetchNothing: sinon.stub().resolves(),
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    ctx.FeaturesUpdater = (await import(MODULE_PATH)).default
  })

  describe('computeFeatures', function () {
    describe('when userFeaturesDisabled is true for individual plan', function () {
      beforeEach(function (ctx) {
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user._id)
          .resolves({
            planCode: 'individual-plan',
            userFeaturesDisabled: true,
            groupPlan: false,
            addOns: [ctx.aiAddOn],
          })
      })

      it('removes all individual plan features', async function (ctx) {
        const features = await ctx.FeaturesUpdater.promises.computeFeatures(
          ctx.user._id
        )
        expect(features).to.deep.equal({ default: 'features' })
      })
    })

    describe('when userFeaturesDisabled is true for group plan', function () {
      beforeEach(function (ctx) {
        const groupSubscription = {
          planCode: 'group-plan-1',
          userFeaturesDisabled: true,
          groupPlan: true,
          addOns: [ctx.aiAddOn],
        }
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user._id)
          .resolves(groupSubscription)
        ctx.SubscriptionLocator.promises.getGroupSubscriptionsMemberOf
          .withArgs(ctx.user._id)
          .resolves([groupSubscription])
      })

      it('removes all group plan features', async function (ctx) {
        const features = await ctx.FeaturesUpdater.promises.computeFeatures(
          ctx.user._id
        )
        expect(features).to.deep.equal({ default: 'features' })
      })
    })
    beforeEach(function (ctx) {
      ctx.SubscriptionLocator.promises.getUsersSubscription
        .withArgs(ctx.user._id)
        .resolves(null)
      ctx.SubscriptionLocator.promises.getGroupSubscriptionsMemberOf
        .withArgs(ctx.user._id)
        .resolves([])
      ctx.ReferalFeatures.promises.getBonusFeatures.resolves({})
      ctx.V1SubscriptionManager.getGrandfatheredFeaturesForV1User
        .withArgs(ctx.v1UserId)
        .returns({})
      ctx.InstitutionsFeatures.promises.getInstitutionsFeatures.resolves({})
    })

    describe('individual subscriber', function () {
      beforeEach(function (ctx) {
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user._id)
          .resolves(ctx.subscriptions.individual)
      })

      it('returns the individual features', async function (ctx) {
        const features = await ctx.FeaturesUpdater.promises.computeFeatures(
          ctx.user._id
        )
        expect(features).to.deep.equal({
          default: 'features',
          individual: 'features',
        })
      })
    })

    describe('group admin', function () {
      beforeEach(function (ctx) {
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user._id)
          .resolves(ctx.subscriptions.group1)
      })

      it("doesn't return the group features", async function (ctx) {
        const features = await ctx.FeaturesUpdater.promises.computeFeatures(
          ctx.user._id
        )
        expect(features).to.deep.equal({
          default: 'features',
        })
      })
    })

    describe('group member', function () {
      beforeEach(function (ctx) {
        ctx.SubscriptionLocator.promises.getGroupSubscriptionsMemberOf
          .withArgs(ctx.user._id)
          .resolves([ctx.subscriptions.group1])
      })

      it('returns the group features', async function (ctx) {
        const features = await ctx.FeaturesUpdater.promises.computeFeatures(
          ctx.user._id
        )
        expect(features).to.deep.equal({
          default: 'features',
          group1: 'features',
        })
      })
    })

    describe('individual subscription + AI add-on', function () {
      beforeEach(function (ctx) {
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user._id)
          .resolves(ctx.subscriptions.individualPlusAiAddOn)
      })

      it('returns the individual features and the AI error assistant', async function (ctx) {
        const features = await ctx.FeaturesUpdater.promises.computeFeatures(
          ctx.user._id
        )
        expect(features).to.deep.equal({
          default: 'features',
          individual: 'features',
          aiErrorAssistant: true,
          aiUsageQuota: 'unlimited',
        })
      })
    })

    describe('group admin + AI add-on', function () {
      beforeEach(function (ctx) {
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user._id)
          .resolves(ctx.subscriptions.groupPlusAiAddOn)
      })

      it('returns the AI error assistant only', async function (ctx) {
        const features = await ctx.FeaturesUpdater.promises.computeFeatures(
          ctx.user._id
        )
        expect(features).to.deep.equal({
          default: 'features',
          aiErrorAssistant: true,
          aiUsageQuota: 'unlimited',
        })
      })
    })

    describe('group member + AI add-on', function () {
      beforeEach(function (ctx) {
        ctx.SubscriptionLocator.promises.getGroupSubscriptionsMemberOf
          .withArgs(ctx.user._id)
          .resolves([ctx.subscriptions.groupPlusAiAddOn])
      })

      it('returns the group features without the AI features', async function (ctx) {
        const features = await ctx.FeaturesUpdater.promises.computeFeatures(
          ctx.user._id
        )
        expect(features).to.deep.equal({
          default: 'features',
          group1: 'features',
        })
      })
    })
  })

  describe('refreshFeatures', function () {
    it('should return features and featuresChanged', async function (ctx) {
      const { features, featuresChanged } =
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      expect(features).to.exist
      expect(featuresChanged).to.exist
    })

    describe('normally', function () {
      beforeEach(async function (ctx) {
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      })

      it('should update the user with the merged features', function (ctx) {
        expect(
          ctx.UserFeaturesUpdater.promises.updateFeatures
        ).to.have.been.calledWith(ctx.user._id, ctx.Settings.features.all)
      })

      it('should send the corresponding feature set user property', function (ctx) {
        expect(
          ctx.AnalyticsManager.setUserPropertyForMongoUserInBackground
        ).to.have.been.calledWith(ctx.user, 'feature-set', 'all')
      })

      it('should sync subscription properties to customer.io', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({
            plan_type: 'individual',
            display_plan_type: 'individual',
            ai_plan: 'none',
            next_renewal_date: Math.floor(ctx.renewalDate.getTime() / 1000),
            expiry_date: '',
            group: false,
            commons: false,
            individual_subscription: true,
            payment_provider: 'recurly',
            features: sinon.match.object,
          })
        )
      })

      it('should not set trial_end_date when no trial is active', function (ctx) {
        const call = ctx.Modules.promises.hooks.fire
          .getCalls()
          .find(c => c.args[0] === 'setUserProperties')
        expect(call).to.exist
        expect(call.args[2]).to.not.have.property('trial_end_date')
      })
    })

    describe('when the individual subscription is on a trial', function () {
      beforeEach(async function (ctx) {
        ctx.trialEndsAt = new Date('2099-05-01T00:00:00Z')
        const trialingSubscription = {
          ...ctx.subscriptions.individual,
          recurlyStatus: {
            state: 'active',
            trialEndsAt: ctx.trialEndsAt,
          },
        }
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: { type: 'individual' },
            individualSubscription: trialingSubscription,
            memberGroupSubscriptions: [],
            managedGroupSubscriptions: [],
          }
        )
        ctx.Modules.promises.hooks.fire
          .withArgs('getPaymentFromRecordPromise', trialingSubscription)
          .resolves([
            {
              subscription: {
                state: 'active',
                periodEnd: ctx.renewalDate,
              },
            },
          ])
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      })

      it('should sync trial_end_date to customer.io', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({
            trial_end_date: Math.floor(ctx.trialEndsAt.getTime() / 1000),
          })
        )
      })
    })

    describe('when the individual subscription uses stripe', function () {
      beforeEach(async function (ctx) {
        const stripeSubscription = {
          ...ctx.subscriptions.individual,
          paymentProvider: { service: 'stripe-us', state: 'active' },
        }
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: { type: 'individual' },
            individualSubscription: stripeSubscription,
            memberGroupSubscriptions: [],
            managedGroupSubscriptions: [],
          }
        )
        ctx.Modules.promises.hooks.fire
          .withArgs('getPaymentFromRecordPromise', stripeSubscription)
          .resolves([
            {
              subscription: {
                state: 'active',
                periodEnd: ctx.renewalDate,
              },
            },
          ])
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      })

      it('should report stripe as the payment_provider', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({
            payment_provider: 'stripe',
            individual_subscription: true,
          })
        )
      })
    })

    describe('when the user has a commons institution licence', function () {
      beforeEach(async function (ctx) {
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: { type: 'commons' },
            individualSubscription: null,
            memberGroupSubscriptions: [],
            managedGroupSubscriptions: [],
            currentInstitutionsWithLicence: [{ id: 1, name: 'Uni' }],
          }
        )
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      })

      it('should sync commons=true to customer.io', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({
            commons: true,
            group: false,
            individual_subscription: false,
          })
        )
      })
    })

    describe('when the user has commons and an individual AI add-on', function () {
      beforeEach(async function (ctx) {
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: {
              type: 'individual',
              plan: { planCode: 'individual-plan' },
            },
            individualSubscription: ctx.subscriptions.individual,
            memberGroupSubscriptions: [],
            managedGroupSubscriptions: [],
            currentInstitutionsWithLicence: [{ id: 1, name: 'Uni' }],
          }
        )
        ctx.Modules.promises.hooks.fire
          .withArgs('getPaymentFromRecordPromise', ctx.subscriptions.individual)
          .resolves([
            {
              subscription: {
                state: 'active',
                periodEnd: ctx.renewalDate,
                addOns: [{ code: AI_ADD_ON_CODE }],
              },
            },
          ])
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      })

      it('should set commons, individual_subscription, and ai-assist-add-on together', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({
            commons: true,
            individual_subscription: true,
            group: false,
            ai_plan: 'ai-assist-add-on',
          })
        )
      })
    })

    describe('when the user has no subscription', function () {
      beforeEach(async function (ctx) {
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: null,
            individualSubscription: null,
            memberGroupSubscriptions: [],
            managedGroupSubscriptions: [],
          }
        )
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      })

      it('should sync false subscription flags and no payment_provider', function (ctx) {
        const call = ctx.Modules.promises.hooks.fire
          .getCalls()
          .find(c => c.args[0] === 'setUserProperties')
        expect(call).to.exist
        expect(call.args[2]).to.include({
          group: false,
          commons: false,
          individual_subscription: false,
        })
        expect(call.args[2]).to.not.have.property('payment_provider')
        expect(call.args[2]).to.not.have.property('trial_end_date')
      })
    })

    describe('when the individual subscription has a pending cancellation', function () {
      beforeEach(async function (ctx) {
        const pendingCancellationSubscription = {
          ...ctx.subscriptions.individual,
          recurlyStatus: { state: 'canceled' },
        }
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: { type: 'individual' },
            individualSubscription: pendingCancellationSubscription,
            memberGroupSubscriptions: [],
            managedGroupSubscriptions: [],
          }
        )
        ctx.Modules.promises.hooks.fire
          .withArgs(
            'getPaymentFromRecordPromise',
            pendingCancellationSubscription
          )
          .resolves([
            {
              subscription: {
                state: 'canceled',
                periodEnd: ctx.renewalDate,
              },
            },
          ])

        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      })

      it('should sync expiry_date and blank next_renewal_date in customer.io', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({
            plan_type: 'individual',
            display_plan_type: 'individual',
            ai_plan: 'none',
            next_renewal_date: '',
            expiry_date: Math.floor(ctx.renewalDate.getTime() / 1000),
            features: sinon.match.object,
          })
        )
      })
    })

    describe('when the user is in a group subscription', function () {
      beforeEach(async function (ctx) {
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: {
              type: 'group',
              plan: {
                planCode: 'group-plan-1',
                groupPlan: true,
                membersLimit: 5,
              },
              subscription: {
                teamName: 'Team Alpha',
              },
            },
            memberGroupSubscriptions: [
              {
                planCode: 'group-plan-1',
                teamName: 'Team Alpha',
                membersLimit: 8,
              },
            ],
            managedGroupSubscriptions: [],
            individualSubscription: null,
          }
        )
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      })

      it('should sync groupSize to customer.io', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({
            plan_type: 'group-standard',
            display_plan_type: 'Group Standard',
            plan_term_label: 'monthly',
            ai_plan: 'none',
            group_ai_enabled: true,
            group_size: 8,
            next_renewal_date: '',
            expiry_date: '',
            group: true,
            commons: false,
            individual_subscription: false,
            payment_provider: 'recurly',
            features: sinon.match.object,
            overleaf_id: ctx.user._id,
          })
        )
      })
    })

    describe('when the group subscription has a policy that blocks AI', function () {
      beforeEach(async function (ctx) {
        const policyId = new ObjectId()
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: {
              type: 'group',
              plan: {
                planCode: 'group-plan-1',
                groupPlan: true,
                membersLimit: 5,
              },
              subscription: { teamName: 'Team Alpha' },
            },
            memberGroupSubscriptions: [
              {
                planCode: 'group-plan-1',
                teamName: 'Team Alpha',
                membersLimit: 8,
                groupPolicy: policyId,
              },
            ],
            managedGroupSubscriptions: [],
            individualSubscription: null,
          }
        )
        ctx.GroupPolicy.find.returns({
          exec: sinon
            .stub()
            .resolves([{ _id: policyId, userCannotUseAIFeatures: true }]),
        })
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      })

      it('should set group_ai_enabled to false', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({ group_ai_enabled: false })
        )
      })
    })

    describe('when the user is in a stripe group subscription', function () {
      beforeEach(async function (ctx) {
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: {
              type: 'group',
              plan: {
                planCode: 'group-plan-1',
                groupPlan: true,
                membersLimit: 5,
              },
              subscription: {
                teamName: 'Team Alpha',
              },
            },
            memberGroupSubscriptions: [
              {
                planCode: 'group-plan-1',
                teamName: 'Team Alpha',
                membersLimit: 8,
                paymentProvider: { service: 'stripe-uk' },
              },
            ],
            managedGroupSubscriptions: [],
            individualSubscription: null,
          }
        )
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      })

      it('should derive payment_provider from the group subscription', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({
            payment_provider: 'stripe',
            group: true,
            individual_subscription: false,
          })
        )
      })
    })

    describe('group_role property', function () {
      it("should set group_role to '' when the user is not in any group", async function (ctx) {
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: { type: 'free' },
            individualSubscription: null,
            memberGroupSubscriptions: [],
            managedGroupSubscriptions: [],
          }
        )
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({ group_role: '' })
        )
      })

      it("should set group_role to 'member' when the user only belongs to a group as a member", async function (ctx) {
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: { type: 'free' },
            individualSubscription: null,
            memberGroupSubscriptions: [{ _id: new ObjectId() }],
            managedGroupSubscriptions: [],
          }
        )
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({ group_role: 'member' })
        )
      })

      it("should set group_role to 'manager' when the user manages a group they don't own", async function (ctx) {
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: { type: 'free' },
            individualSubscription: null,
            memberGroupSubscriptions: [],
            managedGroupSubscriptions: [{ admin_id: { _id: new ObjectId() } }],
          }
        )
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({ group_role: 'manager' })
        )
      })

      it("should set group_role to 'admin' when the user owns a group", async function (ctx) {
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: { type: 'free' },
            individualSubscription: null,
            memberGroupSubscriptions: [],
            managedGroupSubscriptions: [{ admin_id: { _id: ctx.user._id } }],
          }
        )
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'setUserProperties',
          ctx.user._id,
          sinon.match({ group_role: 'admin' })
        )
      })
    })

    describe('with a non-standard feature set', async function () {
      beforeEach(async function (ctx) {
        ctx.SubscriptionLocator.promises.getGroupSubscriptionsMemberOf
          .withArgs(ctx.user._id)
          .resolves(null)
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      })

      it('should send mixed feature set user property', function (ctx) {
        sinon.assert.calledWith(
          ctx.AnalyticsManager.setUserPropertyForMongoUserInBackground,
          ctx.user,
          'feature-set',
          'mixed'
        )
      })
    })

    describe('when losing dropbox feature', async function () {
      beforeEach(async function (ctx) {
        ctx.user.features = { dropbox: true }
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user._id)
          .resolves(ctx.subscriptions.noDropbox)
        await ctx.FeaturesUpdater.promises.refreshFeatures(ctx.user._id, 'test')
      })

      it('should fire module hook to unlink dropbox', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'removeDropbox',
          ctx.user._id,
          'test'
        )
      })
    })
  })

  describe('doSyncFromV1', function () {
    describe('when all goes well', function () {
      beforeEach(async function (ctx) {
        await ctx.FeaturesUpdater.promises.doSyncFromV1(ctx.v1UserId)
      })

      it('should update the user with the merged features', function (ctx) {
        expect(
          ctx.UserFeaturesUpdater.promises.updateFeatures
        ).to.have.been.calledWith(ctx.user._id, ctx.Settings.features.all)
      })
    })

    describe('when getUser produces an error', function () {
      beforeEach(function (ctx) {
        ctx.UserGetter.promises.getUser.rejects(new Error('woops'))
      })

      it('should propagate the error', async function (ctx) {
        const someId = 9090
        await expect(ctx.FeaturesUpdater.promises.doSyncFromV1(someId)).to.be
          .rejected
        expect(ctx.UserFeaturesUpdater.promises.updateFeatures).not.to.have.been
          .called
      })
    })

    describe('when getUser does not find a user', function () {
      beforeEach(async function (ctx) {
        const someOtherId = 987
        await ctx.FeaturesUpdater.promises.doSyncFromV1(someOtherId)
      })

      it('should not update the user', function (ctx) {
        expect(ctx.UserFeaturesUpdater.promises.updateFeatures).not.to.have.been
          .called
      })
    })
  })
})
