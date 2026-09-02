import { beforeEach, describe, expect, it, vi } from 'vitest'
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
      // limit-reached marker write; win it by default
      updateOne: sinon.stub().returns({
        exec: sinon.stub().resolves({ modifiedCount: 1 }),
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
        featureFlagEnabledForMongoUser: sinon.stub().resolves(true),
      },
    }

    ctx.UserAuditLogHandler = {
      addEntryInBackground: sinon.stub(),
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }

    ctx.AnalyticsManager = {
      recordEventForUserInBackground: sinon.stub(),
    }

    ctx.SubscriptionViewModelBuilder = {
      promises: {
        getUsersSubscriptionDetails: sinon.stub().resolves({
          bestSubscription: {
            type: 'individual',
            plan: { planCode: 'professional' },
          },
        }),
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock(
      '../../../../app/src/Features/User/UserAuditLogHandler.mjs',
      () => ({
        default: ctx.UserAuditLogHandler,
      })
    )

    vi.doMock('../../../../app/src/models/UserFeatureUsage', () => ({
      UserFeatureUsage: ctx.UserFeatureUsageModel,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter.mjs', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager.mjs',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionViewModelBuilder.mjs',
      () => ({
        default: ctx.SubscriptionViewModelBuilder,
      })
    )

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

    describe('audit log on quota breach', function () {
      const stubUsage = (ctx, usage) => {
        ctx.UserFeatureUsageModel.findOneAndUpdate = sinon.stub().returns({
          exec: sinon.stub().resolves({
            features: {
              aiFeatureUsage: { usage, periodStart: new Date() },
            },
          }),
        })
      }
      const buildRes = () => ({ set: () => null, req: { ip: '1.2.3.4' } })

      it('writes an ai-quota-breach audit log entry with the tool when usage hits the allowance', async function (ctx) {
        stubUsage(ctx, ctx.settings.quotaGrants.ai.basic)

        await ctx.AiFeatureUsageRateLimiter.useFeature(
          ctx.userId,
          buildRes(),
          1,
          { auditLogTool: 'workbench-usage' }
        )

        expect(
          ctx.UserAuditLogHandler.addEntryInBackground
        ).to.have.been.calledOnceWithExactly(
          ctx.userId,
          'ai-quota-breach',
          ctx.userId,
          '1.2.3.4',
          { tool: 'workbench-usage' }
        )
      })

      it('fires ai-usage-limit-reached on the served request that reaches the allowance', async function (ctx) {
        stubUsage(ctx, ctx.settings.quotaGrants.ai.basic)

        await expect(
          ctx.AiFeatureUsageRateLimiter.useFeature(ctx.userId, buildRes(), 1, {
            auditLogTool: 'workbench-usage',
          })
        ).to.not.be.rejected

        expect(
          ctx.AnalyticsManager.recordEventForUserInBackground
        ).to.have.been.calledOnceWithExactly(
          ctx.userId,
          'ai-usage-limit-reached',
          {
            limit: ctx.settings.quotaGrants.ai.basic,
            feature: 'workbench-usage',
            'plan-code': 'professional',
            'plan-type': 'individual',
          }
        )
      })

      it('writes an audit log entry when usage is already over the allowance', async function (ctx) {
        stubUsage(ctx, ctx.settings.quotaGrants.ai.basic + 1)

        await expect(
          ctx.AiFeatureUsageRateLimiter.useFeature(ctx.userId, buildRes(), 1, {
            auditLogTool: 'workbench-usage',
          })
        ).to.be.rejectedWith('aiFeatureUsage rate limit exceeded')

        expect(ctx.UserAuditLogHandler.addEntryInBackground).to.have.been
          .calledOnce
        expect(
          ctx.UserAuditLogHandler.addEntryInBackground.firstCall.args[1]
        ).to.equal('ai-quota-breach')
        expect(
          ctx.UserAuditLogHandler.addEntryInBackground.firstCall.args[4]
        ).to.deep.equal({ tool: 'workbench-usage' })
      })

      it('does not write an audit log entry when auditLogTool is not provided', async function (ctx) {
        stubUsage(ctx, ctx.settings.quotaGrants.ai.basic + 1)

        await expect(
          ctx.AiFeatureUsageRateLimiter.useFeature(ctx.userId, buildRes(), 1)
        ).to.be.rejectedWith('aiFeatureUsage rate limit exceeded')

        expect(ctx.UserAuditLogHandler.addEntryInBackground).to.not.have.been
          .called
      })

      it('does not write an audit log entry when usage is below the allowance', async function (ctx) {
        stubUsage(ctx, 1)

        await ctx.AiFeatureUsageRateLimiter.useFeature(
          ctx.userId,
          buildRes(),
          1,
          { auditLogTool: 'workbench-usage' }
        )

        expect(ctx.UserAuditLogHandler.addEntryInBackground).to.not.have.been
          .called
      })

      it('does not fire the event but still rejects when the marker write fails', async function (ctx) {
        stubUsage(ctx, ctx.settings.quotaGrants.ai.basic + 1)
        ctx.UserFeatureUsageModel.updateOne = sinon.stub().returns({
          exec: sinon.stub().rejects(new Error('mongo down')),
        })

        await expect(
          ctx.AiFeatureUsageRateLimiter.useFeature(ctx.userId, buildRes(), 1, {
            auditLogTool: 'workbench-usage',
          })
        ).to.be.rejectedWith('aiFeatureUsage rate limit exceeded')

        expect(ctx.AnalyticsManager.recordEventForUserInBackground).to.not.have
          .been.called
      })

      it('skips the event but still audits when periodStart is missing', async function (ctx) {
        // usage over the cap, but the returned doc has no periodStart
        ctx.UserFeatureUsageModel.findOneAndUpdate = sinon.stub().returns({
          exec: sinon.stub().resolves({
            features: {
              aiFeatureUsage: { usage: ctx.settings.quotaGrants.ai.basic + 1 },
            },
          }),
        })

        await expect(
          ctx.AiFeatureUsageRateLimiter.useFeature(ctx.userId, buildRes(), 1, {
            auditLogTool: 'workbench-usage',
          })
        ).to.be.rejectedWith('aiFeatureUsage rate limit exceeded')

        expect(ctx.UserAuditLogHandler.addEntryInBackground).to.have.been
          .calledOnce
        expect(ctx.AnalyticsManager.recordEventForUserInBackground).to.not.have
          .been.called
      })

      it('fires the event once but audits every time across repeated at-limit requests', async function (ctx) {
        stubUsage(ctx, ctx.settings.quotaGrants.ai.basic + 1)
        // first request records the marker, later ones do not
        const recordFirstReachExec = sinon.stub()
        recordFirstReachExec.onFirstCall().resolves({ modifiedCount: 1 })
        recordFirstReachExec.resolves({ modifiedCount: 0 })
        ctx.UserFeatureUsageModel.updateOne = sinon
          .stub()
          .returns({ exec: recordFirstReachExec })

        const useAtLimit = () =>
          expect(
            ctx.AiFeatureUsageRateLimiter.useFeature(
              ctx.userId,
              buildRes(),
              1,
              {
                auditLogTool: 'workbench-usage',
              }
            )
          ).to.be.rejectedWith('aiFeatureUsage rate limit exceeded')

        await useAtLimit()
        await useAtLimit()
        await useAtLimit()

        expect(ctx.AnalyticsManager.recordEventForUserInBackground).to.have.been
          .calledOnce
        expect(ctx.UserAuditLogHandler.addEntryInBackground).to.have.been
          .calledThrice
      })
    })
  })

  describe('_recordLimitReachedEvent', function () {
    it('records ai-usage-limit-reached with plan-code, plan-type, limit and feature', async function (ctx) {
      await ctx.AiFeatureUsageRateLimiter._recordLimitReachedEvent(
        ctx.userId,
        10,
        'workbench-usage'
      )

      expect(
        ctx.AnalyticsManager.recordEventForUserInBackground
      ).to.have.been.calledOnceWithExactly(
        ctx.userId,
        'ai-usage-limit-reached',
        {
          limit: 10,
          feature: 'workbench-usage',
          'plan-code': 'professional',
          'plan-type': 'individual',
        }
      )
    })

    it('records plan-type commons while plan-code reads as professional', async function (ctx) {
      ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails =
        sinon.stub().resolves({
          bestSubscription: {
            type: 'commons',
            plan: { planCode: 'professional' },
          },
        })

      await ctx.AiFeatureUsageRateLimiter._recordLimitReachedEvent(
        ctx.userId,
        10,
        'workbench-usage'
      )

      expect(
        ctx.AnalyticsManager.recordEventForUserInBackground
      ).to.have.been.calledOnceWithExactly(
        ctx.userId,
        'ai-usage-limit-reached',
        {
          limit: 10,
          feature: 'workbench-usage',
          'plan-code': 'professional',
          'plan-type': 'commons',
        }
      )
    })

    it('omits plan-code but records plan-type free for free users', async function (ctx) {
      ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails =
        sinon.stub().resolves({ bestSubscription: { type: 'free' } })

      await ctx.AiFeatureUsageRateLimiter._recordLimitReachedEvent(
        ctx.userId,
        5,
        'suggest-fix'
      )

      expect(
        ctx.AnalyticsManager.recordEventForUserInBackground
      ).to.have.been.calledOnceWithExactly(
        ctx.userId,
        'ai-usage-limit-reached',
        {
          limit: 5,
          feature: 'suggest-fix',
          'plan-type': 'free',
        }
      )
    })

    it('omits feature when no tool is provided', async function (ctx) {
      await ctx.AiFeatureUsageRateLimiter._recordLimitReachedEvent(
        ctx.userId,
        10
      )

      expect(
        ctx.AnalyticsManager.recordEventForUserInBackground
      ).to.have.been.calledOnceWithExactly(
        ctx.userId,
        'ai-usage-limit-reached',
        {
          limit: 10,
          'plan-code': 'professional',
          'plan-type': 'individual',
        }
      )
    })

    it('still records the event when the plan lookup fails', async function (ctx) {
      ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails =
        sinon.stub().rejects(new Error('boom'))

      await ctx.AiFeatureUsageRateLimiter._recordLimitReachedEvent(
        ctx.userId,
        5,
        'suggest-fix'
      )

      expect(
        ctx.AnalyticsManager.recordEventForUserInBackground
      ).to.have.been.calledOnceWithExactly(
        ctx.userId,
        'ai-usage-limit-reached',
        {
          limit: 5,
          feature: 'suggest-fix',
        }
      )
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
