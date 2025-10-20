import { vi, expect } from 'vitest'
import sinon from 'sinon'

const MODULE_PATH =
  '../../../../app/src/Features/User/UserOnboardingEmailManager'

describe('UserOnboardingEmailManager', function () {
  beforeEach(async function (ctx) {
    ctx.fakeUserId = '123abc'
    ctx.fakeUserEmail = 'frog@overleaf.com'
    ctx.onboardingEmailsQueue = {
      add: sinon.stub().resolves(),
      process: callback => {
        ctx.queueProcessFunction = callback
      },
    }
    ctx.Queues = {
      createScheduledJob: sinon.stub().resolves(),
    }
    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null),
      },
    }
    ctx.UserGetter.promises.getUser.withArgs({ _id: ctx.fakeUserId }).resolves({
      _id: ctx.fakeUserId,
      email: ctx.fakeUserEmail,
    })
    ctx.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves(),
      },
    }
    ctx.UserUpdater = {
      promises: {
        updateUser: sinon.stub().resolves(),
      },
    }

    vi.doMock('../../../../app/src/infrastructure/Queues', () => ({
      default: ctx.Queues,
    }))

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: ctx.EmailHandler,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: ctx.UserUpdater,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {
        enableOnboardingEmails: true,
      }),
    }))

    ctx.UserOnboardingEmailManager = (await import(MODULE_PATH)).default
  })

  describe('scheduleOnboardingEmail', function () {
    it('should schedule delayed job on queue', async function (ctx) {
      await ctx.UserOnboardingEmailManager.scheduleOnboardingEmail({
        _id: ctx.fakeUserId,
      })
      sinon.assert.calledWith(
        ctx.Queues.createScheduledJob,
        'emails-onboarding',
        { data: { userId: ctx.fakeUserId } },
        24 * 60 * 60 * 1000
      )
    })
  })

  describe('sendOnboardingEmail', function () {
    describe('when onboarding emails are disabled', function () {
      beforeEach(function (ctx) {
        ctx.Settings.enableOnboardingEmails = false
      })
      it('should not send onboarding email', async function (ctx) {
        await ctx.UserOnboardingEmailManager.sendOnboardingEmail(ctx.fakeUserId)
        expect(ctx.EmailHandler.promises.sendEmail).not.to.have.been.called
        expect(ctx.UserUpdater.promises.updateUser).not.to.have.been.called
      })
    })
    describe('when onboarding emails are enabled', function () {
      it('should send onboarding email and update user', async function (ctx) {
        await ctx.UserOnboardingEmailManager.sendOnboardingEmail(ctx.fakeUserId)
        expect(ctx.EmailHandler.promises.sendEmail).to.have.been.calledWith(
          'userOnboardingEmail',
          {
            to: ctx.fakeUserEmail,
          }
        )
        expect(ctx.UserUpdater.promises.updateUser).to.have.been.calledWith(
          ctx.fakeUserId,
          { $set: { onboardingEmailSentAt: sinon.match.date } }
        )
      })

      it('should stop if user is not found', async function (ctx) {
        await ctx.UserOnboardingEmailManager.sendOnboardingEmail({
          data: { userId: 'deleted-user' },
        })
        expect(ctx.EmailHandler.promises.sendEmail).not.to.have.been.called
        expect(ctx.UserUpdater.promises.updateUser).not.to.have.been.called
      })
    })
  })
})
