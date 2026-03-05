import { beforeAll, beforeEach, describe, it, vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import {
  cleanupTestDatabase,
  db,
  waitForDb,
} from '../../../../app/src/infrastructure/mongodb.mjs'
import { UserFeatureUsage } from '../../../../app/src/models/UserFeatureUsage.mjs'

const { ObjectId } = mongodb

const MODULE_PATH =
  '../../../../app/src/infrastructure/rate-limiters/WorkbenchRateLimiter'

describe('WorkbenchRateLimiter', function () {
  beforeAll(async function () {
    await waitForDb()
  })
  beforeAll(cleanupTestDatabase)

  beforeEach(async function (ctx) {
    ctx.alphaUserId = new ObjectId()
    ctx.alphaUser = {
      _id: ctx.alphaUserId,
      alphaProgram: true,
      features: {
        aiUsageQuota: 'unlimited',
      },
    }
    ctx.userWithoutAiAddOnId = new ObjectId()
    ctx.userWithAiAddOn = {
      _id: ctx.userWithoutAiAddOnId,
      features: {
        aiUsageQuota: 'unlimited',
      },
      alphaProgram: false,
    }
    ctx.otherUserId = new ObjectId()
    ctx.otherUser = {
      _id: ctx.otherUserId,
      features: {
        aiUsageQuota: 'basic',
      },
      alphaProgram: false,
    }
    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub(),
      },
    }
    ctx.UserGetter.promises.getUser
      .withArgs(ctx.alphaUserId)
      .resolves(ctx.alphaUser)
    ctx.UserGetter.promises.getUser
      .withArgs(ctx.userWithoutAiAddOnId)
      .resolves(ctx.userWithAiAddOn)
    ctx.UserGetter.promises.getUser
      .withArgs(ctx.otherUserId)
      .resolves(ctx.otherUser)

    ctx.SplitTestHandler = {
      promises: {
        getAssignmentForUser: sinon.stub(),
        featureFlagEnabledForUser: sinon.stub().resolves(true),
      },
    }
    ctx.SplitTestHandler.promises.getAssignmentForUser
      .withArgs(ctx.alphaUserId, 'ai-workbench-release')
      .resolves({ variant: 'enabled' })

    vi.doMock('../../../../app/src/infrastructure/mongodb', () => ({
      ObjectId,
      db,
      waitForDb,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: {
          recordEventForUser: sinon.stub(),
        },
      })
    )

    ctx.WorkbenchRateLimiter = (await import(MODULE_PATH)).default
  })

  describe('calculateTokenUsage', function () {
    it('treats input tokens as 1', function (ctx) {
      expect(
        ctx.WorkbenchRateLimiter.calculateTokenUsage({
          inputTokenDetails: {
            noCacheTokens: 100,
            cacheReadTokens: 0,
          },
          outputTokens: 0,
        })
      ).to.equal(100)
    })

    it('treats output tokens as 10', function (ctx) {
      expect(
        ctx.WorkbenchRateLimiter.calculateTokenUsage({
          inputTokenDetails: {
            noCacheTokens: 0,
            cacheReadTokens: 0,
          },
          outputTokens: 100,
        })
      ).to.equal(1000)
    })

    it('treats output tokens correctly', function (ctx) {
      expect(
        ctx.WorkbenchRateLimiter.calculateTokenUsage({
          inputTokenDetails: {
            noCacheTokens: 0,
            cacheReadTokens: 0,
          },
          outputTokens: 100,
        })
      ).to.equal(1000)
    })

    it('rounds up to nearest integer', function (ctx) {
      expect(
        ctx.WorkbenchRateLimiter.calculateTokenUsage({
          inputTokenDetails: {
            noCacheTokens: 1,
            cacheReadTokens: 0,
          },
          outputTokens: 0,
        })
      ).to.equal(1)
    })

    it('sums mixed tokens', function (ctx) {
      expect(
        ctx.WorkbenchRateLimiter.calculateTokenUsage({
          inputTokenDetails: {
            noCacheTokens: 10,
            cacheReadTokens: 10,
          },
          outputTokens: 10,
        })
      ).to.equal(10 + 100 + 0 + 1)
    })
  })

  describe('checkUsage', function () {
    describe('with no data', function () {
      beforeEach(async function (ctx) {
        await UserFeatureUsage.deleteMany({}).exec()
        ctx.res = {
          set: sinon.stub(),
          headersSent: false,
        }
      })

      it('should not throw', async function (ctx) {
        await expect(
          ctx.WorkbenchRateLimiter.checkUsage(ctx.alphaUserId, ctx.res)
        ).to.eventually.be.fulfilled
      })

      it('sets rate limit headers', async function (ctx) {
        await ctx.WorkbenchRateLimiter.checkUsage(ctx.alphaUserId, ctx.res)
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Limit',
          '8000000'
        )
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Remaining',
          '8000000'
        )
        // We can't mock the mongo date, so just check that something was set
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Reset',
          matchRateLimit(24 * 60 * 60)
        )
      })
    })

    describe('with existing usage', function () {
      beforeEach(async function (ctx) {
        await UserFeatureUsage.deleteMany({}).exec()
        ctx.res = {
          set: sinon.stub(),
          headersSent: false,
        }
        const usageRecord = new UserFeatureUsage({
          _id: ctx.alphaUserId,
          features: {
            aiWorkbench: {
              usage: 2000000,
              periodStart: new Date(new Date().getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
            },
          },
        })
        await usageRecord.save()
      })

      it('should not throw if under limit', async function (ctx) {
        await expect(
          ctx.WorkbenchRateLimiter.checkUsage(ctx.alphaUserId, ctx.res)
        ).to.eventually.be.fulfilled
      })

      it('sets rate limit headers', async function (ctx) {
        await ctx.WorkbenchRateLimiter.checkUsage(ctx.alphaUserId, ctx.res)
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Limit',
          '8000000'
        )
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Remaining',
          '6000000'
        )
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Reset',
          matchRateLimit(23 * 60 * 60)
        )
      })

      it('throws if over limit', async function (ctx) {
        const usageRecord = await UserFeatureUsage.findById(
          ctx.alphaUserId
        ).exec()
        usageRecord.features.aiWorkbench.usage = 9000000
        await usageRecord.save()

        await expect(
          ctx.WorkbenchRateLimiter.checkUsage(ctx.alphaUserId, ctx.res)
        ).to.eventually.be.rejectedWith(/rate limit exceeded/i)
      })
    })

    describe('with an expired old usage period', function () {
      beforeEach(async function (ctx) {
        await UserFeatureUsage.deleteMany({}).exec()
        ctx.res = {
          set: sinon.stub(),
          headersSent: false,
        }
        const usageRecord = new UserFeatureUsage({
          _id: ctx.alphaUserId,
          features: {
            aiWorkbench: {
              usage: 2000000,
              periodStart: new Date(new Date().getTime() - 25 * 60 * 60 * 1000), // 25 hours ago
            },
          },
        })
        await usageRecord.save()
      })

      it('should not throw', async function (ctx) {
        await expect(
          ctx.WorkbenchRateLimiter.checkUsage(ctx.alphaUserId, ctx.res)
        ).to.eventually.be.fulfilled
      })

      it('sets rate limit headers', async function (ctx) {
        await ctx.WorkbenchRateLimiter.checkUsage(ctx.alphaUserId, ctx.res)
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Limit',
          '8000000'
        )
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Remaining',
          '8000000'
        )
        // A new period
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Reset',
          matchRateLimit(24 * 60 * 60)
        )
      })
    })
  })

  describe('recordUsage', function () {
    beforeEach(async function (ctx) {
      await UserFeatureUsage.deleteMany({}).exec()
      ctx.res = {
        set: sinon.stub(),
        headersSent: false,
      }
    })

    describe('without existing usage', function () {
      it('creates new usage record if none exists', async function (ctx) {
        await ctx.WorkbenchRateLimiter.recordUsage(
          ctx.alphaUserId,
          ctx.res,
          1500000
        )
        const usageRecord = await UserFeatureUsage.findById(
          ctx.alphaUserId
        ).exec()
        expect(usageRecord).to.exist
        expect(usageRecord.features.aiWorkbench.usage).to.equal(1500000)
        expect(
          usageRecord.features.aiWorkbench.periodStart.getTime()
        ).to.approximately(new Date().getTime(), 60_000)
      })
    })

    describe('with existing usage', function () {
      beforeEach(async function (ctx) {
        await UserFeatureUsage.deleteMany({}).exec()
        const usageRecord = new UserFeatureUsage({
          _id: ctx.alphaUserId,
          features: {
            aiWorkbench: {
              usage: 2000000,
              periodStart: new Date(new Date().getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
            },
          },
        })
        await usageRecord.save()
        await ctx.WorkbenchRateLimiter.recordUsage(
          ctx.alphaUserId,
          ctx.res,
          1000000
        )
      })

      it('updates existing usage record', async function (ctx) {
        const updatedRecord = await UserFeatureUsage.findById(
          ctx.alphaUserId
        ).exec()
        expect(updatedRecord.features.aiWorkbench.usage).to.equal(3000000)
      })
      it('sets rate limit headers', async function (ctx) {
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Limit',
          '8000000'
        )
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Remaining',
          '5000000'
        )
        // Keeps the original period start time
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Reset',
          matchRateLimit(23 * 60 * 60)
        )
      })
    })

    describe('with an expired old usage period', function () {
      beforeEach(async function (ctx) {
        await UserFeatureUsage.deleteMany({}).exec()
        const usageRecord = new UserFeatureUsage({
          _id: ctx.alphaUserId,
          features: {
            aiWorkbench: {
              usage: 2000000,
              periodStart: new Date(new Date().getTime() - 25 * 60 * 60 * 1000), // 25 hours ago
            },
          },
        })
        await usageRecord.save()
        await ctx.WorkbenchRateLimiter.recordUsage(
          ctx.alphaUserId,
          ctx.res,
          1000000
        )
      })

      it('resets usage and period start', async function (ctx) {
        const updatedRecord = await UserFeatureUsage.findById(
          ctx.alphaUserId
        ).exec()
        expect(updatedRecord.features.aiWorkbench.usage).to.equal(1000000)
      })

      it('sets rate limit headers', async function (ctx) {
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Limit',
          '8000000'
        )
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Remaining',
          '7000000'
        )
        // New period start time
        expect(ctx.res.set).to.have.been.calledWith(
          'Token-RateLimit-Reset',
          matchRateLimit(24 * 60 * 60)
        )
      })
    })
  })
})

function matchRateLimit(expectedValue, delta = 60) {
  return sinon.match(function (value) {
    const number = parseInt(value, 10)
    return Math.abs(number - expectedValue) <= delta
  }, `${expectedValue} ± ${delta}`)
}
