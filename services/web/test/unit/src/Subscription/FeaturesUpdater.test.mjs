import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import { AI_ADD_ON_CODE } from '../../../../app/src/Features/Subscription/AiHelper.mjs'

const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/src/Features/Subscription/FeaturesUpdater'

describe('FeaturesUpdater', function () {
  beforeEach(async function (ctx) {
    ctx.v1UserId = 12345
    ctx.user = {
      _id: new ObjectId(),
      features: {},
      overleaf: { id: ctx.v1UserId },
    }
    ctx.aiAddOn = { addOnCode: AI_ADD_ON_CODE, quantity: 1 }
    ctx.subscriptions = {
      individual: { planCode: 'individual-plan' },
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
      },
    }
    ctx.UserGetter.promises.getUser.withArgs(ctx.user._id).resolves(ctx.user)
    ctx.UserGetter.promises.getUser
      .withArgs({ 'overleaf.id': ctx.v1UserId })
      .resolves(ctx.user)

    ctx.AnalyticsManager = {
      setUserPropertyForUserInBackground: sinon.stub(),
    }
    ctx.Modules = {
      promises: { hooks: { fire: sinon.stub().resolves() } },
    }
    ctx.Queues = {
      getQueue: sinon.stub().returns({
        add: sinon.stub().resolves(),
      }),
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

    vi.doMock('../../../../app/src/infrastructure/Queues', () => ({
      default: ctx.Queues,
    }))

    vi.doMock('../../../../app/src/models/Subscription', () => ({}))

    vi.doMock('@overleaf/fetch-utils', () => ({
      fetchNothing: sinon.stub().resolves(),
    }))

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
          ctx.AnalyticsManager.setUserPropertyForUserInBackground
        ).to.have.been.calledWith(ctx.user._id, 'feature-set', 'all')
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
          ctx.AnalyticsManager.setUserPropertyForUserInBackground,
          ctx.user._id,
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
