import { expect, vi } from 'vitest'
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
  '../../../../app/src/infrastructure/FeatureUsageRateLimiter.mjs'

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
        await expect(ctx.FeatureUsageRateLimiter.useFeature(ctx.userId, res)).to
          .not.be.rejected
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
        await expect(ctx.FeatureUsageRateLimiter.useFeature(ctx.userId, res)).to
          .not.be.rejected
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
          ctx.FeatureUsageRateLimiter.useFeature(ctx.userId, res)
        ).to.be.rejectedWith(TooManyRequestsError)
      })
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

      it('should return a usage', async function (ctx) {
        const res = { set: () => null }
        await ctx.FeatureUsageRateLimiter.decrementFeatureUsage(ctx.userId, res)
        const usages =
          await ctx.FeatureUsageRateLimiter.getRemainingFeatureUses(ctx.userId)
        expect(usages[MOCKED_FEATURE_NAME].remainingUsage).to.equal(71)
      })
    })
  })
})
