import { vi, expect } from 'vitest'
import sinon from 'sinon'

const MODULE_PATH =
  '../../../../app/src/Features/User/UserPostRegistrationAnalyticsManager'

describe('UserPostRegistrationAnalyticsManager', function () {
  beforeEach(async function (ctx) {
    ctx.fakeUserId = '123abc'
    ctx.Queues = {
      createScheduledJob: sinon.stub().resolves(),
    }
    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(),
      },
    }
    ctx.UserGetter.promises.getUser
      .withArgs({ _id: ctx.fakeUserId })
      .resolves({ _id: ctx.fakeUserId })
    ctx.InstitutionsAPI = {
      promises: {
        getUserAffiliations: sinon.stub().resolves([]),
      },
    }
    ctx.AnalyticsManager = {
      setUserPropertyForUser: sinon.stub().resolves(),
    }

    vi.doMock('../../../../app/src/infrastructure/Queues', () => ({
      default: ctx.Queues,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsAPI',
      () => ({
        default: ctx.InstitutionsAPI,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    ctx.UserPostRegistrationAnalyticsManager = (
      await import(MODULE_PATH)
    ).default
  })

  describe('schedulePostRegistrationAnalytics', function () {
    it('should schedule delayed job on queue', async function (ctx) {
      await ctx.UserPostRegistrationAnalyticsManager.schedulePostRegistrationAnalytics(
        {
          _id: ctx.fakeUserId,
        }
      )
      sinon.assert.calledWith(
        ctx.Queues.createScheduledJob,
        'post-registration-analytics',
        { data: { userId: ctx.fakeUserId } },
        24 * 60 * 60 * 1000
      )
    })
  })

  describe('postRegistrationAnalytics', function () {
    it('stops without errors if user is not found', async function (ctx) {
      await ctx.UserPostRegistrationAnalyticsManager.postRegistrationAnalytics(
        'not-a-user'
      )
      expect(ctx.InstitutionsAPI.promises.getUserAffiliations).not.to.have.been
        .called
      expect(ctx.AnalyticsManager.setUserPropertyForUser).not.to.have.been
        .called
    })

    it('sets user property if user has commons account affiliationd', async function (ctx) {
      ctx.InstitutionsAPI.promises.getUserAffiliations.resolves([
        {},
        {
          institution: {
            commonsAccount: true,
          },
        },
        {
          institution: {
            commonsAccount: false,
          },
        },
      ])
      await ctx.UserPostRegistrationAnalyticsManager.postRegistrationAnalytics(
        ctx.fakeUserId
      )
      expect(
        ctx.AnalyticsManager.setUserPropertyForUser
      ).to.have.been.calledWith(
        ctx.fakeUserId,
        'registered-from-commons-account',
        true
      )
    })

    it('does not set user property if user has no commons account affiliation', async function (ctx) {
      ctx.InstitutionsAPI.promises.getUserAffiliations.resolves([
        {
          institution: {
            commonsAccount: false,
          },
        },
      ])
      await ctx.UserPostRegistrationAnalyticsManager.postRegistrationAnalytics(
        ctx.fakeUserId
      )
      expect(ctx.AnalyticsManager.setUserPropertyForUser).not.to.have.been
        .called
    })
  })
})
