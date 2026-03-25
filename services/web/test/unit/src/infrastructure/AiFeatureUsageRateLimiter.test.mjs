import { expect, vi } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
const ObjectId = mongodb.ObjectId

vi.mock('../../../../../app/src/Features/Errors/Errors.js', () => {
  return vi.importActual('../../../../../app/src/Features/Errors/Errors.js')
})

const modulePath =
  '../../../../app/src/infrastructure/rate-limiters/AiFeatureUsageRateLimiter.mjs'

describe('AiFeatureUsageRateLimiter', function () {
  beforeEach(async function (ctx) {
    ctx.userId = new ObjectId().toString()

    ctx.UserFeatureUsageModel = {
      findOneAndUpdate: sinon.stub().returns({
        exec: sinon.stub().resolves({
          features: {
            aiFeatureUsage: {
              usage: 0,
              periodStart: new Date(),
            },
          },
        }),
      }),
      findOne: sinon.stub().returns({
        exec: sinon.stub().resolves({
          features: {
            aiFeatureUsage: {
              usage: 0,
              periodStart: new Date(),
            },
          },
        }),
      }),
    }

    ctx.user = {
      features: { aiUsageQuota: 'basic' },
      writefull: { isPremium: false },
    }
    ctx.userWithOLBundle = {
      features: { aiUsageQuota: 'unlimited' },
      writefull: { isPremium: false },
    }
    ctx.userWithOLBundleThroughWf = {
      features: { aiUsageQuota: 'basic' },
      writefull: { isPremium: true },
    }

    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(ctx.user),
      },
    }

    ctx.settings = {
      writefull: {
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

    ctx.SplitTestHandler = {
      promises: {
        featureFlagEnabledForUser: sinon.stub().resolves(true),
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('../../../../app/src/models/UserFeatureUsage', () => ({
      UserFeatureUsage: ctx.UserFeatureUsageModel,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter.mjs', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler.mjs',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    const module = await import(modulePath)
    ctx.AiFeatureUsageRateLimiter = module.default
  })

  describe('useFeature', function () {
    describe('with some remaining allowance left', function () {
      it('should suceed', async function (ctx) {
        const res = { set: () => null }
        await expect(
          ctx.AiFeatureUsageRateLimiter.useFeature(ctx.userId, res, 1)
        ).to.not.be.rejected
      })

      it('should succeed with cost=0', async function (ctx) {
        const res = { set: () => null }
        await expect(
          ctx.AiFeatureUsageRateLimiter.useFeature(ctx.userId, res, 0)
        ).to.not.be.rejected
      })

      it('should succeed with default cost when cost is omitted', async function (ctx) {
        const res = { set: () => null }
        await expect(ctx.AiFeatureUsageRateLimiter.useFeature(ctx.userId, res))
          .to.not.be.rejected
      })
    })

    describe('with 0 allowance left', function () {
      beforeEach(function (ctx) {
        ctx.UserFeatureUsageModel.findOneAndUpdate = sinon.stub().returns({
          exec: sinon.stub().resolves({
            features: {
              aiFeatureUsage: {
                usage: ctx.settings.quotaGrants.ai.unlimited + 1,
                periodStart: new Date(),
              },
            },
          }),
        })
      })

      it('should be rejected with TooManyRequestsError', async function (ctx) {
        const res = { set: () => null }
        await expect(
          ctx.AiFeatureUsageRateLimiter.useFeature(ctx.userId, res, 1)
        ).to.be.rejectedWith('aiFeatureUsage rate limit exceeded')
      })
    })
  })

  describe('getRemainingFeatureUses', function () {
    beforeEach(async function (ctx) {
      ctx.UserFeatureUsageModel.findOneAndUpdate = sinon.stub().returns({
        exec: sinon.stub().resolves({
          features: {
            aiFeatureUsage: {
              usage: 0,
              periodStart: new Date(),
            },
          },
        }),
      })
      ctx.UserGetter.promises.getUser = sinon.stub()
    })

    it('should give higher usage for OL assist bundle owners', async function (ctx) {
      ctx.UserGetter.promises.getUser = sinon
        .stub()
        .resolves(ctx.userWithOLBundle)
      const usages =
        await ctx.AiFeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
      await expect(usages.aiFeatureUsage.remainingUsage).to.equal(
        ctx.settings.quotaGrants.ai.unlimited
      )
    })

    it('should give higher usage for assist bundle owners who have the feature via Writefull', async function (ctx) {
      ctx.UserGetter.promises.getUser = sinon
        .stub()
        .resolves(ctx.userWithOLBundleThroughWf)
      const usages =
        await ctx.AiFeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
      await expect(usages.aiFeatureUsage.remainingUsage).to.equal(
        ctx.settings.quotaGrants.ai.unlimited
      )
    })

    it('should calculate remaining usages for free users', async function (ctx) {
      ctx.UserGetter.promises.getUser = sinon.stub().resolves(ctx.user)
      const usages =
        await ctx.AiFeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
      await expect(usages.aiFeatureUsage.remainingUsage).to.equal(
        ctx.settings.quotaGrants.ai.basic
      )
    })
  })

  describe('decrementFeatureUsage', function () {
    it('should call findOneAndUpdate to decrement usage', async function (ctx) {
      const res = { set: () => null }
      await ctx.AiFeatureUsageRateLimiter.decrementFeatureUsage(
        ctx.userId,
        res,
        1
      )
      expect(ctx.UserFeatureUsageModel.findOneAndUpdate).to.have.been.called
    })

    it('should accept a custom cost parameter', async function (ctx) {
      const res = { set: () => null }
      await expect(
        ctx.AiFeatureUsageRateLimiter.decrementFeatureUsage(ctx.userId, res, 3)
      ).to.not.be.rejected
    })

    it('should use default cost of 1 when cost is omitted', async function (ctx) {
      const res = { set: () => null }
      await expect(
        ctx.AiFeatureUsageRateLimiter.decrementFeatureUsage(ctx.userId, res)
      ).to.not.be.rejected
    })
  })
})
