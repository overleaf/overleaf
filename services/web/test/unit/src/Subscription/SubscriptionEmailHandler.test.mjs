import { vi, expect } from 'vitest'
import sinon from 'sinon'
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionEmailHandler'

describe('SubscriptionEmailHandler', function () {
  beforeEach(async function (ctx) {
    ctx.userId = '123456789abcde'
    ctx.email = 'test@test.com'

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: (ctx.EmailHandler = {
        promises: {
          sendEmail: sinon.stub().resolves({}),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: (ctx.UserGetter = {
        promises: {
          getUser: sinon
            .stub()
            .resolves({ _id: ctx.userId, email: 'test@test.com' }),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/Subscription/PlansLocator', () => ({
      default: (ctx.PlansLocator = {
        findLocalPlanInSettings: sinon.stub().returns({
          name: 'foo',
          features: { collaborators: 42 },
        }),
      }),
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {
        enableOnboardingEmails: true,
      }),
    }))

    ctx.SubscriptionEmailHandler = (await import(modulePath)).default
  })

  describe('when onboarding emails are disabled', function () {
    beforeEach(function (ctx) {
      ctx.Settings.enableOnboardingEmails = false
    })
    it('does not send a trial onboarding email', async function (ctx) {
      await ctx.SubscriptionEmailHandler.sendTrialOnboardingEmail(
        ctx.userId,
        'foo-plan-code'
      )
      expect(ctx.EmailHandler.promises.sendEmail).to.not.have.been.called
    })
  })

  describe('when onboarding emails are enabled', function () {
    it('sends trial onboarding email', async function (ctx) {
      await ctx.SubscriptionEmailHandler.sendTrialOnboardingEmail(
        ctx.userId,
        'foo-plan-code'
      )

      expect(ctx.PlansLocator.findLocalPlanInSettings).to.have.been.calledWith(
        'foo-plan-code'
      )
      expect(ctx.EmailHandler.promises.sendEmail.lastCall.args).to.deep.equal([
        'trialOnboarding',
        {
          to: ctx.email,
          sendingUser_id: ctx.userId,
          planName: 'foo',
          features: { collaborators: 42 },
        },
      ])
    })
  })
})
