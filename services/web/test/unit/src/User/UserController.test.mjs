import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import OError from '@overleaf/o-error'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
const modulePath = '../../../../app/src/Features/User/UserController.mjs'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () => {
  return vi.importActual('../../../../app/src/Features/Errors/Errors.js')
})

describe('UserController', function () {
  beforeEach(async function (ctx) {
    ctx.user_id = '323123'

    ctx.user = {
      _id: ctx.user_id,
      email: 'email@overleaf.com',
      save: sinon.stub().resolves(),
      ace: {},
    }

    ctx.req = {
      user: {},
      session: {
        destroy() {},
        user: {
          _id: ctx.user_id,
          email: 'old@something.com',
        },
        analyticsId: ctx.user_id,
      },
      sessionID: '123',
      body: {},
      i18n: {
        translate: text => text,
      },
      ip: '0:0:0:0',
      query: {},
      headers: {},
      logger: {
        addFields: sinon.stub(),
      },
    }

    ctx.UserDeleter = { promises: { deleteUser: sinon.stub().resolves() } }

    ctx.UserGetter = {
      promises: { getUser: sinon.stub().resolves(ctx.user) },
    }

    ctx.User = {
      findById: sinon.stub().returns({ exec: sinon.stub().resolves(ctx.user) }),
    }

    ctx.NewsLetterManager = {
      promises: {
        subscribe: sinon.stub().resolves(),
        unsubscribe: sinon.stub().resolves(),
      },
    }

    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(ctx.user._id),
      getSessionUser: sinon.stub().returns(ctx.req.session.user),
      setInSessionUser: sinon.stub(),
    }

    ctx.AuthenticationManager = {
      promises: {
        authenticate: sinon.stub(),
        setUserPassword: sinon.stub(),
      },
      getMessageForInvalidPasswordError: sinon
        .stub()
        .returns({ type: 'error', key: 'some-key' }),
    }

    ctx.UserUpdater = {
      promises: {
        changeEmailAddress: sinon.stub().resolves(),
        confirmEmail: sinon.stub().resolves(),
        addAffiliationForNewUser: sinon.stub().resolves(),
      },
    }

    ctx.settings = { siteUrl: 'overleaf.example.com' }

    ctx.UserHandler = {
      promises: { populateTeamInvites: sinon.stub().resolves() },
    }

    ctx.UserSessionsManager = {
      promises: {
        getAllUserSessions: sinon.stub().resolves(),
        removeSessionsFromRedis: sinon.stub().resolves(),
        untrackSession: sinon.stub().resolves(),
      },
    }

    ctx.HttpErrorHandler = {
      badRequest: sinon.stub(),
      conflict: sinon.stub(),
      unprocessableEntity: sinon.stub(),
      legacyInternal: sinon.stub(),
    }

    ctx.UrlHelper = {
      getSafeRedirectPath: sinon.stub(),
    }
    ctx.UrlHelper.getSafeRedirectPath
      .withArgs('https://evil.com')
      .returns(undefined)
    ctx.UrlHelper.getSafeRedirectPath.returnsArg(0)

    ctx.Features = {
      hasFeature: sinon.stub(),
    }

    ctx.UserAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
      addEntryInBackground: sinon.stub(),
    }

    ctx.RequestContentTypeDetection = {
      acceptsJson: sinon.stub().returns(false),
    }

    ctx.EmailHandler = {
      promises: { sendEmail: sinon.stub().resolves() },
    }

    ctx.OneTimeTokenHandler = {
      promises: { expireAllTokensForUser: sinon.stub().resolves() },
    }

    ctx.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves(),
        },
      },
    }

    vi.doMock('../../../../app/src/Features/Helpers/UrlHelper', () => ({
      default: ctx.UrlHelper,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/User/UserDeleter', () => ({
      default: ctx.UserDeleter,
    }))

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: ctx.UserUpdater,
    }))

    vi.doMock('../../../../app/src/models/User', () => ({
      User: ctx.User,
    }))

    vi.doMock(
      '../../../../app/src/Features/Newsletter/NewsletterManager',
      () => ({
        default: ctx.NewsLetterManager,
      })
    )

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

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationManager',
      () => ({
        default: ctx.AuthenticationManager,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: ctx.Features,
    }))

    vi.doMock('../../../../app/src/Features/User/UserAuditLogHandler', () => ({
      default: ctx.UserAuditLogHandler,
    }))

    vi.doMock('../../../../app/src/Features/User/UserHandler', () => ({
      default: ctx.UserHandler,
    }))

    vi.doMock('../../../../app/src/Features/User/UserSessionsManager', () => ({
      default: ctx.UserSessionsManager,
    }))

    vi.doMock('../../../../app/src/Features/Errors/HttpErrorHandler', () => ({
      default: ctx.HttpErrorHandler,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('@overleaf/o-error', () => ({
      default: OError,
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
      '../../../../app/src/infrastructure/RequestContentTypeDetection',
      () => ctx.RequestContentTypeDetection
    )

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    ctx.UserController = (await import(modulePath)).default

    ctx.res = {
      send: sinon.stub(),
      status: sinon.stub(),
      sendStatus: sinon.stub(),
      json: sinon.stub(),
    }
    ctx.res.status.returns(ctx.res)
    ctx.next = sinon.stub()
    ctx.callback = sinon.stub()
  })

  describe('tryDeleteUser', function () {
    beforeEach(function (ctx) {
      ctx.req.body.password = 'wat'
      ctx.req.logout = sinon.stub().yields()
      ctx.req.session.destroy = sinon.stub().yields()
      ctx.SessionManager.getLoggedInUserId = sinon.stub().returns(ctx.user._id)
      ctx.AuthenticationManager.promises.authenticate.resolves({
        user: ctx.user,
      })
    })

    it('should send 200', function (ctx) {
      return new Promise(resolve => {
        ctx.res.sendStatus = code => {
          code.should.equal(200)
          resolve()
        }
        ctx.UserController.tryDeleteUser(ctx.req, ctx.res, ctx.next)
      })
    })

    it('should try to authenticate user', function (ctx) {
      return new Promise(resolve => {
        ctx.res.sendStatus = code => {
          ctx.AuthenticationManager.promises.authenticate.should.have.been
            .calledOnce
          ctx.AuthenticationManager.promises.authenticate.should.have.been.calledWith(
            { _id: ctx.user._id },
            ctx.req.body.password
          )
          resolve()
        }
        ctx.UserController.tryDeleteUser(ctx.req, ctx.res, ctx.next)
      })
    })

    it('should delete the user', function (ctx) {
      return new Promise(resolve => {
        ctx.res.sendStatus = code => {
          ctx.UserDeleter.promises.deleteUser.should.have.been.calledOnce
          ctx.UserDeleter.promises.deleteUser.should.have.been.calledWith(
            ctx.user._id
          )
          resolve()
        }
        ctx.UserController.tryDeleteUser(ctx.req, ctx.res, ctx.next)
      })
    })

    it('should call hook to try to delete v1 account', function (ctx) {
      return new Promise(resolve => {
        ctx.res.sendStatus = code => {
          expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
            'tryDeleteV1Account',
            ctx.user
          )
          resolve()
        }
        ctx.UserController.tryDeleteUser(ctx.req, ctx.res, ctx.next)
      })
    })

    describe('when no password is supplied', function () {
      beforeEach(function (ctx) {
        ctx.req.body.password = ''
      })

      it('should return 403', function (ctx) {
        return new Promise(resolve => {
          ctx.res.sendStatus = code => {
            code.should.equal(403)
            resolve()
          }
          ctx.UserController.tryDeleteUser(ctx.req, ctx.res, ctx.next)
        })
      })
    })

    describe('when authenticate produces an error', function () {
      beforeEach(function (ctx) {
        ctx.AuthenticationManager.promises.authenticate.rejects(
          new Error('woops')
        )
      })

      it('should call next with an error', function (ctx) {
        return new Promise(resolve => {
          ctx.next = err => {
            expect(err).to.not.equal(null)
            expect(err).to.be.instanceof(Error)
            resolve()
          }
          ctx.UserController.tryDeleteUser(ctx.req, ctx.res, ctx.next)
        })
      })
    })

    describe('when authenticate does not produce a user', function () {
      beforeEach(function (ctx) {
        ctx.AuthenticationManager.promises.authenticate.resolves({
          user: null,
        })
      })

      it('should return 403', function (ctx) {
        return new Promise(resolve => {
          ctx.res.sendStatus = code => {
            code.should.equal(403)
            resolve()
          }
          ctx.UserController.tryDeleteUser(ctx.req, ctx.res, ctx.next)
        })
      })
    })

    describe('when deleteUser produces an error', function () {
      beforeEach(function (ctx) {
        ctx.UserDeleter.promises.deleteUser.rejects(new Error('woops'))
      })

      it('should call next with an error', function (ctx) {
        return new Promise(resolve => {
          ctx.next = err => {
            expect(err).to.not.equal(null)
            expect(err).to.be.instanceof(Error)
            resolve()
          }
          ctx.UserController.tryDeleteUser(ctx.req, ctx.res, ctx.next)
        })
      })
    })

    describe('when deleteUser produces a known error', function () {
      beforeEach(function (ctx) {
        ctx.UserDeleter.promises.deleteUser.rejects(
          new Errors.SubscriptionAdminDeletionError()
        )
      })

      it('should return a HTTP Unprocessable Entity error', function (ctx) {
        return new Promise(resolve => {
          ctx.HttpErrorHandler.unprocessableEntity = sinon.spy(
            (req, res, message, info) => {
              expect(req).to.exist
              expect(res).to.exist
              expect(message).to.equal('error while deleting user account')
              expect(info).to.deep.equal({
                error: 'SubscriptionAdminDeletionError',
              })
              resolve()
            }
          )
          ctx.UserController.tryDeleteUser(ctx.req, ctx.res)
        })
      })
    })

    describe('when session.destroy produces an error', function () {
      beforeEach(function (ctx) {
        ctx.req.session.destroy = sinon
          .stub()
          .callsArgWith(0, new Error('woops'))
      })

      it('should call next with an error', function (ctx) {
        return new Promise(resolve => {
          ctx.next = err => {
            expect(err).to.not.equal(null)
            expect(err).to.be.instanceof(Error)
            resolve()
          }
          ctx.UserController.tryDeleteUser(ctx.req, ctx.res, ctx.next)
        })
      })
    })
  })

  describe('subscribe', function () {
    it('should send the user to subscribe', function (ctx) {
      return new Promise(resolve => {
        ctx.res.json = data => {
          expect(data.message).to.equal('thanks_settings_updated')
          ctx.NewsLetterManager.promises.subscribe.should.have.been.calledWith(
            ctx.user
          )
          resolve()
        }
        ctx.UserController.subscribe(ctx.req, ctx.res)
      })
    })
  })

  describe('unsubscribe', function () {
    it('should send the user to unsubscribe', function (ctx) {
      return new Promise(resolve => {
        ctx.res.json = data => {
          expect(data.message).to.equal('thanks_settings_updated')
          ctx.NewsLetterManager.promises.unsubscribe.should.have.been.calledWith(
            ctx.user
          )
          resolve()
        }
        ctx.UserController.unsubscribe(ctx.req, ctx.res, ctx.next)
      })
    })
  })

  describe('updateUserSettings', function () {
    beforeEach(function (ctx) {
      ctx.auditLog = { initiatorId: ctx.user_id, ipAddress: ctx.req.ip }
      ctx.newEmail = 'hello@world.com'
      ctx.req.externalAuthenticationSystemUsed = sinon.stub().returns(false)
    })

    it('should call save', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = {}
        ctx.res.sendStatus = code => {
          ctx.user.save.called.should.equal(true)
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res, ctx.next)
      })
    })

    it('should set the first name', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { first_name: 'bobby  ' }
        ctx.res.sendStatus = code => {
          ctx.user.first_name.should.equal('bobby')
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should set the role', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { role: 'student' }
        ctx.res.sendStatus = code => {
          ctx.user.role.should.equal('student')
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should set the institution', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { institution: 'MIT' }
        ctx.res.sendStatus = code => {
          ctx.user.institution.should.equal('MIT')
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should set some props on ace', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { editorTheme: 'something' }
        ctx.res.sendStatus = code => {
          ctx.user.ace.theme.should.equal('something')
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should set the overall theme', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { overallTheme: 'green-ish' }
        ctx.res.sendStatus = code => {
          ctx.user.ace.overallTheme.should.equal('green-ish')
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should set referencesSearchMode to advanced', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { referencesSearchMode: 'advanced' }
        ctx.res.sendStatus = code => {
          ctx.user.ace.referencesSearchMode.should.equal('advanced')
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should set referencesSearchMode to simple', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { referencesSearchMode: 'simple' }
        ctx.res.sendStatus = code => {
          ctx.user.ace.referencesSearchMode.should.equal('simple')
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should not allow arbitrary referencesSearchMode', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { referencesSearchMode: 'foobar' }
        ctx.res.sendStatus = code => {
          ctx.user.ace.referencesSearchMode.should.equal('advanced')
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should set enableNewEditorStageFour to true', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { enableNewEditor: true }
        ctx.res.sendStatus = code => {
          ctx.user.ace.enableNewEditorStageFour.should.equal(true)
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should set enableNewEditorStageFour to false', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { enableNewEditor: false }
        ctx.res.sendStatus = code => {
          ctx.user.ace.enableNewEditorStageFour.should.equal(false)
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should keep enableNewEditorStageFour a boolean', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { enableNewEditor: 'foobar' }
        ctx.res.sendStatus = code => {
          ctx.user.ace.enableNewEditorStageFour.should.equal(true)
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should set darkModePdf to true', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { darkModePdf: true }
        ctx.res.sendStatus = code => {
          ctx.user.ace.darkModePdf.should.equal(true)
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should set darkModePdf to false', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { darkModePdf: false }
        ctx.res.sendStatus = code => {
          ctx.user.ace.darkModePdf.should.equal(false)
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should keep darkModePdf a boolean', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body = { darkModePdf: 'foobar' }
        ctx.res.sendStatus = code => {
          ctx.user.ace.darkModePdf.should.equal(true)
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should send an error if the email is 0 len', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body.email = ''
        ctx.res.sendStatus = function (code) {
          code.should.equal(400)
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should send an error if the email does not contain an @', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body.email = 'bob at something dot com'
        ctx.res.sendStatus = function (code) {
          code.should.equal(400)
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should call the user updater with the new email and user _id', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body.email = ctx.newEmail.toUpperCase()
        ctx.res.sendStatus = code => {
          code.should.equal(200)
          ctx.UserUpdater.promises.changeEmailAddress.should.have.been.calledWith(
            ctx.user_id,
            ctx.newEmail,
            ctx.auditLog
          )
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should update the email on the session', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body.email = ctx.newEmail.toUpperCase()
        let callcount = 0
        ctx.User.findById = id => ({
          exec: async () => {
            if (++callcount === 2) {
              ctx.user.email = ctx.newEmail
            }
            return ctx.user
          },
        })
        ctx.res.sendStatus = code => {
          code.should.equal(200)
          ctx.SessionManager.setInSessionUser
            .calledWith(ctx.req.session, {
              email: ctx.newEmail,
              first_name: undefined,
              last_name: undefined,
            })
            .should.equal(true)
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    it('should call populateTeamInvites', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body.email = ctx.newEmail.toUpperCase()
        ctx.res.sendStatus = code => {
          code.should.equal(200)
          ctx.UserHandler.promises.populateTeamInvites.should.have.been.calledWith(
            ctx.user
          )
          resolve()
        }
        ctx.UserController.updateUserSettings(ctx.req, ctx.res)
      })
    })

    describe('when changeEmailAddress yields an error', function () {
      it('should pass on an error and not send a success status', function (ctx) {
        return new Promise(resolve => {
          ctx.req.body.email = ctx.newEmail.toUpperCase()
          ctx.UserUpdater.promises.changeEmailAddress.rejects(new OError())
          ctx.HttpErrorHandler.legacyInternal = sinon.spy(
            (req, res, message, error) => {
              expect(req).to.exist
              expect(req).to.exist
              message.should.equal('problem_changing_email_address')
              expect(error).to.be.instanceof(OError)
              resolve()
            }
          )
          ctx.UserController.updateUserSettings(ctx.req, ctx.res, ctx.next)
        })
      })

      it('should call the HTTP conflict error handler when the email already exists', function (ctx) {
        return new Promise(resolve => {
          ctx.HttpErrorHandler.conflict = sinon.spy((req, res, message) => {
            expect(req).to.exist
            expect(req).to.exist
            message.should.equal('email_already_registered')
            resolve()
          })
          ctx.req.body.email = ctx.newEmail.toUpperCase()
          ctx.UserUpdater.promises.changeEmailAddress.rejects(
            new Errors.EmailExistsError()
          )
          ctx.UserController.updateUserSettings(ctx.req, ctx.res)
        })
      })
    })

    describe('when using an external auth source', function () {
      beforeEach(function (ctx) {
        ctx.newEmail = 'someone23@example.com'
        ctx.req.externalAuthenticationSystemUsed = sinon.stub().returns(true)
      })

      it('should not set a new email', function (ctx) {
        return new Promise(resolve => {
          ctx.req.body.email = ctx.newEmail
          ctx.res.sendStatus = code => {
            code.should.equal(200)
            ctx.UserUpdater.promises.changeEmailAddress
              .calledWith(ctx.user_id, ctx.newEmail)
              .should.equal(false)
            resolve()
          }
          ctx.UserController.updateUserSettings(ctx.req, ctx.res)
        })
      })
    })
  })

  describe('logout', function () {
    beforeEach(function (ctx) {
      ctx.RequestContentTypeDetection.acceptsJson.returns(false)
    })

    it('should destroy the session', function (ctx) {
      return new Promise(resolve => {
        ctx.req.session.destroy = sinon.stub().callsArgWith(0)
        ctx.res.redirect = url => {
          url.should.equal('/login')
          ctx.req.session.destroy.called.should.equal(true)
          resolve()
        }

        ctx.UserController.logout(ctx.req, ctx.res)
      })
    })

    it('should untrack session', function (ctx) {
      return new Promise(resolve => {
        ctx.req.session.destroy = sinon.stub().callsArgWith(0)
        ctx.res.redirect = url => {
          url.should.equal('/login')
          ctx.UserSessionsManager.promises.untrackSession.should.have.been
            .calledOnce
          ctx.UserSessionsManager.promises.untrackSession.should.have.been.calledWith(
            sinon.match(ctx.req.user),
            ctx.req.sessionID
          )
          resolve()
        }

        ctx.UserController.logout(ctx.req, ctx.res)
      })
    })

    it('should redirect after logout', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body.redirect = '/sso-login'
        ctx.req.session.destroy = sinon.stub().callsArgWith(0)
        ctx.res.redirect = url => {
          url.should.equal(ctx.req.body.redirect)
          resolve()
        }
        ctx.UserController.logout(ctx.req, ctx.res)
      })
    })

    it('should redirect after logout, but not to evil.com', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body.redirect = 'https://evil.com'
        ctx.req.session.destroy = sinon.stub().callsArgWith(0)
        ctx.res.redirect = url => {
          url.should.equal('/login')
          resolve()
        }
        ctx.UserController.logout(ctx.req, ctx.res)
      })
    })

    it('should redirect to login after logout when no redirect set', function (ctx) {
      return new Promise(resolve => {
        ctx.req.session.destroy = sinon.stub().callsArgWith(0)
        ctx.res.redirect = url => {
          url.should.equal('/login')
          resolve()
        }
        ctx.UserController.logout(ctx.req, ctx.res)
      })
    })

    it('should send json with redir property for json request', function (ctx) {
      return new Promise(resolve => {
        ctx.RequestContentTypeDetection.acceptsJson.returns(true)
        ctx.req.session.destroy = sinon.stub().callsArgWith(0)
        ctx.res.status = code => {
          code.should.equal(200)
          return ctx.res
        }
        ctx.res.json = data => {
          data.redir.should.equal('/login')
          resolve()
        }
        ctx.UserController.logout(ctx.req, ctx.res)
      })
    })
  })

  describe('clearSessions', function () {
    describe('success', function () {
      it('should call removeSessionsFromRedis', function (ctx) {
        return new Promise(resolve => {
          ctx.res.sendStatus.callsFake(() => {
            ctx.UserSessionsManager.promises.removeSessionsFromRedis.should.have
              .been.calledOnce
            resolve()
          })
          ctx.UserController.clearSessions(ctx.req, ctx.res)
        })
      })

      it('send a 201 response', function (ctx) {
        return new Promise(resolve => {
          ctx.res.sendStatus.callsFake(status => {
            status.should.equal(201)
            resolve()
          })

          ctx.UserController.clearSessions(ctx.req, ctx.res)
        })
      })

      it('sends a security alert email', function (ctx) {
        return new Promise(resolve => {
          ctx.res.sendStatus.callsFake(status => {
            ctx.EmailHandler.promises.sendEmail.callCount.should.equal(1)
            const expectedArg = {
              to: ctx.user.email,
              actionDescribed: `active sessions were cleared on your account ${ctx.user.email}`,
              action: 'active sessions cleared',
            }
            const emailCall = ctx.EmailHandler.promises.sendEmail.lastCall
            expect(emailCall.args[0]).to.equal('securityAlert')
            expect(emailCall.args[1]).to.deep.equal(expectedArg)
            resolve()
          })

          ctx.UserController.clearSessions(ctx.req, ctx.res)
        })
      })
    })

    describe('errors', function () {
      describe('when getAllUserSessions produces an error', function () {
        it('should return an error', function (ctx) {
          return new Promise(resolve => {
            ctx.UserSessionsManager.promises.getAllUserSessions.rejects(
              new Error('woops')
            )
            ctx.UserController.clearSessions(ctx.req, ctx.res, error => {
              expect(error).to.be.instanceof(Error)
              resolve()
            })
          })
        })
      })

      describe('when audit log addEntry produces an error', function () {
        it('should call next with an error', function (ctx) {
          return new Promise(resolve => {
            ctx.UserAuditLogHandler.promises.addEntry.rejects(
              new Error('woops')
            )
            ctx.UserController.clearSessions(ctx.req, ctx.res, error => {
              expect(error).to.be.instanceof(Error)
              resolve()
            })
          })
        })
      })

      describe('when removeSessionsFromRedis produces an error', function () {
        it('should call next with an error', function (ctx) {
          return new Promise(resolve => {
            ctx.UserSessionsManager.promises.removeSessionsFromRedis.rejects(
              new Error('woops')
            )
            ctx.UserController.clearSessions(ctx.req, ctx.res, error => {
              expect(error).to.be.instanceof(Error)
              resolve()
            })
          })
        })
      })

      describe('when EmailHandler produces an error', function () {
        const anError = new Error('oops')
        it('send a 201 response but log error', function (ctx) {
          return new Promise(resolve => {
            ctx.EmailHandler.promises.sendEmail.rejects(anError)
            ctx.res.sendStatus.callsFake(status => {
              status.should.equal(201)
              expect(ctx.logger.error).toHaveBeenCalledTimes(1)
              const loggerCall = ctx.logger.error.mock.calls[0]
              expect(loggerCall[0]).to.deep.equal({
                error: anError,
                userId: ctx.user_id,
              })
              expect(loggerCall[1]).to.contain(
                'could not send security alert email when sessions cleared'
              )
              resolve()
            })
            ctx.UserController.clearSessions(ctx.req, ctx.res)
          })
        })
      })
    })
  })

  describe('changePassword', function () {
    describe('success', function () {
      beforeEach(function (ctx) {
        ctx.AuthenticationManager.promises.authenticate.resolves({
          user: ctx.user,
        })
        ctx.AuthenticationManager.promises.setUserPassword.resolves()
        ctx.req.body = {
          newPassword1: 'newpass',
          newPassword2: 'newpass',
        }
      })
      it('should set the new password if they do match', function (ctx) {
        return new Promise(resolve => {
          ctx.res.json.callsFake(() => {
            ctx.AuthenticationManager.promises.setUserPassword.should.have.been.calledWith(
              ctx.user,
              'newpass'
            )
            resolve()
          })
          ctx.UserController.changePassword(ctx.req, ctx.res)
        })
      })

      it('should log the update', function (ctx) {
        return new Promise(resolve => {
          ctx.res.json.callsFake(() => {
            ctx.UserAuditLogHandler.promises.addEntry.should.have.been.calledWith(
              ctx.user._id,
              'update-password',
              ctx.user._id,
              ctx.req.ip
            )
            ctx.AuthenticationManager.promises.setUserPassword.callCount.should.equal(
              1
            )
            resolve()
          })
          ctx.UserController.changePassword(ctx.req, ctx.res)
        })
      })

      it('should send security alert email', function (ctx) {
        return new Promise(resolve => {
          ctx.res.json.callsFake(() => {
            const expectedArg = {
              to: ctx.user.email,
              actionDescribed: `your password has been changed on your account ${ctx.user.email}`,
              action: 'password changed',
            }
            const emailCall = ctx.EmailHandler.promises.sendEmail.lastCall
            expect(emailCall.args[0]).to.equal('securityAlert')
            expect(emailCall.args[1]).to.deep.equal(expectedArg)
            resolve()
          })
          ctx.UserController.changePassword(ctx.req, ctx.res)
        })
      })

      it('should expire password reset tokens', function (ctx) {
        return new Promise(resolve => {
          ctx.res.json.callsFake(() => {
            ctx.OneTimeTokenHandler.promises.expireAllTokensForUser.should.have.been.calledWith(
              ctx.user._id,
              'password'
            )
            resolve()
          })
          ctx.UserController.changePassword(ctx.req, ctx.res)
        })
      })
    })

    describe('errors', function () {
      it('should check the old password is the current one at the moment', function (ctx) {
        return new Promise(resolve => {
          ctx.AuthenticationManager.promises.authenticate.resolves({})
          ctx.req.body = { currentPassword: 'oldpasshere' }
          ctx.HttpErrorHandler.badRequest.callsFake(() => {
            expect(ctx.HttpErrorHandler.badRequest).to.have.been.calledWith(
              ctx.req,
              ctx.res,
              'password_change_old_password_wrong'
            )
            ctx.AuthenticationManager.promises.authenticate.should.have.been.calledWith(
              { _id: ctx.user._id },
              'oldpasshere'
            )
            ctx.AuthenticationManager.promises.setUserPassword.callCount.should.equal(
              0
            )
            resolve()
          })
          ctx.UserController.changePassword(ctx.req, ctx.res)
        })
      })

      it('it should not set the new password if they do not match', function (ctx) {
        return new Promise(resolve => {
          ctx.AuthenticationManager.promises.authenticate.resolves({
            user: ctx.user,
          })
          ctx.req.body = {
            newPassword1: '1',
            newPassword2: '2',
          }
          ctx.HttpErrorHandler.badRequest.callsFake(() => {
            expect(ctx.HttpErrorHandler.badRequest).to.have.been.calledWith(
              ctx.req,
              ctx.res,
              'password_change_passwords_do_not_match'
            )
            ctx.AuthenticationManager.promises.setUserPassword.callCount.should.equal(
              0
            )
            resolve()
          })
          ctx.UserController.changePassword(ctx.req, ctx.res)
        })
      })

      it('it should not set the new password if it is invalid', function (ctx) {
        return new Promise(resolve => {
          // this.AuthenticationManager.validatePassword = sinon
          //   .stub()
          //   .returns({ message: 'validation-error' })
          const err = new Error('bad')
          err.name = 'InvalidPasswordError'
          const message = {
            type: 'error',
            key: 'some-message-key',
          }
          ctx.AuthenticationManager.getMessageForInvalidPasswordError.returns(
            message
          )
          ctx.AuthenticationManager.promises.setUserPassword.rejects(err)
          ctx.AuthenticationManager.promises.authenticate.resolves({
            user: ctx.user,
          })
          ctx.req.body = {
            newPassword1: 'newpass',
            newPassword2: 'newpass',
          }
          ctx.res.json.callsFake(result => {
            expect(result.message).to.deep.equal(message)
            ctx.AuthenticationManager.promises.setUserPassword.callCount.should.equal(
              1
            )
            resolve()
          })
          ctx.UserController.changePassword(ctx.req, ctx.res)
        })
      })

      describe('UserAuditLogHandler error', function () {
        it('should return error and not update password', function (ctx) {
          return new Promise(resolve => {
            ctx.UserAuditLogHandler.promises.addEntry.rejects(new Error('oops'))
            ctx.AuthenticationManager.promises.authenticate.resolves({
              user: ctx.user,
            })
            ctx.AuthenticationManager.promises.setUserPassword.resolves()
            ctx.req.body = {
              newPassword1: 'newpass',
              newPassword2: 'newpass',
            }

            ctx.UserController.changePassword(ctx.req, ctx.res, error => {
              expect(error).to.be.instanceof(Error)
              ctx.AuthenticationManager.promises.setUserPassword.callCount.should.equal(
                1
              )
              resolve()
            })
          })
        })
      })

      describe('EmailHandler error', function () {
        const anError = new Error('oops')
        beforeEach(function (ctx) {
          ctx.AuthenticationManager.promises.authenticate.resolves({
            user: ctx.user,
          })
          ctx.AuthenticationManager.promises.setUserPassword.resolves()
          ctx.req.body = {
            newPassword1: 'newpass',
            newPassword2: 'newpass',
          }
          ctx.EmailHandler.promises.sendEmail.rejects(anError)
        })

        it('should not return error but should log it', function (ctx) {
          return new Promise(resolve => {
            ctx.res.json.callsFake(result => {
              expect(result.message.type).to.equal('success')
              expect(ctx.logger.error).toHaveBeenCalledTimes(1)
              expect(ctx.logger.error).toHaveBeenCalledWith(
                {
                  error: anError,
                  userId: ctx.user_id,
                },
                'could not send security alert email when password changed'
              )
              resolve()
            })
            ctx.UserController.changePassword(ctx.req, ctx.res)
          })
        })
      })
    })
  })

  describe('ensureAffiliationMiddleware', function () {
    describe('without affiliations feature', function () {
      beforeEach(async function (ctx) {
        await ctx.UserController.ensureAffiliationMiddleware(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should not run affiliation check', function (ctx) {
        expect(ctx.UserGetter.promises.getUser).to.not.have.been.called
        expect(ctx.UserUpdater.promises.confirmEmail).to.not.have.been.called
        expect(ctx.UserUpdater.promises.addAffiliationForNewUser).to.not.have
          .been.called
      })

      it('should not return an error', function (ctx) {
        expect(ctx.next).to.be.calledWith()
      })
    })

    describe('without ensureAffiliation query parameter', function () {
      beforeEach(async function (ctx) {
        ctx.Features.hasFeature.withArgs('affiliations').returns(true)
        await ctx.UserController.ensureAffiliationMiddleware(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should not run middleware', function (ctx) {
        expect(ctx.UserGetter.promises.getUser).to.not.have.been.called
        expect(ctx.UserUpdater.promises.confirmEmail).to.not.have.been.called
        expect(ctx.UserUpdater.promises.addAffiliationForNewUser).to.not.have
          .been.called
      })

      it('should not return an error', function (ctx) {
        expect(ctx.next).to.be.calledWith()
      })
    })

    describe('no flagged email', function () {
      beforeEach(async function (ctx) {
        const email = 'unit-test@overleaf.com'
        ctx.user.email = email
        ctx.user.emails = [
          {
            email,
          },
        ]
        ctx.Features.hasFeature.withArgs('affiliations').returns(true)
        ctx.req.query.ensureAffiliation = true
        await ctx.UserController.ensureAffiliationMiddleware(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should get the user', function (ctx) {
        expect(ctx.UserGetter.promises.getUser).to.have.been.calledWith(
          ctx.user._id
        )
      })

      it('should not try to add affiliation or update user', function (ctx) {
        expect(ctx.UserUpdater.promises.addAffiliationForNewUser).to.not.have
          .been.called
      })

      it('should not return an error', function (ctx) {
        expect(ctx.next).to.be.calledWith()
      })
    })

    describe('flagged non-SSO email', function () {
      let emailFlagged
      beforeEach(async function (ctx) {
        emailFlagged = 'flagged@overleaf.com'
        ctx.user.email = emailFlagged
        ctx.user.emails = [
          {
            email: emailFlagged,
            affiliationUnchecked: true,
          },
        ]
        ctx.Features.hasFeature.withArgs('affiliations').returns(true)
        ctx.req.query.ensureAffiliation = true
        ctx.req.assertPermission = sinon.stub()
        await ctx.UserController.ensureAffiliationMiddleware(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should check the user has permission', function (ctx) {
        expect(ctx.req.assertPermission).to.have.been.calledWith(
          'add-affiliation'
        )
      })

      it('should unflag the emails but not confirm', function (ctx) {
        expect(
          ctx.UserUpdater.promises.addAffiliationForNewUser
        ).to.have.been.calledWith(ctx.user._id, emailFlagged)
        expect(
          ctx.UserUpdater.promises.confirmEmail
        ).to.not.have.been.calledWith(ctx.user._id, emailFlagged)
      })

      it('should not return an error', function (ctx) {
        expect(ctx.next).to.be.calledWith()
      })
    })

    describe('flagged SSO email', function () {
      let emailFlagged
      beforeEach(async function (ctx) {
        emailFlagged = 'flagged@overleaf.com'
        ctx.user.email = emailFlagged
        ctx.user.emails = [
          {
            email: emailFlagged,
            affiliationUnchecked: true,
            samlProviderId: '123',
          },
        ]
        ctx.Features.hasFeature.withArgs('affiliations').returns(true)
        ctx.req.query.ensureAffiliation = true
        ctx.req.assertPermission = sinon.stub()
        await ctx.UserController.ensureAffiliationMiddleware(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should check the user has permission', function (ctx) {
        expect(ctx.req.assertPermission).to.have.been.calledWith(
          'add-affiliation'
        )
      })

      it('should add affiliation to v1, unflag and confirm on v2', function (ctx) {
        expect(ctx.UserUpdater.promises.addAffiliationForNewUser).to.have.not
          .been.called
        expect(ctx.UserUpdater.promises.confirmEmail).to.have.been.calledWith(
          ctx.user._id,
          emailFlagged
        )
      })

      it('should not return an error', function (ctx) {
        expect(ctx.next).to.be.calledWith()
      })
    })

    describe('when v1 returns an error', function () {
      let emailFlagged
      beforeEach(async function (ctx) {
        ctx.UserUpdater.promises.addAffiliationForNewUser.rejects()
        emailFlagged = 'flagged@overleaf.com'
        ctx.user.email = emailFlagged
        ctx.user.emails = [
          {
            email: emailFlagged,
            affiliationUnchecked: true,
          },
        ]
        ctx.Features.hasFeature.withArgs('affiliations').returns(true)
        ctx.req.query.ensureAffiliation = true
        ctx.req.assertPermission = sinon.stub()
        await ctx.UserController.ensureAffiliationMiddleware(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should check the user has permission', function (ctx) {
        expect(ctx.req.assertPermission).to.have.been.calledWith(
          'add-affiliation'
        )
      })

      it('should return the error', function (ctx) {
        expect(ctx.next).to.be.calledWith(sinon.match.instanceOf(Error))
      })
    })

    describe('when user is not found', function () {
      beforeEach(async function (ctx) {
        ctx.UserGetter.promises.getUser.rejects(new Error('not found'))
        ctx.Features.hasFeature.withArgs('affiliations').returns(true)
        ctx.req.query.ensureAffiliation = true
        await ctx.UserController.ensureAffiliationMiddleware(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should return the error', function (ctx) {
        expect(ctx.next).to.be.calledWith(sinon.match.instanceOf(Error))
      })
    })
  })
})
