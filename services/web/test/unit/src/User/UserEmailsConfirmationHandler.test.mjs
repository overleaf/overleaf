// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

import { vi, expect } from 'vitest'

import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import EmailHelper from '../../../../app/src/Features/Helpers/EmailHelper.mjs'

const modulePath =
  '../../../../app/src/Features/User/UserEmailsConfirmationHandler'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('UserEmailsConfirmationHandler', function () {
  beforeEach(async function (ctx) {
    ctx.mockUser = {
      _id: 'mock-user-id',
      email: 'mock@example.com',
      emails: [{ email: 'mock@example.com' }],
    }
    ctx.user_id = ctx.mockUser._id
    ctx.email = ctx.mockUser.email
    ctx.req = {}

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        siteUrl: 'https://emails.example.com',
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Security/OneTimeTokenHandler',
      () => ({
        default: (ctx.OneTimeTokenHandler = {
          promises: {},
        }),
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: (ctx.UserUpdater = {
        promises: {},
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: (ctx.UserGetter = {
        getUser: sinon.stub().yields(null, ctx.mockUser),
        promises: {
          getUser: sinon.stub().resolves(ctx.mockUser),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: (ctx.EmailHandler = {
        promises: {},
      }),
    }))

    vi.doMock('../../../../app/src/Features/Helpers/EmailHelper', () => ({
      default: EmailHelper,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: (ctx.SessionManager = {
          getLoggedInUserId: sinon.stub().returns(ctx.mockUser._id),
        }),
      })
    )

    ctx.UserEmailsConfirmationHandler = (await import(modulePath)).default
    return (ctx.callback = sinon.stub())
  })

  describe('sendConfirmationEmail', function () {
    beforeEach(function (ctx) {
      ctx.OneTimeTokenHandler.promises.getNewToken = sinon
        .stub()
        .resolves((ctx.token = 'new-token'))
      return (ctx.EmailHandler.promises.sendEmail = sinon.stub().resolves())
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        await ctx.UserEmailsConfirmationHandler.promises.sendConfirmationEmail(
          ctx.user_id,
          ctx.email
        )
      })

      it('should generate a token for the user which references their id and email', function (ctx) {
        return ctx.OneTimeTokenHandler.promises.getNewToken
          .calledWith(
            'email_confirmation',
            { user_id: ctx.user_id, email: ctx.email },
            { expiresIn: 90 * 24 * 60 * 60 }
          )
          .should.equal(true)
      })

      it('should send an email to the user', function (ctx) {
        return ctx.EmailHandler.promises.sendEmail
          .calledWith('confirmEmail', {
            to: ctx.email,
            confirmEmailUrl:
              'https://emails.example.com/user/emails/confirm?token=new-token',
            sendingUser_id: ctx.user_id,
          })
          .should.equal(true)
      })
    })

    describe('with invalid email', function () {
      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.UserEmailsConfirmationHandler.promises.sendConfirmationEmail(
            ctx.user_id,
            '!"£$%^&*()'
          )
        ).to.be.rejectedWith(Error)
      })
    })

    describe('a custom template', function () {
      beforeEach(async function (ctx) {
        await ctx.UserEmailsConfirmationHandler.promises.sendConfirmationEmail(
          ctx.user_id,
          ctx.email,
          'myCustomTemplate'
        )
      })

      it('should send an email with the given template', function (ctx) {
        return ctx.EmailHandler.promises.sendEmail
          .calledWith('myCustomTemplate')
          .should.equal(true)
      })
    })
  })

  describe('confirmEmailFromToken', function () {
    beforeEach(function (ctx) {
      ctx.OneTimeTokenHandler.promises.peekValueFromToken = sinon
        .stub()
        .resolves({ data: { user_id: ctx.user_id, email: ctx.email } })
      ctx.OneTimeTokenHandler.promises.expireToken = sinon.stub().resolves()
      ctx.UserUpdater.promises.confirmEmail = sinon.stub().resolves()
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        await ctx.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
          ctx.req,
          (ctx.token = 'mock-token')
        )
      })

      it('should call peekValueFromToken', function (ctx) {
        return ctx.OneTimeTokenHandler.promises.peekValueFromToken
          .calledWith('email_confirmation', ctx.token)
          .should.equal(true)
      })

      it('should call expireToken', function (ctx) {
        return ctx.OneTimeTokenHandler.promises.expireToken
          .calledWith('email_confirmation', ctx.token)
          .should.equal(true)
      })

      it('should confirm the email of the user_id', function (ctx) {
        return ctx.UserUpdater.promises.confirmEmail
          .calledWith(ctx.user_id, ctx.email)
          .should.equal(true)
      })
    })

    describe('with an expired token', function () {
      beforeEach(function (ctx) {
        ctx.OneTimeTokenHandler.promises.peekValueFromToken = sinon
          .stub()
          .rejects(new Errors.NotFoundError('no token found'))
      })

      it('should reject with a NotFoundError', async function (ctx) {
        await expect(
          ctx.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
            ctx.req,
            (ctx.token = 'mock-token')
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('with no user_id in the token', function () {
      beforeEach(function (ctx) {
        ctx.OneTimeTokenHandler.promises.peekValueFromToken = sinon
          .stub()
          .resolves({ data: { email: ctx.email } })
      })

      it('should reject with a NotFoundError', async function (ctx) {
        await expect(
          ctx.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
            ctx.req,
            (ctx.token = 'mock-token')
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('with no email in the token', function () {
      beforeEach(function (ctx) {
        ctx.OneTimeTokenHandler.promises.peekValueFromToken = sinon
          .stub()
          .resolves({ data: { user_id: ctx.user_id } })
      })

      it('should reject with a NotFoundError', async function (ctx) {
        await expect(
          ctx.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
            ctx.req,
            (ctx.token = 'mock-token')
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('with no user found', function () {
      beforeEach(function (ctx) {
        ctx.UserGetter.promises.getUser.resolves(null)
      })

      it('should reject with a NotFoundError', async function (ctx) {
        await expect(
          ctx.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
            ctx.req,
            (ctx.token = 'mock-token')
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('with secondary email missing on user', function () {
      beforeEach(function (ctx) {
        ctx.OneTimeTokenHandler.promises.peekValueFromToken = sinon
          .stub()
          .resolves({
            data: { user_id: ctx.user_id, email: 'deleted@email.com' },
          })
      })

      it('should reject with a NotFoundError', async function (ctx) {
        await expect(
          ctx.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
            ctx.req,
            (ctx.token = 'mock-token')
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('when the logged in user is not the token user', function () {
      beforeEach(function (ctx) {
        ctx.SessionManager.getLoggedInUserId = sinon
          .stub()
          .returns('other-user-id')
      })

      it('should reject with a ForbiddenError', async function (ctx) {
        await expect(
          ctx.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
            ctx.req,
            (ctx.token = 'mock-token')
          )
        ).to.be.rejectedWith(Errors.ForbiddenError)
      })
    })
  })
})
