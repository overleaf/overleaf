import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import crypto from 'node:crypto'

const MODULE_PATH = '../../../../app/src/Features/Survey/SurveyHandler'

const USER_ID = '507f1f77bcf86cd799439011'

// mirrors the private percentile calculation in SurveyHandler so we can
// construct deterministic rollout test cases
function computePercentile(userId, surveyName) {
  const hash = crypto
    .createHash('md5')
    .update(userId + surveyName)
    .digest('hex')
  const hashPrefix = hash.substring(0, 8)
  return Math.floor(
    ((parseInt(hashPrefix, 16) % 0xffffffff) / 0xffffffff) * 100
  )
}

// build a survey stub matching what SurveyCache returns: `options` is read
// directly off the document and the remaining fields come from `toObject()`
function makeSurvey({
  name = 'my-survey',
  title = 'My Survey',
  text = 'Please take our survey',
  cta = 'Take survey',
  url = 'https://example.com/survey',
  options = {},
} = {}) {
  return {
    name,
    title,
    text,
    cta,
    url,
    options,
    toObject() {
      return { name, title, text, cta, url, options }
    },
  }
}

describe('SurveyHandler', function () {
  beforeEach(async function (ctx) {
    ctx.SurveyCache = {
      get: sinon.stub().resolves(undefined),
    }
    ctx.SubscriptionLocator = {
      promises: {
        getAllAssociatedSubscriptions: sinon.stub().resolves([]),
      },
    }
    ctx.PlansHelper = {
      isProfessionalPlan: sinon.stub().returns(false),
    }
    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves({ signUpDate: new Date('2020-01-01') }),
      },
    }

    vi.doMock('../../../../app/src/Features/Survey/SurveyCache', () => ({
      default: ctx.SurveyCache,
    }))
    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )
    vi.doMock('../../../../app/src/Features/Subscription/PlansHelper', () => ({
      default: ctx.PlansHelper,
    }))
    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    ctx.SurveyHandler = (await import(MODULE_PATH)).default
  })

  describe('getSurvey', function () {
    it('returns undefined when there is no active survey', async function (ctx) {
      ctx.SurveyCache.get.resolves(undefined)
      const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
      expect(survey).to.be.undefined
    })

    it('reads the survey from the cache with preview enabled', async function (ctx) {
      ctx.SurveyCache.get.resolves(makeSurvey())
      await ctx.SurveyHandler.promises.getSurvey(USER_ID)
      expect(ctx.SurveyCache.get).to.have.been.calledOnceWithExactly(true)
    })

    it('returns the public survey fields when there are no filters', async function (ctx) {
      ctx.SurveyCache.get.resolves(makeSurvey())
      const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
      expect(survey).to.deep.equal({
        name: 'my-survey',
        title: 'My Survey',
        text: 'Please take our survey',
        cta: 'Take survey',
        url: 'https://example.com/survey',
      })
    })

    it('does not query subscriptions or user when there are no filters', async function (ctx) {
      ctx.SurveyCache.get.resolves(makeSurvey())
      await ctx.SurveyHandler.promises.getSurvey(USER_ID)
      expect(ctx.SubscriptionLocator.promises.getAllAssociatedSubscriptions).to
        .not.have.been.called
      expect(ctx.UserGetter.promises.getUser).to.not.have.been.called
    })

    describe('subscription filters', function () {
      it('shows a free-only survey to a user with no subscriptions', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { hasFreeSubscription: true } })
        )
        ctx.SubscriptionLocator.promises.getAllAssociatedSubscriptions.resolves(
          []
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })

      it('hides a free-only survey from a user with a subscription', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { hasFreeSubscription: true } })
        )
        ctx.SubscriptionLocator.promises.getAllAssociatedSubscriptions.resolves(
          [{ groupPlan: false, planCode: 'collaborator' }]
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.be.undefined
      })

      it('hides a subscriber-only survey from a free user', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { hasIndividualStandardSubscription: true } })
        )
        ctx.SubscriptionLocator.promises.getAllAssociatedSubscriptions.resolves(
          []
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.be.undefined
      })

      it('requests only the fields needed for filtering', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { hasFreeSubscription: true } })
        )
        await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(
          ctx.SubscriptionLocator.promises.getAllAssociatedSubscriptions
        ).to.have.been.calledWith(USER_ID, { groupPlan: 1, planCode: 1 })
      })

      it('shows an individual-standard survey to an individual standard subscriber', async function (ctx) {
        ctx.PlansHelper.isProfessionalPlan.returns(false)
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { hasIndividualStandardSubscription: true } })
        )
        ctx.SubscriptionLocator.promises.getAllAssociatedSubscriptions.resolves(
          [{ groupPlan: false, planCode: 'collaborator' }]
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })

      it('shows an individual-professional survey to an individual professional subscriber', async function (ctx) {
        ctx.PlansHelper.isProfessionalPlan.returns(true)
        ctx.SurveyCache.get.resolves(
          makeSurvey({
            options: { hasIndividualProfessionalSubscription: true },
          })
        )
        ctx.SubscriptionLocator.promises.getAllAssociatedSubscriptions.resolves(
          [{ groupPlan: false, planCode: 'professional' }]
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })

      it('shows a group-standard survey to a group standard subscriber', async function (ctx) {
        ctx.PlansHelper.isProfessionalPlan.returns(false)
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { hasGroupStandardSubscription: true } })
        )
        ctx.SubscriptionLocator.promises.getAllAssociatedSubscriptions.resolves(
          [{ groupPlan: true, planCode: 'group_collaborator' }]
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })

      it('shows a group-professional survey to a group professional subscriber', async function (ctx) {
        ctx.PlansHelper.isProfessionalPlan.returns(true)
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { hasGroupProfessionalSubscription: true } })
        )
        ctx.SubscriptionLocator.promises.getAllAssociatedSubscriptions.resolves(
          [{ groupPlan: true, planCode: 'group_professional' }]
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })

      it('shows an enterprise survey to an enterprise subscriber', async function (ctx) {
        ctx.PlansHelper.isProfessionalPlan.returns(false)
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { hasEnterpriseSubscription: true } })
        )
        ctx.SubscriptionLocator.promises.getAllAssociatedSubscriptions.resolves(
          [{ groupPlan: true, planCode: 'group_enterprise' }]
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })

      it('shows the survey if any one of several subscriptions matches', async function (ctx) {
        ctx.PlansHelper.isProfessionalPlan.returns(false)
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { hasGroupStandardSubscription: true } })
        )
        ctx.SubscriptionLocator.promises.getAllAssociatedSubscriptions.resolves(
          [
            { groupPlan: false, planCode: 'collaborator' },
            { groupPlan: true, planCode: 'group_collaborator' },
          ]
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })
    })

    describe('rollout percentage', function () {
      it('shows the survey to everyone at 100% rollout', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { rolloutPercentage: 100 } })
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })

      it('defaults to full rollout when no percentage is set', async function (ctx) {
        ctx.SurveyCache.get.resolves(makeSurvey({ options: {} }))
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })

      it('treats a 0% rollout as full rollout (falsy fallback to 100)', async function (ctx) {
        // `options.rolloutPercentage || 100` means 0 is coerced to 100
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { rolloutPercentage: 0 } })
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })

      it('includes a user whose percentile is below the rollout percentage', async function (ctx) {
        const percentile = computePercentile(USER_ID, 'my-survey')
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { rolloutPercentage: percentile + 1 } })
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })

      it('excludes a user whose percentile equals the rollout percentage', async function (ctx) {
        const percentile = computePercentile(USER_ID, 'my-survey')
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { rolloutPercentage: percentile } })
        )
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.be.undefined
      })
    })

    describe('signup date and program filters', function () {
      it('returns undefined when the user cannot be found', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { excludeBetaUsers: true } })
        )
        ctx.UserGetter.promises.getUser.resolves(null)
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.be.undefined
      })

      it('requests only the fields needed for filtering', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { excludeBetaUsers: true } })
        )
        await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(ctx.UserGetter.promises.getUser).to.have.been.calledWith(
          USER_ID,
          { signUpDate: 1, labsProgram: 1, betaProgram: 1 }
        )
      })

      it('hides the survey from a user who signed up after the latest signup date', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { latestSignupDate: new Date('2022-01-01') } })
        )
        ctx.UserGetter.promises.getUser.resolves({
          signUpDate: new Date('2023-06-01'),
        })
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.be.undefined
      })

      it('hides the survey from a user who signed up before the earliest signup date', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({
            options: { earliestSignupDate: new Date('2022-01-01') },
          })
        )
        ctx.UserGetter.promises.getUser.resolves({
          signUpDate: new Date('2021-06-01'),
        })
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.be.undefined
      })

      it('shows the survey to a user who signed up after the earliest signup date', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({
            options: { earliestSignupDate: new Date('2022-01-01') },
          })
        )
        ctx.UserGetter.promises.getUser.resolves({
          signUpDate: new Date('2023-06-01'),
        })
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })

      it('excludes labs users when excludeLabsUsers is set', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { excludeLabsUsers: true } })
        )
        ctx.UserGetter.promises.getUser.resolves({
          signUpDate: new Date('2020-01-01'),
          labsProgram: true,
        })
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.be.undefined
      })

      it('excludes beta users when excludeBetaUsers is set', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { excludeBetaUsers: true } })
        )
        ctx.UserGetter.promises.getUser.resolves({
          signUpDate: new Date('2020-01-01'),
          betaProgram: true,
        })
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.be.undefined
      })

      it('requires beta participation when requireBetaParticipation is set', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { requireBetaParticipation: true } })
        )
        ctx.UserGetter.promises.getUser.resolves({
          signUpDate: new Date('2020-01-01'),
          betaProgram: false,
        })
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.be.undefined
      })

      it('shows the survey to a beta user when requireBetaParticipation is set', async function (ctx) {
        ctx.SurveyCache.get.resolves(
          makeSurvey({ options: { requireBetaParticipation: true } })
        )
        ctx.UserGetter.promises.getUser.resolves({
          signUpDate: new Date('2020-01-01'),
          betaProgram: true,
        })
        const survey = await ctx.SurveyHandler.promises.getSurvey(USER_ID)
        expect(survey).to.have.property('name', 'my-survey')
      })
    })
  })
})
