const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { expect } = require('chai')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/User/UserOnboardingEmailManager'
)

describe('UserOnboardingEmailManager', function () {
  beforeEach(function () {
    this.fakeUserId = '123abc'
    this.fakeUserEmail = 'frog@overleaf.com'
    this.onboardingEmailsQueue = {
      add: sinon.stub().resolves(),
      process: callback => {
        this.queueProcessFunction = callback
      },
    }
    this.Queues = {
      createScheduledJob: sinon.stub().resolves(),
    }
    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null),
      },
    }
    this.UserGetter.promises.getUser
      .withArgs({ _id: this.fakeUserId })
      .resolves({
        _id: this.fakeUserId,
        email: this.fakeUserEmail,
      })
    this.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves(),
      },
    }
    this.UserUpdater = {
      promises: {
        updateUser: sinon.stub().resolves(),
      },
    }

    this.UserOnboardingEmailManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../../infrastructure/Queues': this.Queues,
        '../Email/EmailHandler': this.EmailHandler,
        './UserGetter': this.UserGetter,
        './UserUpdater': this.UserUpdater,
        '@overleaf/settings': (this.Settings = {
          enableOnboardingEmails: true,
        }),
      },
    })
  })

  describe('scheduleOnboardingEmail', function () {
    it('should schedule delayed job on queue', async function () {
      await this.UserOnboardingEmailManager.scheduleOnboardingEmail({
        _id: this.fakeUserId,
      })
      sinon.assert.calledWith(
        this.Queues.createScheduledJob,
        'emails-onboarding',
        { data: { userId: this.fakeUserId } },
        24 * 60 * 60 * 1000
      )
    })
  })

  describe('sendOnboardingEmail', function () {
    describe('when onboarding emails are disabled', function () {
      beforeEach(function () {
        this.Settings.enableOnboardingEmails = false
      })
      it('should not send onboarding email', async function () {
        await this.UserOnboardingEmailManager.sendOnboardingEmail(
          this.fakeUserId
        )
        expect(this.EmailHandler.promises.sendEmail).not.to.have.been.called
        expect(this.UserUpdater.promises.updateUser).not.to.have.been.called
      })
    })
    describe('when onboarding emails are enabled', function () {
      it('should send onboarding email and update user', async function () {
        await this.UserOnboardingEmailManager.sendOnboardingEmail(
          this.fakeUserId
        )
        expect(this.EmailHandler.promises.sendEmail).to.have.been.calledWith(
          'userOnboardingEmail',
          {
            to: this.fakeUserEmail,
          }
        )
        expect(this.UserUpdater.promises.updateUser).to.have.been.calledWith(
          this.fakeUserId,
          { $set: { onboardingEmailSentAt: sinon.match.date } }
        )
      })

      it('should stop if user is not found', async function () {
        await this.UserOnboardingEmailManager.sendOnboardingEmail({
          data: { userId: 'deleted-user' },
        })
        expect(this.EmailHandler.promises.sendEmail).not.to.have.been.called
        expect(this.UserUpdater.promises.updateUser).not.to.have.been.called
      })
    })
  })
})
