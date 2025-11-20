import { vi, expect } from 'vitest'
import assert from 'node:assert'
import sinon from 'sinon'
import EmailHelper from '../../../../app/src/Features/Helpers/EmailHelper.mjs'

const modulePath = '../../../../app/src/Features/User/UserRegistrationHandler'

describe('UserRegistrationHandler', function () {
  beforeEach(async function (ctx) {
    ctx.analyticsId = '123456'
    ctx.user = {
      _id: (ctx.user_id = '31j2lk21kjl'),
      analyticsId: ctx.analyticsId,
    }
    ctx.User = {
      updateOne: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }
    ctx.UserGetter = {
      promises: {
        getUserByAnyEmail: sinon.stub(),
      },
    }
    ctx.UserCreator = {
      promises: {
        createNewUser: sinon.stub().resolves(ctx.user),
      },
    }
    ctx.AuthenticationManager = {
      validateEmail: sinon.stub().returns(null),
      validatePassword: sinon.stub().returns(null),
      promises: {
        setUserPassword: sinon.stub().resolves(ctx.user),
      },
    }
    ctx.NewsLetterManager = {
      subscribe: sinon.stub(),
    }
    ctx.EmailHandler = {
      promises: { sendEmail: sinon.stub().resolves() },
    }
    ctx.OneTimeTokenHandler = { promises: { getNewToken: sinon.stub() } }

    vi.doMock('../../../../app/src/models/User', () => ({
      User: ctx.User,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/User/UserCreator', () => ({
      default: ctx.UserCreator,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationManager',
      () => ({
        default: ctx.AuthenticationManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Newsletter/NewsletterManager',
      () => ({
        default: ctx.NewsLetterManager,
      })
    )

    vi.doMock('crypto', () => ({
      default: (ctx.crypto = {}),
    }))

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: ctx.EmailHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Security/OneTimeTokenHandler',
      () => ({
        default: ctx.OneTimeTokenHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: (ctx.AnalyticsManager = {
          recordEventForUser: sinon.stub(),
          setUserPropertyForUser: sinon.stub(),
          identifyUser: sinon.stub(),
        }),
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        siteUrl: 'http://sl.example.com',
      }),
    }))

    vi.doMock('../../../../app/src/Features/Helpers/EmailHelper', () => ({
      default: EmailHelper,
    }))

    ctx.handler = (await import(modulePath)).default

    ctx.passingRequest = {
      email: 'something@email.com',
      password: '123',
      analyticsId: ctx.analyticsId,
    }
  })

  describe('validate Register Request', function () {
    it('allows passing validation through', function (ctx) {
      const result = ctx.handler.promises._registrationRequestIsValid(
        ctx.passingRequest
      )
      result.should.equal(true)
    })

    describe('failing email validation', function () {
      beforeEach(function (ctx) {
        ctx.AuthenticationManager.validateEmail.returns({
          message: 'email not set',
        })
      })

      it('does not allow through', function (ctx) {
        const result = ctx.handler.promises._registrationRequestIsValid(
          ctx.passingRequest
        )
        return result.should.equal(false)
      })
    })

    describe('failing password validation', function () {
      beforeEach(function (ctx) {
        ctx.AuthenticationManager.validatePassword.returns({
          message: 'password is too short',
        })
      })

      it('does not allow through', function (ctx) {
        const result = ctx.handler.promises._registrationRequestIsValid(
          ctx.passingRequest
        )
        result.should.equal(false)
      })
    })
  })

  describe('registerNewUser', function () {
    describe('holdingAccount', function (done) {
      beforeEach(function (ctx) {
        ctx.user.holdingAccount = true
        ctx.handler.promises._registrationRequestIsValid = sinon
          .stub()
          .returns(true)
        ctx.UserGetter.promises.getUserByAnyEmail.resolves(ctx.user)
      })

      it('should not create a new user if there is a holding account there', async function (ctx) {
        await ctx.handler.promises.registerNewUser(ctx.passingRequest)
        ctx.UserCreator.promises.createNewUser.called.should.equal(false)
      })

      it('should set holding account to false', async function (ctx) {
        await ctx.handler.promises.registerNewUser(ctx.passingRequest)
        const update = ctx.User.updateOne.args[0]
        assert.deepEqual(update[0], { _id: ctx.user._id })
        assert.deepEqual(update[1], { $set: { holdingAccount: false } })
      })
    })

    describe('invalidRequest', function () {
      it('should not create a new user if the the request is not valid', async function (ctx) {
        ctx.handler.promises._registrationRequestIsValid = sinon
          .stub()
          .returns(false)
        expect(ctx.handler.promises.registerNewUser(ctx.passingRequest)).to.be
          .rejected
        ctx.UserCreator.promises.createNewUser.called.should.equal(false)
      })

      it('should return email registered in the error if there is a non holdingAccount there', async function (ctx) {
        ctx.UserGetter.promises.getUserByAnyEmail.resolves(
          (ctx.user = { holdingAccount: false })
        )
        expect(
          ctx.handler.promises.registerNewUser(ctx.passingRequest)
        ).to.be.rejectedWith('EmailAlreadyRegistered')
      })
    })

    describe('validRequest', function () {
      beforeEach(function (ctx) {
        ctx.handler.promises._registrationRequestIsValid = sinon
          .stub()
          .returns(true)
        ctx.UserGetter.promises.getUserByAnyEmail.resolves()
      })

      it('should create a new user', async function (ctx) {
        await ctx.handler.promises.registerNewUser(ctx.passingRequest)
        sinon.assert.calledWith(ctx.UserCreator.promises.createNewUser, {
          email: ctx.passingRequest.email,
          holdingAccount: false,
          first_name: ctx.passingRequest.first_name,
          last_name: ctx.passingRequest.last_name,
          analyticsId: ctx.user.analyticsId,
        })
      })

      it('lower case email', async function (ctx) {
        ctx.passingRequest.email = 'soMe@eMail.cOm'
        await ctx.handler.promises.registerNewUser(ctx.passingRequest)
        ctx.UserCreator.promises.createNewUser.args[0][0].email.should.equal(
          'some@email.com'
        )
      })

      it('trim white space from email', async function (ctx) {
        ctx.passingRequest.email = ' some@email.com '
        await ctx.handler.promises.registerNewUser(ctx.passingRequest)
        ctx.UserCreator.promises.createNewUser.args[0][0].email.should.equal(
          'some@email.com'
        )
      })

      it('should set the password', async function (ctx) {
        await ctx.handler.promises.registerNewUser(ctx.passingRequest)
        ctx.AuthenticationManager.promises.setUserPassword
          .calledWith(ctx.user, ctx.passingRequest.password)
          .should.equal(true)
      })

      it('should add the user to the newsletter if accepted terms', async function (ctx) {
        ctx.passingRequest.subscribeToNewsletter = 'true'
        await ctx.handler.promises.registerNewUser(ctx.passingRequest)
        ctx.NewsLetterManager.subscribe.calledWith(ctx.user).should.equal(true)
      })

      it('should not add the user to the newsletter if not accepted terms', async function (ctx) {
        await ctx.handler.promises.registerNewUser(ctx.passingRequest)
        ctx.NewsLetterManager.subscribe.calledWith(ctx.user).should.equal(false)
      })
    })
  })

  describe('registerNewUserAndSendActivationEmail', function () {
    beforeEach(function (ctx) {
      ctx.email = 'Email@example.com'
      ctx.crypto.randomBytes = sinon.stub().returns({
        toString: () => {
          return (ctx.password = 'mock-password')
        },
      })
      ctx.OneTimeTokenHandler.promises.getNewToken.resolves(
        (ctx.token = 'mock-token')
      )
      ctx.handler.promises.registerNewUser = sinon.stub()
    })

    describe('with a new user', function () {
      beforeEach(async function (ctx) {
        ctx.user.email = ctx.email.toLowerCase()
        ctx.handler.promises.registerNewUser.resolves(ctx.user)
        ctx.result =
          await ctx.handler.promises.registerNewUserAndSendActivationEmail(
            ctx.email
          )
      })

      it('should ask the UserRegistrationHandler to register user', function (ctx) {
        sinon.assert.calledWith(ctx.handler.promises.registerNewUser, {
          email: ctx.email,
          password: ctx.password,
        })
      })

      it('should generate a new password reset token', function (ctx) {
        const data = {
          user_id: ctx.user._id.toString(),
          email: ctx.user.email,
        }
        ctx.OneTimeTokenHandler.promises.getNewToken
          .calledWith('password', data, { expiresIn: 7 * 24 * 60 * 60 })
          .should.equal(true)
      })

      it('should send a registered email', function (ctx) {
        ctx.EmailHandler.promises.sendEmail
          .calledWith('registered', {
            to: ctx.user.email,
            setNewPasswordUrl: `${ctx.settings.siteUrl}/user/activate?token=${ctx.token}&user_id=${ctx.user_id}`,
          })
          .should.equal(true)
      })

      it('should return the user and new password url', function (ctx) {
        const { user, setNewPasswordUrl } = ctx.result
        expect(user).to.deep.equal(ctx.user)
        expect(setNewPasswordUrl).to.equal(
          `${ctx.settings.siteUrl}/user/activate?token=${ctx.token}&user_id=${ctx.user_id}`
        )
      })
    })

    describe('with a user that already exists', function () {
      beforeEach(async function (ctx) {
        ctx.handler.promises.registerNewUser.rejects(
          new Error('EmailAlreadyRegistered')
        )
        ctx.UserGetter.promises.getUserByAnyEmail.resolves(ctx.user)
        await ctx.handler.promises.registerNewUserAndSendActivationEmail(
          ctx.email
        )
      })

      it('should still generate a new password token and email', function (ctx) {
        ctx.OneTimeTokenHandler.promises.getNewToken.called.should.equal(true)
        ctx.EmailHandler.promises.sendEmail.called.should.equal(true)
      })
    })
  })
})
