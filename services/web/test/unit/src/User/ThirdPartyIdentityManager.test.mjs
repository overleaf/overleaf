import { vi, expect } from 'vitest'
import sinon from 'sinon'
import OError from '@overleaf/o-error'
import { ThirdPartyUserNotFoundError } from '../../../../app/src/Features/Errors/Errors.js'
const modulePath =
  '../../../../app/src/Features/User/ThirdPartyIdentityManager.mjs'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('ThirdPartyIdentityManager', function () {
  beforeEach(async function (ctx) {
    ctx.userId = 'a1b2c3'
    ctx.user = {
      _id: ctx.userId,
      email: 'example@overleaf.com',
    }
    ctx.externalUserId = 'id789'
    ctx.externalData = {}
    ctx.auditLog = { initiatorId: ctx.userId, ipAddress: '0:0:0:0' }

    vi.doMock('../../../../app/src/Features/User/UserAuditLogHandler', () => ({
      default: (ctx.UserAuditLogHandler = {
        promises: {
          addEntry: sinon.stub().resolves(),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: (ctx.EmailHandler = {
        promises: {
          sendEmail: sinon.stub().resolves(),
        },
      }),
    }))

    vi.doMock('../../../../app/src/models/User', () => ({
      User: (ctx.User = {
        findOneAndUpdate: sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(ctx.user) }),
        findOne: sinon.stub().returns({
          exec: sinon.stub().resolves(undefined),
        }),
      }),
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: {
        oauthProviders: {
          google: {
            name: 'Google',
          },
          orcid: {
            name: 'ORCID',
          },
        },
      },
    }))

    ctx.ThirdPartyIdentityManager = (await import(modulePath)).default
  })
  describe('getUser', function () {
    it('should throw an error when missing providerId or externalUserId', async function (ctx) {
      await expect(
        ctx.ThirdPartyIdentityManager.promises.getUser(undefined, undefined)
      ).to.be.rejectedWith(OError, `invalid SSO arguments`)
    })

    describe('when user linked', function () {
      beforeEach(function (ctx) {
        ctx.User.findOne.returns({
          exec: sinon.stub().resolves(ctx.user),
        })
      })

      it('should return the user', async function (ctx) {
        ctx.User.findOne.returns({
          exec: sinon.stub().resolves(ctx.user),
        })
        const user = await ctx.ThirdPartyIdentityManager.promises.getUser(
          'google',
          'an-id-linked'
        )
        expect(user).to.deep.equal(ctx.user)
      })
    })
    it('should throw ThirdPartyUserNotFoundError when no user linked', async function (ctx) {
      await expect(
        ctx.ThirdPartyIdentityManager.promises.getUser(
          'google',
          'an-id-not-linked'
        )
      ).to.be.rejectedWith(ThirdPartyUserNotFoundError)
    })
  })
  describe('link', function () {
    it('should send email alert', async function (ctx) {
      await ctx.ThirdPartyIdentityManager.promises.link(
        ctx.userId,
        'google',
        ctx.externalUserId,
        ctx.externalData,
        ctx.auditLog
      )
      const emailCall = ctx.EmailHandler.promises.sendEmail.getCall(0)
      expect(emailCall.args[0]).to.equal('securityAlert')
      expect(emailCall.args[1].actionDescribed).to.contain(
        'a Google account was linked'
      )
    })

    it('should update user audit log', async function (ctx) {
      await ctx.ThirdPartyIdentityManager.promises.link(
        ctx.userId,
        'google',
        ctx.externalUserId,
        ctx.externalData,
        ctx.auditLog
      )
      expect(
        ctx.UserAuditLogHandler.promises.addEntry
      ).to.have.been.calledOnceWith(
        ctx.userId,
        'link-sso',
        ctx.auditLog.initiatorId,
        ctx.auditLog.ipAddress,
        {
          providerId: 'google',
        }
      )
    })
    describe('errors', function () {
      const anError = new Error('oops')

      it('should not unlink if the UserAuditLogHandler throws an error', async function (ctx) {
        ctx.UserAuditLogHandler.promises.addEntry.throws(anError)
        await expect(
          ctx.ThirdPartyIdentityManager.promises.link(
            ctx.userId,
            'google',
            ctx.externalUserId,
            ctx.externalData,
            ctx.auditLog
          )
        ).to.be.rejectedWith(anError)
        expect(ctx.User.findOneAndUpdate).to.not.have.been.called
      })

      describe('EmailHandler', function () {
        beforeEach(function (ctx) {
          ctx.EmailHandler.promises.sendEmail.rejects(anError)
        })
        it('should log but not return the error', async function (ctx) {
          await expect(
            ctx.ThirdPartyIdentityManager.promises.link(
              ctx.userId,
              'google',
              ctx.externalUserId,
              ctx.externalData,
              ctx.auditLog
            )
          ).to.be.fulfilled
          expect(ctx.logger.error).toBeCalledWith(
            {
              err: anError,
              userId: ctx.userId,
            },
            'could not send security alert email when new account linked'
          )
        })
      })
    })
  })

  describe('unlink', function () {
    it('should send email alert', async function (ctx) {
      await ctx.ThirdPartyIdentityManager.promises.unlink(
        ctx.userId,
        'orcid',
        ctx.auditLog
      )
      const emailCall = ctx.EmailHandler.promises.sendEmail.getCall(0)
      expect(emailCall.args[0]).to.equal('securityAlert')
      expect(emailCall.args[1].actionDescribed).to.contain(
        'an ORCID account was unlinked from'
      )
    })
    it('should update user audit log', async function (ctx) {
      await ctx.ThirdPartyIdentityManager.promises.unlink(
        ctx.userId,
        'orcid',
        ctx.auditLog
      )
      expect(
        ctx.UserAuditLogHandler.promises.addEntry
      ).to.have.been.calledOnceWith(
        ctx.userId,
        'unlink-sso',
        ctx.auditLog.initiatorId,
        ctx.auditLog.ipAddress,
        {
          providerId: 'orcid',
        }
      )
    })

    describe('errors', function () {
      const anError = new Error('oops')

      it('should not unlink if the UserAuditLogHandler throws an error', async function (ctx) {
        ctx.UserAuditLogHandler.promises.addEntry.throws(anError)

        await expect(
          ctx.ThirdPartyIdentityManager.promises.unlink(
            ctx.userId,
            'orcid',
            ctx.auditLog
          )
        ).to.be.rejectedWith(anError)

        expect(ctx.User.findOneAndUpdate).to.not.have.been.called
      })

      describe('EmailHandler', function () {
        beforeEach(function (ctx) {
          ctx.EmailHandler.promises.sendEmail.rejects(anError)
        })
        it('should log but not return the error', async function (ctx) {
          await expect(
            ctx.ThirdPartyIdentityManager.promises.unlink(
              ctx.userId,
              'google',
              ctx.auditLog
            )
          ).to.be.fulfilled

          expect(ctx.logger.error).toBeCalledWith(
            {
              err: anError,
              userId: ctx.userId,
            },
            'could not send security alert email when account no longer linked'
          )
        })
      })
    })
  })
})
