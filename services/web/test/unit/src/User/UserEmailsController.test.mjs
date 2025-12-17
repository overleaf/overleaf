import { vi, assert, expect } from 'vitest'
import { setTimeout } from 'node:timers/promises'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const modulePath = '../../../../app/src/Features/User/UserEmailsController.mjs'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('UserEmailsController', function () {
  beforeEach(async function (ctx) {
    ctx.req = new MockRequest(vi)
    ctx.req.sessionID = Math.random().toString()
    ctx.res = new MockResponse(vi)
    ctx.next = vi.fn()
    ctx.user = {
      _id: 'mock-user-id',
      email: 'example@overleaf.com',
      emails: [],
    }

    ctx.UserGetter = {
      getUser: vi.fn().mockImplementation((userId, projection, callback) => {
        callback?.(null, ctx.user)
      }),
      getUserFullEmails: vi.fn(),
      promises: {
        ensureUniqueEmailAddress: vi.fn().mockResolvedValue(undefined),
        getUser: vi.fn().mockResolvedValue(ctx.user),
        getUserByAnyEmail: vi.fn(),
      },
    }
    ctx.SessionManager = {
      getSessionUser: vi.fn().mockReturnValue(ctx.user),
      getLoggedInUserId: vi.fn().mockReturnValue(ctx.user._id),
      setInSessionUser: vi.fn(),
    }
    ctx.Features = {
      hasFeature: vi.fn(),
    }
    ctx.UserSessionsManager = {
      promises: {
        removeSessionsFromRedis: vi.fn().mockResolvedValue(undefined),
      },
    }
    ctx.UserUpdater = {
      addEmailAddress: vi.fn(),
      updateV1AndSetDefaultEmailAddress: vi.fn(),
      promises: {
        addEmailAddress: vi.fn().mockResolvedValue(undefined),
        confirmEmail: vi.fn().mockResolvedValue(undefined),
        removeEmailAddress: vi.fn(),
        setDefaultEmailAddress: vi.fn().mockResolvedValue(undefined),
      },
    }
    ctx.EmailHelper = { parseEmail: vi.fn() }
    ctx.endorseAffiliation = vi.fn((userId, email, role, dept, callback) =>
      callback()
    )
    ctx.InstitutionsAPI = {
      endorseAffiliation: ctx.endorseAffiliation,
    }
    ctx.HttpErrorHandler = { conflict: vi.fn() }
    ctx.AnalyticsManager = {
      recordEventForUserInBackground: vi.fn(),
    }
    ctx.UserAuditLogHandler = {
      addEntry: vi.fn((userId, op, initiatorId, ip, info, callback) =>
        callback()
      ),
      promises: {
        addEntry: vi.fn().mockResolvedValue(undefined),
      },
    }
    ctx.rateLimiter = {
      consume: vi.fn().mockResolvedValue(undefined),
    }
    ctx.RateLimiter = {
      RateLimiter: vi.fn().mockImplementation(function RateLimiter() {
        this.consume = ctx.rateLimiter.consume
      }),
    }
    ctx.AuthenticationController = {
      getRedirectFromSession: vi.fn().mockReturnValue(null),
    }

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationController',
      () => ({
        default: ctx.AuthenticationController,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: ctx.Features,
    }))

    vi.doMock('../../../../app/src/Features/User/UserSessionsManager', () => ({
      default: ctx.UserSessionsManager,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: ctx.UserUpdater,
    }))

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: (ctx.EmailHandler = {
        promises: {
          sendEmail: vi.fn().mockResolvedValue(undefined),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/Helpers/EmailHelper', () => ({
      default: ctx.EmailHelper,
    }))

    vi.doMock(
      '../../../../app/src/Features/User/UserEmailsConfirmationHandler',
      () => ({
        default: (ctx.UserEmailsConfirmationHandler = {
          promises: {
            sendConfirmationEmail: vi.fn().mockResolvedValue(undefined),
          },
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsAPI',
      () => ({
        default: ctx.InstitutionsAPI,
      })
    )

    vi.doMock('../../../../app/src/Features/Errors/HttpErrorHandler', () => ({
      default: ctx.HttpErrorHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserAuditLogHandler', () => ({
      default: ctx.UserAuditLogHandler,
    }))

    vi.doMock(
      '../../../../app/src/infrastructure/RateLimiter',
      () => ctx.RateLimiter
    )

    ctx.UserEmailsController = (await import(modulePath)).default
  })

  describe('List', function () {
    beforeEach(function () {})

    it('lists emails', async function (ctx) {
      expect.assertions(1)
      const fullEmails = [{ some: 'data' }]
      ctx.UserGetter.getUserFullEmails.mockImplementation(
        (userId, callback) => {
          callback(null, fullEmails)
        }
      )

      await ctx.UserEmailsController.list(ctx.req, {
        json: response => {
          assert.deepEqual(response, fullEmails)
          expect(ctx.UserGetter.getUserFullEmails).toHaveBeenCalledWith(
            ctx.user._id,
            expect.any(Function)
          )
        },
      })
    })
  })

  describe('addWithConfirmationCode', function () {
    beforeEach(function (ctx) {
      ctx.newEmail = 'new_email@baz.com'
      ctx.req.body = {
        email: ctx.newEmail,
      }
      ctx.EmailHelper.parseEmail.mockReturnValue(ctx.newEmail)
      ctx.UserEmailsConfirmationHandler.promises.sendConfirmationCode = vi
        .fn()
        .mockResolvedValue({
          confirmCode: '123456',
          confirmCodeExpiresTimestamp: new Date(),
        })
    })

    it('sends an email confirmation', async function (ctx) {
      expect.assertions(2)
      await ctx.UserEmailsController.addWithConfirmationCode(ctx.req, {
        sendStatus: code => {
          expect(code).to.equal(200)
          expect(
            ctx.UserEmailsConfirmationHandler.promises.sendConfirmationCode
          ).toHaveBeenCalledWith(ctx.newEmail, false)
        },
      })
    })

    it('handles email parse error', async function (ctx) {
      expect.assertions(1)
      ctx.EmailHelper.parseEmail.mockReturnValue(null)
      await ctx.UserEmailsController.addWithConfirmationCode(ctx.req, {
        sendStatus: code => {
          expect(code).to.equal(422)
        },
      })
    })

    it('handles when the email already exists', async function (ctx) {
      expect.assertions(1)
      ctx.UserGetter.promises.ensureUniqueEmailAddress.mockRejectedValue(
        new Errors.EmailExistsError()
      )

      await ctx.UserEmailsController.addWithConfirmationCode(ctx.req, {
        status: code => {
          expect(code).to.equal(409)
          return { json: () => {} }
        },
      })
    })

    it('should fail to add new emails when the limit has been reached', async function (ctx) {
      expect.assertions(2)
      ctx.user.emails = []
      for (let i = 0; i < 10; i++) {
        ctx.user.emails.push({ email: `example${i}@overleaf.com` })
      }
      await ctx.UserEmailsController.addWithConfirmationCode(ctx.req, {
        status: code => {
          expect(code).to.equal(422)
          return {
            json: error => {
              expect(error.message).to.equal('secondary email limit exceeded')
            },
          }
        },
      })
    })
  })

  describe('checkNewSecondaryEmailConfirmationCode', function () {
    beforeEach(function (ctx) {
      ctx.newEmail = 'new_email@baz.com'
      ctx.req.session.pendingSecondaryEmail = {
        confirmCode: '123456',
        email: ctx.newEmail,
        confirmCodeExpiresTimestamp: new Date(Math.max),
      }
    })

    describe('with a valid confirmation code', function () {
      beforeEach(function (ctx) {
        ctx.req.body = {
          code: '123456',
        }
      })

      it('adds the email', async function (ctx) {
        expect.assertions(2)
        await ctx.UserEmailsController.checkNewSecondaryEmailConfirmationCode(
          ctx.req,
          {
            json: () => {
              expect(
                ctx.UserUpdater.promises.addEmailAddress
              ).toHaveBeenCalledWith(ctx.user._id, ctx.newEmail, undefined, {
                initiatorId: 'mock-user-id',
                ipAddress: '42.42.42.42',
              })
              expect(
                ctx.UserUpdater.promises.confirmEmail
              ).toHaveBeenCalledWith(ctx.user._id, ctx.newEmail, undefined)
            },
          }
        )
      })

      it('redirects to /project', async function (ctx) {
        expect.assertions(1)
        await ctx.UserEmailsController.checkNewSecondaryEmailConfirmationCode(
          ctx.req,
          {
            json: ({ redir }) => {
              expect(redir).to.equal('/project')
            },
          }
        )
      })

      it('sends a security alert email', async function (ctx) {
        expect.assertions(4)
        ctx.req.session.pendingSecondaryEmail = {
          confirmCode: '123456',
          email: ctx.newEmail,
          confirmCodeExpiresTimestamp: new Date(Math.max),
          affiliationOptions: {},
        }
        ctx.req.body.code = '123456'

        await ctx.UserEmailsController.checkNewSecondaryEmailConfirmationCode(
          ctx.req,
          {
            json: vi.fn().mockResolvedValue(undefined),
          }
        )

        const emailCall = ctx.EmailHandler.promises.sendEmail.mock.calls[0]
        expect(emailCall[0]).to.equal('securityAlert')
        expect(emailCall[1].to).to.equal(ctx.user.email)
        expect(emailCall[1].actionDescribed).to.contain(
          'a secondary email address'
        )
        expect(emailCall[1].message[0]).to.contain(ctx.newEmail)
      })
    })

    describe('with an invalid confirmation code', function () {
      beforeEach(function (ctx) {
        ctx.req.body = {
          code: '999999',
        }
      })

      it('does not add the email', async function (ctx) {
        expect.assertions(2)
        await ctx.UserEmailsController.checkNewSecondaryEmailConfirmationCode(
          ctx.req,
          {
            status: () => {
              expect(
                ctx.UserUpdater.promises.addEmailAddress
              ).not.toHaveBeenCalled()
              expect(
                ctx.UserUpdater.promises.confirmEmail
              ).not.toHaveBeenCalled()
              return { json: ctx.next }
            },
          }
        )
      })

      it('responds with a 403', async function (ctx) {
        expect.assertions(1)
        await ctx.UserEmailsController.checkNewSecondaryEmailConfirmationCode(
          ctx.req,
          {
            status: code => {
              expect(code).to.equal(403)
              return { json: ctx.next }
            },
          }
        )
      })
    })
  })

  describe('resendNewSecondaryEmailConfirmationCode', function () {
    beforeEach(function (ctx) {
      ctx.newEmail = 'new_email@baz.com'
      ctx.req.session.pendingSecondaryEmail = {
        confirmCode: '123456',
        email: ctx.newEmail,
        confirmCodeExpiresTimestamp: new Date(Math.max),
      }
      ctx.UserEmailsConfirmationHandler.promises.sendConfirmationCode = vi
        .fn()
        .mockResolvedValue({
          confirmCode: '123456',
          confirmCodeExpiresTimestamp: new Date(),
        })
    })

    it('should send the email', async function (ctx) {
      expect.assertions(2)
      await ctx.UserEmailsController.resendNewSecondaryEmailConfirmationCode(
        ctx.req,
        {
          status: code => {
            expect(code).to.equal(200)
            expect(
              ctx.UserEmailsConfirmationHandler.promises.sendConfirmationCode
            ).toHaveBeenCalledWith(ctx.newEmail, false)
            return { json: ctx.next }
          },
        }
      )
    })
  })

  describe('remove', function () {
    beforeEach(function (ctx) {
      ctx.email = 'email_to_remove@bar.com'
      ctx.req.body.email = ctx.email
      ctx.EmailHelper.parseEmail.mockReturnValue(ctx.email)
    })

    it('removes email', async function (ctx) {
      expect.assertions(3)
      const auditLog = {
        initiatorId: ctx.user._id,
        ipAddress: ctx.req.ip,
      }
      ctx.UserUpdater.promises.removeEmailAddress.mockResolvedValue(undefined)

      await ctx.UserEmailsController.remove(ctx.req, {
        sendStatus: code => {
          expect(code).to.equal(200)
          expect(ctx.EmailHelper.parseEmail).toHaveBeenCalledWith(ctx.email)
          expect(
            ctx.UserUpdater.promises.removeEmailAddress
          ).toHaveBeenCalledWith(ctx.user._id, ctx.email, auditLog)
        },
      })
    })

    it('handles email parse error', async function (ctx) {
      expect.assertions(2)
      ctx.EmailHelper.parseEmail.mockReturnValue(null)

      await ctx.UserEmailsController.remove(ctx.req, {
        sendStatus: code => {
          expect(code).to.equal(422)
          expect(
            ctx.UserUpdater.promises.removeEmailAddress
          ).not.toHaveBeenCalled()
        },
      })
    })
  })

  describe('setDefault', function () {
    beforeEach(function (ctx) {
      ctx.email = 'email_to_set_default@bar.com'
      ctx.req.body.email = ctx.email
      ctx.EmailHelper.parseEmail.mockReturnValue(ctx.email)
      ctx.SessionManager.setInSessionUser.mockReturnValue(null)
    })

    it('sets default email', async function (ctx) {
      expect.assertions(4)
      await ctx.UserEmailsController.setDefault(ctx.req, {
        sendStatus: code => {
          expect(code).to.equal(200)
          expect(ctx.EmailHelper.parseEmail).toHaveBeenCalledWith(ctx.email)
          expect(ctx.SessionManager.setInSessionUser).toHaveBeenCalledWith(
            ctx.req.session,
            {
              email: ctx.email,
            }
          )
          expect(
            ctx.UserUpdater.promises.setDefaultEmailAddress
          ).toHaveBeenCalledWith(
            ctx.user._id,
            ctx.email,
            false,
            { initiatorId: 'mock-user-id', ipAddress: '42.42.42.42' },
            true,
            false
          )
        },
      })
    })

    it('deletes unconfirmed primary if delete-unconfirmed-primary is set', async function (ctx) {
      expect.assertions(1)
      ctx.user.emails = [{ email: 'example@overleaf.com' }]
      ctx.req.query['delete-unconfirmed-primary'] = ''

      await ctx.UserEmailsController.setDefault(ctx.req, {
        sendStatus: () => {
          expect(
            ctx.UserUpdater.promises.removeEmailAddress
          ).toHaveBeenCalledWith(ctx.user._id, 'example@overleaf.com', {
            initiatorId: ctx.user._id,
            ipAddress: ctx.req.ip,
            extraInfo: {
              info: 'removed unconfirmed email after setting new primary',
            },
          })
        },
      })
    })

    it('doesnt delete a confirmed primary', async function (ctx) {
      expect.assertions(1)
      ctx.user.emails = [
        { email: 'example@overleaf.com', confirmedAt: '2000-01-01' },
      ]
      ctx.req.query['delete-unconfirmed-primary'] = ''

      await ctx.UserEmailsController.setDefault(ctx.req, {
        sendStatus: () => {
          expect(
            ctx.UserUpdater.promises.removeEmailAddress
          ).not.toHaveBeenCalled()
        },
      })
    })

    it('doesnt delete primary if delete-unconfirmed-primary is not set', async function (ctx) {
      await ctx.UserEmailsController.setDefault(ctx.req, {
        sendStatus: () => {
          expect(
            ctx.UserUpdater.promises.removeEmailAddress
          ).not.toHaveBeenCalled()
        },
      })
    })

    it('handles email parse error', async function (ctx) {
      expect.assertions(2)
      ctx.EmailHelper.parseEmail.mockReturnValue(null)

      await ctx.UserEmailsController.setDefault(ctx.req, {
        sendStatus: code => {
          expect(code).to.equal(422)
          expect(
            ctx.UserUpdater.promises.setDefaultEmailAddress
          ).not.toHaveBeenCalled()
        },
      })
    })

    it('should reset the users other sessions', async function (ctx) {
      await ctx.UserEmailsController.setDefault(ctx.req, ctx.res)
      expect(
        ctx.UserSessionsManager.promises.removeSessionsFromRedis
      ).toHaveBeenCalledWith(ctx.user, ctx.req.sessionID)
    })

    it('handles error from revoking sessions and returns 200', async function (ctx) {
      const redisError = new Error('redis error')
      ctx.UserSessionsManager.promises.removeSessionsFromRedis = vi
        .fn()
        .mockRejectedValue(redisError)

      await ctx.UserEmailsController.setDefault(ctx.req, ctx.res)
      expect(ctx.res.statusCode).to.equal(200)

      // give revoke process time to run
      await setTimeout(0)
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: redisError }),
        'failed revoking secondary sessions after changing default email'
      )
    })
  })

  describe('endorse', function () {
    beforeEach(function (ctx) {
      ctx.email = 'email_to_endorse@bar.com'
      ctx.req.body.email = ctx.email
      ctx.EmailHelper.parseEmail.mockReturnValue(ctx.email)
    })

    it('endorses affiliation', async function (ctx) {
      expect.assertions(2)
      ctx.req.body.role = 'Role'
      ctx.req.body.department = 'Department'

      await ctx.UserEmailsController.endorse(ctx.req, {
        sendStatus: code => {
          expect(code).to.equal(204)
          expect(ctx.endorseAffiliation).toHaveBeenCalledWith(
            ctx.user._id,
            ctx.email,
            'Role',
            'Department',
            expect.any(Function)
          )
        },
      })
    })
  })

  describe('confirm', function () {
    beforeEach(function (ctx) {
      ctx.UserEmailsConfirmationHandler.confirmEmailFromToken = vi
        .fn()
        .mockImplementation((req, token, callback) => {
          callback(null, { userId: ctx.user._id, email: ctx.user.email })
        })
      ctx.token = 'mock-token'
      ctx.req.body = { token: ctx.token }
      ctx.req.ip = '0.0.0.0'
      ctx.next = vi.fn()
      ctx.res = new MockResponse(vi)
    })

    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.UserEmailsController.confirm(ctx.req, ctx.res, ctx.next)
      })

      it('should confirm the email from the token', function (ctx) {
        expect(
          ctx.UserEmailsConfirmationHandler.confirmEmailFromToken
        ).toHaveBeenCalledWith(ctx.req, ctx.token, expect.any(Function))
      })

      it('should return a 200 status', function (ctx) {
        expect(ctx.res.sendStatus).toHaveBeenCalledWith(200)
      })

      it('should log the confirmation to the audit log', function (ctx) {
        expect(ctx.UserAuditLogHandler.addEntry).toHaveBeenCalledWith(
          ctx.user._id,
          'confirm-email',
          ctx.user._id,
          ctx.req.ip,
          {
            token: ctx.token.substring(0, 10),
            email: ctx.user.email,
          },
          expect.any(Function)
        )
      })
    })

    describe('without a token', function () {
      beforeEach(function (ctx) {
        ctx.req.body.token = null
        ctx.UserEmailsController.confirm(ctx.req, ctx.res, ctx.next)
      })

      it('should return a 422 status', function (ctx) {
        expect(ctx.res.status).toHaveBeenCalledWith(422)
      })
    })
    describe('when confirming fails', function () {
      beforeEach(function (ctx) {
        ctx.UserEmailsConfirmationHandler.confirmEmailFromToken = vi
          .fn()
          .mockImplementation((req, token, callback) => {
            callback(new Errors.NotFoundError('not found'))
          })
      })

      it('should return a 404 error code with a message', function (ctx) {
        ctx.UserEmailsController.confirm(ctx.req, ctx.res, ctx.next)
        expect(ctx.res.status).toHaveBeenCalledWith(404)
        expect(ctx.res.json).toHaveBeenCalledWith({
          message: ctx.req.i18n.translate('confirmation_token_invalid'),
        })
      })
    })
  })

  describe('sendExistingEmailConfirmationCode', function () {
    beforeEach(function (ctx) {
      ctx.email = 'existing-email@example.com'
      ctx.req.body.email = ctx.email
      ctx.EmailHelper.parseEmail.mockReturnValue(ctx.email)
      ctx.UserGetter.promises.getUserByAnyEmail.mockResolvedValue({
        _id: ctx.user._id,
        email: ctx.email,
      })
      ctx.UserEmailsConfirmationHandler.promises.sendConfirmationCode = vi
        .fn()
        .mockResolvedValue({
          confirmCode: '123456',
          confirmCodeExpiresTimestamp: new Date(),
        })
    })

    it('should send confirmation code for existing email', async function (ctx) {
      expect.assertions(2)
      await ctx.UserEmailsController.sendExistingEmailConfirmationCode(
        ctx.req,
        {
          sendStatus: code => {
            expect(code).to.equal(204)
            expect(
              ctx.UserEmailsConfirmationHandler.promises.sendConfirmationCode
            ).toHaveBeenCalledWith(ctx.email, false)
          },
        }
      )
    })

    it('should store confirmation code in session', async function (ctx) {
      const confirmCode = '123456'
      const confirmCodeExpiresTimestamp = new Date()
      ctx.UserEmailsConfirmationHandler.promises.sendConfirmationCode.mockResolvedValue(
        {
          confirmCode,
          confirmCodeExpiresTimestamp,
        }
      )
      await ctx.UserEmailsController.sendExistingEmailConfirmationCode(
        ctx.req,
        { sendStatus: vi.fn() }
      )
      expect(ctx.req.session.pendingExistingEmail).to.deep.equal({
        email: ctx.email,
        confirmCode,
        confirmCodeExpiresTimestamp,
        affiliationOptions: undefined,
      })
    })

    it('should handle invalid email', async function (ctx) {
      expect.assertions(2)
      ctx.EmailHelper.parseEmail.mockReturnValue(null)
      await ctx.UserEmailsController.sendExistingEmailConfirmationCode(
        ctx.req,
        {
          sendStatus: code => {
            expect(code).to.equal(400)
            expect(
              ctx.UserEmailsConfirmationHandler.promises.sendConfirmationCode
            ).not.toHaveBeenCalled()
          },
        }
      )
    })

    it('should handle email not belonging to user', async function (ctx) {
      expect.assertions(2)
      ctx.UserGetter.promises.getUserByAnyEmail.mockResolvedValue({
        _id: 'another-user-id',
      })
      await ctx.UserEmailsController.sendExistingEmailConfirmationCode(
        ctx.req,
        {
          sendStatus: code => {
            expect(code).to.equal(422)
            expect(
              ctx.UserEmailsConfirmationHandler.promises.sendConfirmationCode
            ).not.toHaveBeenCalled()
          },
        }
      )
    })
  })

  describe('checkExistingEmailConfirmationCode', function () {
    beforeEach(function (ctx) {
      ctx.email = 'existing-email@example.com'
      ctx.req.session.pendingExistingEmail = {
        confirmCode: '123456',
        email: ctx.email,
        confirmCodeExpiresTimestamp: new Date(Math.max),
      }
      ctx.UserUpdater.promises.confirmEmail.mockResolvedValue(undefined)
      ctx.res = new MockResponse(vi)
    })

    describe('with a valid confirmation code', function () {
      beforeEach(function (ctx) {
        ctx.req.body = { code: '123456' }
      })

      it('confirms the email', async function (ctx) {
        const mockRes = new MockResponse(vi)

        await ctx.UserEmailsController.checkExistingEmailConfirmationCode(
          ctx.req,
          mockRes
        )

        expect(ctx.UserUpdater.promises.confirmEmail).toHaveBeenCalledWith(
          ctx.user._id,
          ctx.email,
          undefined
        )
      })

      it('adds audit log entry', async function (ctx) {
        await ctx.UserEmailsController.checkExistingEmailConfirmationCode(
          ctx.req,
          { json: vi.fn() }
        )
        expect(ctx.UserAuditLogHandler.promises.addEntry).toHaveBeenCalledWith(
          ctx.user._id,
          'confirm-email-via-code',
          ctx.user._id,
          ctx.req.ip,
          { email: ctx.email }
        )
      })

      it('records analytics event', async function (ctx) {
        await ctx.UserEmailsController.checkExistingEmailConfirmationCode(
          ctx.req,
          { json: vi.fn() }
        )
        expect(
          ctx.AnalyticsManager.recordEventForUserInBackground
        ).toHaveBeenCalledWith(ctx.user._id, 'email-verified', {
          provider: 'email',
          verification_type: 'token',
          isPrimary: ctx.user.email === ctx.email,
        })
      })

      it('removes pendingExistingEmail from session', async function (ctx) {
        await ctx.UserEmailsController.checkExistingEmailConfirmationCode(
          ctx.req,
          { json: vi.fn() }
        )
        expect(ctx.req.session.pendingExistingEmail).to.be.undefined
      })
    })

    describe('with an invalid confirmation code', function () {
      beforeEach(function (ctx) {
        ctx.req.body = { code: '999999' }
      })

      it('does not confirm the email', async function (ctx) {
        expect.assertions(1)
        await ctx.UserEmailsController.checkExistingEmailConfirmationCode(
          ctx.req,
          {
            status: () => {
              expect(
                ctx.UserUpdater.promises.confirmEmail
              ).not.toHaveBeenCalled()
              return { json: ctx.next }
            },
          }
        )
      })

      it('responds with a 403', async function (ctx) {
        expect.assertions(1)
        await ctx.UserEmailsController.checkExistingEmailConfirmationCode(
          ctx.req,
          {
            status: code => {
              expect(code).to.equal(403)
              return { json: ctx.next }
            },
          }
        )
      })
    })

    describe('with an expired confirmation code', function () {
      beforeEach(function (ctx) {
        ctx.req.session.pendingExistingEmail.confirmCodeExpiresTimestamp =
          new Date(0)
        ctx.req.body = { code: '123456' }
      })

      it('responds with a 403', async function (ctx) {
        expect.assertions(1)
        await ctx.UserEmailsController.checkExistingEmailConfirmationCode(
          ctx.req,
          {
            status: code => {
              expect(code).to.equal(403)
              return { json: ctx.next }
            },
          }
        )
      })
    })
  })

  describe('resendExistingSecondaryEmailConfirmationCode', function () {
    beforeEach(function (ctx) {
      ctx.email = 'existing-email@example.com'
      ctx.req.session.pendingExistingEmail = {
        confirmCode: '123456',
        email: ctx.email,
        confirmCodeExpiresTimestamp: new Date(Math.max),
      }
      ctx.res.status = vi.fn().mockReturnValue({ json: vi.fn() })
      ctx.UserEmailsConfirmationHandler.promises.sendConfirmationCode = vi
        .fn()
        .mockResolvedValue({
          confirmCode: '654321',
          confirmCodeExpiresTimestamp: new Date(),
        })
    })

    it('should resend confirmation code', async function (ctx) {
      expect.assertions(2)
      await ctx.UserEmailsController.resendExistingSecondaryEmailConfirmationCode(
        ctx.req,
        {
          status: code => {
            expect(code).to.equal(200)
            expect(
              ctx.UserEmailsConfirmationHandler.promises.sendConfirmationCode
            ).toHaveBeenCalledWith(ctx.email, false)
            return { json: vi.fn() }
          },
        }
      )
    })

    it('should update session with new code', async function (ctx) {
      const newCode = '654321'
      const newExpiryTime = new Date()
      ctx.UserEmailsConfirmationHandler.promises.sendConfirmationCode.mockResolvedValue(
        {
          confirmCode: newCode,
          confirmCodeExpiresTimestamp: newExpiryTime,
        }
      )
      await ctx.UserEmailsController.resendExistingSecondaryEmailConfirmationCode(
        ctx.req,
        { status: () => ({ json: vi.fn() }) }
      )
      expect(ctx.req.session.pendingExistingEmail.confirmCode).to.equal(newCode)
      expect(
        ctx.req.session.pendingExistingEmail.confirmCodeExpiresTimestamp
      ).to.equal(newExpiryTime)
    })

    it('should add audit log entry', async function (ctx) {
      await ctx.UserEmailsController.resendExistingSecondaryEmailConfirmationCode(
        ctx.req,
        { status: () => ({ json: vi.fn() }) }
      )
      expect(ctx.UserAuditLogHandler.promises.addEntry).toHaveBeenCalledWith(
        ctx.user._id,
        'resend-confirm-email-code',
        ctx.user._id,
        ctx.req.ip,
        { email: ctx.email }
      )
    })

    it('should handle rate limiting', async function (ctx) {
      expect.assertions(1)
      ctx.rateLimiter.consume.mockRejectedValue({ remainingPoints: 0 })
      await ctx.UserEmailsController.resendExistingSecondaryEmailConfirmationCode(
        ctx.req,
        {
          status: code => {
            expect(code).to.equal(429)
            return { json: vi.fn() }
          },
        }
      )
    })
  })
})
