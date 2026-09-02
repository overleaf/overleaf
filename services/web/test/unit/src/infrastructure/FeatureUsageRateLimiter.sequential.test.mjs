import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import {
  connectionPromise,
  cleanupTestDatabase,
} from '../../../../app/src/infrastructure/mongodb.mjs'
import { UserFeatureUsage } from '../../../../app/src/models/UserFeatureUsage.mjs'

const { TooManyRequestsError } = Errors
const ObjectId = mongodb.ObjectId

vi.mock('../../../../app/src/Features/Errors/Errors.js', () => {
  return vi.importActual('../../../../app/src/Features/Errors/Errors.js')
})

// NOTE: Needs to be an allowed field in UserFeatureUsageSchema
const MOCKED_FEATURE_NAME = 'aiWorkbench'

const modulePath =
  '../../../../app/src/infrastructure/rate-limiters/FeatureUsageRateLimiter'

describe('FeatureUsageRateLimiter', function () {
  beforeAll(async function () {
    await connectionPromise
  })
  beforeEach(cleanupTestDatabase)

  beforeEach(async function (ctx) {
    ctx.userId = new ObjectId().toString()

    const FeatureUsageRateLimiterClass = (await import(modulePath)).default
    ctx._getAllowanceStub = sinon.stub()

    class FeatureUsageTestRateLimiter extends FeatureUsageRateLimiterClass {
      constructor() {
        super(MOCKED_FEATURE_NAME)
      }

      _getAllowance = ctx._getAllowanceStub
    }

    ctx.FeatureUsageRateLimiter = new FeatureUsageTestRateLimiter()
  })

  describe('useFeature', function () {
    beforeEach(function (ctx) {
      ctx._getAllowanceStub.resolves(100)
    })

    describe('with no usage', function (ctx) {
      it('should succeed', async function (ctx) {
        const res = { set: () => null }
        await expect(ctx.FeatureUsageRateLimiter.useFeature(ctx.userId, res, 1))
          .to.not.be.rejected
      })
    })

    describe('with some remaining allowance left', function () {
      beforeEach(async function (ctx) {
        await UserFeatureUsage.create({
          _id: ctx.userId,
          features: {
            [MOCKED_FEATURE_NAME]: { usage: 50, periodStart: new Date() },
          },
        })
      })

      it('should suceed', async function (ctx) {
        const res = { set: () => null }
        await expect(ctx.FeatureUsageRateLimiter.useFeature(ctx.userId, res, 1))
          .to.not.be.rejected
      })
    })

    describe('with 0 allowance left', function () {
      beforeEach(async function (ctx) {
        await UserFeatureUsage.create({
          _id: ctx.userId,
          features: {
            [MOCKED_FEATURE_NAME]: { usage: 101, periodStart: new Date() },
          },
        })
      })

      it('should be rejected with TooManyRequestsError', async function (ctx) {
        const res = { set: () => null }
        await expect(
          ctx.FeatureUsageRateLimiter.useFeature(ctx.userId, res, 1)
        ).to.be.rejectedWith(TooManyRequestsError)
      })
    })

    describe('with cost=0', function () {
      beforeEach(async function (ctx) {
        await UserFeatureUsage.create({
          _id: ctx.userId,
          features: {
            [MOCKED_FEATURE_NAME]: { usage: 50, periodStart: new Date() },
          },
        })
      })

      it('should not increment usage', async function (ctx) {
        const res = { set: () => null }
        await ctx.FeatureUsageRateLimiter.useFeature(ctx.userId, res, 0)
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(50)
      })

      it('should still be rejected when over the limit', async function (ctx) {
        await UserFeatureUsage.findOneAndUpdate(
          { _id: ctx.userId },
          { $set: { [`features.${MOCKED_FEATURE_NAME}.usage`]: 101 } }
        )
        const res = { set: () => null }
        await expect(
          ctx.FeatureUsageRateLimiter.useFeature(ctx.userId, res, 0)
        ).to.be.rejectedWith(TooManyRequestsError)
      })
    })

    describe('with cost greater than 1', function () {
      it('should increment usage by the specified cost', async function (ctx) {
        const res = { set: () => null }
        await ctx.FeatureUsageRateLimiter.useFeature(ctx.userId, res, 5)
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(95)
      })
    })

    describe('with default cost parameter', function () {
      it('should increment usage by 1 when cost is omitted', async function (ctx) {
        const res = { set: () => null }
        await ctx.FeatureUsageRateLimiter.useFeature(ctx.userId, res)
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(99)
      })
    })
  })

  describe('_recordFirstLimitReach', function () {
    beforeEach(async function (ctx) {
      ctx.periodStart = new Date()
      await UserFeatureUsage.create({
        _id: ctx.userId,
        features: {
          [MOCKED_FEATURE_NAME]: { usage: 101, periodStart: ctx.periodStart },
        },
      })
    })

    it('returns true for the first reach of the period', async function (ctx) {
      expect(
        await ctx.FeatureUsageRateLimiter._recordFirstLimitReach(
          ctx.userId,
          ctx.periodStart
        )
      ).to.be.true
    })

    it('returns false for later reaches in the same period', async function (ctx) {
      await ctx.FeatureUsageRateLimiter._recordFirstLimitReach(
        ctx.userId,
        ctx.periodStart
      )

      expect(
        await ctx.FeatureUsageRateLimiter._recordFirstLimitReach(
          ctx.userId,
          ctx.periodStart
        )
      ).to.be.false
      expect(
        await ctx.FeatureUsageRateLimiter._recordFirstLimitReach(
          ctx.userId,
          ctx.periodStart
        )
      ).to.be.false
    })

    it('returns true again once the period resets to a new periodStart', async function (ctx) {
      await ctx.FeatureUsageRateLimiter._recordFirstLimitReach(
        ctx.userId,
        ctx.periodStart
      )

      const newPeriodStart = new Date(ctx.periodStart.getTime() + 1000)
      expect(
        await ctx.FeatureUsageRateLimiter._recordFirstLimitReach(
          ctx.userId,
          newPeriodStart
        )
      ).to.be.true
    })
  })

  describe('getRemainingFeatureUses', function () {
    beforeEach(function (ctx) {
      ctx._getAllowanceStub.resolves(100)
    })

    describe('with no usage', function () {
      it('should return the whole allowance', async function (ctx) {
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(100)
      })
    })

    describe('with some usage', function () {
      beforeEach(async function (ctx) {
        await UserFeatureUsage.create({
          _id: ctx.userId,
          features: {
            [MOCKED_FEATURE_NAME]: { usage: 30, periodStart: new Date() },
          },
        })
      })

      it('should return the correct remaining allowance', async function (ctx) {
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(70)
        expect(
          new Date(usages[MOCKED_FEATURE_NAME].resetDate).getTime()
        ).to.be.greaterThan(Date.now())
      })
    })

    describe('at the period boundary', function () {
      const PERIOD_MS = 24 * 60 * 60 * 1000

      it('just inside the period returns usesLeft and future resetDate', async function (ctx) {
        // whole second: `resetDate` round-trips through Date.toString()
        const periodStart = new Date(
          Math.floor((Date.now() - PERIOD_MS + 60 * 1000) / 1000) * 1000
        )
        await UserFeatureUsage.create({
          _id: ctx.userId,
          features: {
            [MOCKED_FEATURE_NAME]: { usage: 40, periodStart },
          },
        })
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(60)
        expect(
          new Date(usages[MOCKED_FEATURE_NAME].resetDate).getTime()
        ).to.equal(periodStart.getTime() + PERIOD_MS)
      })

      it('once the period has lapsed reports the full allowance and a fresh resetDate', async function (ctx) {
        // whole second: `resetDate` round-trips through Date.toString()
        const periodStart = new Date(
          Math.floor((Date.now() - PERIOD_MS - 60 * 1000) / 1000) * 1000
        )
        await UserFeatureUsage.create({
          _id: ctx.userId,
          features: {
            [MOCKED_FEATURE_NAME]: { usage: 40, periodStart },
          },
        })
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(100)
        expect(
          new Date(usages[MOCKED_FEATURE_NAME].resetDate).getTime()
        ).to.be.approximately(Date.now() + PERIOD_MS, 5000)
      })
    })

    describe('when usage exceeds allowance', function () {
      beforeEach(async function (ctx) {
        await UserFeatureUsage.create({
          _id: ctx.userId,
          features: {
            [MOCKED_FEATURE_NAME]: { usage: 150, periodStart: new Date() },
          },
        })
      })

      it('should clamp remainingUsage to 0 rather than leak a negative', async function (ctx) {
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(0)
      })
    })
  })

  describe('resetFeatureUsage', function () {
    beforeEach(function (ctx) {
      ctx._getAllowanceStub.resolves(100)
    })

    describe('with some usage', function () {
      beforeEach(async function (ctx) {
        await UserFeatureUsage.create({
          _id: ctx.userId,
          features: {
            [MOCKED_FEATURE_NAME]: { usage: 75, periodStart: new Date(0) },
          },
        })
      })

      it('should reset usage back to the full allowance', async function (ctx) {
        await ctx.FeatureUsageRateLimiter.resetFeatureUsage(ctx.userId)
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(100)
      })

      it('should set periodStart to roughly the current time', async function (ctx) {
        const before = Date.now()
        await ctx.FeatureUsageRateLimiter.resetFeatureUsage(ctx.userId)
        const doc = await UserFeatureUsage.findOne({ _id: ctx.userId }).exec()
        const periodStart = doc.features[MOCKED_FEATURE_NAME].periodStart
        expect(periodStart.getTime()).to.be.at.least(before)
        expect(periodStart.getTime()).to.be.at.most(Date.now())
      })
    })

    describe('when no usage record exists', function () {
      it('should upsert a fresh usage record with zero usage', async function (ctx) {
        await ctx.FeatureUsageRateLimiter.resetFeatureUsage(ctx.userId)
        const doc = await UserFeatureUsage.findOne({ _id: ctx.userId }).exec()
        expect(doc).to.not.be.null
        expect(doc.features[MOCKED_FEATURE_NAME].usage).to.equal(0)
      })
    })
  })

  describe('decrementFeatureUsage', function () {
    describe('with some usage', function () {
      beforeEach(async function (ctx) {
        await UserFeatureUsage.create({
          _id: ctx.userId,
          features: {
            [MOCKED_FEATURE_NAME]: { usage: 30, periodStart: new Date() },
          },
        })
        ctx._getAllowanceStub.resolves(100)
      })

      it('should decrement usage by 1 when cost is 1', async function (ctx) {
        const res = { set: () => null }
        await ctx.FeatureUsageRateLimiter.decrementFeatureUsage(
          ctx.userId,
          res,
          1
        )
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(71)
      })

      it('should decrement usage by the specified cost', async function (ctx) {
        const res = { set: () => null }
        await ctx.FeatureUsageRateLimiter.decrementFeatureUsage(
          ctx.userId,
          res,
          5
        )
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(75)
      })

      it('should decrement usage by 1 when cost is omitted (default)', async function (ctx) {
        const res = { set: () => null }
        await ctx.FeatureUsageRateLimiter.decrementFeatureUsage(ctx.userId, res)
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(71)
      })
    })
  })
})
