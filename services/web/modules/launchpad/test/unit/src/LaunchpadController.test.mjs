import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as path from 'node:path'
import sinon from 'sinon'
import MockResponse from '../../../../../test/unit/src/helpers/MockResponse.mjs'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/src/LaunchpadController.mjs'
)

describe('LaunchpadController', function () {
  beforeEach(async function (ctx) {
    ctx.user = {
      _id: '323123',
      first_name: 'fn',
      last_name: 'ln',
      save: sinon.stub().callsArgWith(0),
    }

    ctx.User = {}

    ctx.Settings = {
      adminPrivilegeAvailable: true,
    }

    vi.doMock('@overleaf/settings', () => ({ default: ctx.Settings }))

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.Metrics = {}),
    }))

    vi.doMock(
      '../../../../../app/src/Features/User/UserRegistrationHandler.mjs',
      () => ({
        default: (ctx.UserRegistrationHandler = {
          promises: {},
        }),
      })
    )

    vi.doMock('../../../../../app/src/Features/Email/EmailHandler.mjs', () => ({
      default: (ctx.EmailHandler = { promises: {} }),
    }))

    vi.doMock('../../../../../app/src/Features/User/UserGetter.mjs', () => ({
      default: (ctx.UserGetter = {
        promises: {},
      }),
    }))

    vi.doMock('../../../../../app/src/models/User.mjs', () => ({
      User: ctx.User,
    }))

    vi.doMock(
      '../../../../../app/src/Features/Authentication/AuthenticationController.mjs',
      () => ({
        default: (ctx.AuthenticationController = {}),
      })
    )

    vi.doMock(
      '../../../../../app/src/Features/Authentication/AuthenticationManager.mjs',
      () => ({
        default: (ctx.AuthenticationManager = {}),
      })
    )

    vi.doMock(
      '../../../../../app/src/Features/Authentication/SessionManager.mjs',
      () => ({
        default: (ctx.SessionManager = {
          getSessionUser: sinon.stub(),
        }),
      })
    )

    ctx.LaunchpadController = (await import(modulePath)).default

    ctx.email = 'bob@smith.com'

    ctx.req = {
      query: {},
      body: {},
      session: {},
    }

    ctx.res = new MockResponse(vi)
    ctx.res.locals = {
      translate(key) {
        return key
      },
    }

    ctx.next = sinon.stub()
  })

  describe('launchpadPage', function () {
    beforeEach(function (ctx) {
      ctx.LaunchpadController._mocks._atLeastOneAdminExists = sinon.stub()
      ctx._atLeastOneAdminExists =
        ctx.LaunchpadController._mocks._atLeastOneAdminExists
      ctx.AuthenticationController.setRedirectInSession = sinon.stub()
    })

    describe('when the user is not logged in', function () {
      beforeEach(function (ctx) {
        ctx.SessionManager.getSessionUser = sinon.stub().returns(null)
      })

      describe('when there are no admins', function () {
        beforeEach(async function (ctx) {
          ctx._atLeastOneAdminExists.resolves(false)
          await ctx.LaunchpadController.launchpadPage(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })

        it('should render the launchpad page', function (ctx) {
          const viewPath = path.join(
            import.meta.dirname,
            '../../../app/views/launchpad'
          )
          expect(ctx.res.render).toHaveBeenCalledTimes(1)
          expect(ctx.res.render).toHaveBeenCalledWith(viewPath, {
            adminUserExists: false,
            authMethod: 'local',
          })
        })
      })

      describe('when there is at least one admin', function () {
        beforeEach(async function (ctx) {
          ctx._atLeastOneAdminExists.resolves(true)
          await ctx.LaunchpadController.launchpadPage(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })

        it('should redirect to login page', function (ctx) {
          ctx.AuthenticationController.setRedirectInSession.callCount.should.equal(
            1
          )
          expect(ctx.res.redirect).toHaveBeenCalledWith('/login')
        })

        it('should not render the launchpad page', function (ctx) {
          expect(ctx.res.render).not.toHaveBeenCalled()
        })
      })
    })

    describe('when the user is logged in', function () {
      beforeEach(function (ctx) {
        ctx.user = {
          _id: 'abcd',
          email: 'abcd@example.com',
        }
        ctx.SessionManager.getSessionUser.returns(ctx.user)
        ctx._atLeastOneAdminExists.resolves(true)
      })

      describe('when the user is an admin', function () {
        beforeEach(async function (ctx) {
          ctx.UserGetter.promises.getUser = sinon
            .stub()
            .resolves({ isAdmin: true })
          await ctx.LaunchpadController.launchpadPage(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })

        it('should render the launchpad page', function (ctx) {
          const viewPath = path.join(
            import.meta.dirname,
            '../../../app/views/launchpad'
          )
          expect(ctx.res.render).toHaveBeenCalledTimes(1)
          expect(ctx.res.render).toHaveBeenCalledWith(viewPath, {
            wsUrl: undefined,
            adminUserExists: true,
            authMethod: 'local',
          })
        })
      })

      describe('when the user is not an admin', function () {
        beforeEach(async function (ctx) {
          ctx.UserGetter.promises.getUser = sinon
            .stub()
            .resolves({ isAdmin: false })
          await ctx.LaunchpadController.launchpadPage(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })

        it('should redirect to restricted page', function (ctx) {
          expect(ctx.res.redirect).toHaveBeenCalledTimes(1)
          expect(ctx.res.redirect).toHaveBeenCalledWith('/restricted')
        })
      })
    })
  })

  describe('_atLeastOneAdminExists', function () {
    describe('when there are no admins', function () {
      beforeEach(function (ctx) {
        ctx.UserGetter.promises.getUser = sinon.stub().resolves(null)
      })

      it('should callback with false', async function (ctx) {
        const exists = await ctx.LaunchpadController._atLeastOneAdminExists()
        expect(exists).to.equal(false)
      })
    })

    describe('when there are some admins', function () {
      beforeEach(function (ctx) {
        ctx.UserGetter.promises.getUser = sinon.stub().resolves({ _id: 'abcd' })
      })

      it('should callback with true', async function (ctx) {
        const exists = await ctx.LaunchpadController._atLeastOneAdminExists()
        expect(exists).to.equal(true)
      })
    })

    describe('when getUser produces an error', function () {
      beforeEach(function (ctx) {
        ctx.UserGetter.promises.getUser = sinon
          .stub()
          .rejects(new Error('woops'))
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.LaunchpadController._atLeastOneAdminExists()).rejected
      })
    })
  })

  describe('sendTestEmail', function () {
    beforeEach(function (ctx) {
      ctx.EmailHandler.promises.sendEmail = sinon.stub().resolves()
      ctx.req.body.email = 'someone@example.com'
    })

    it('should produce a 200 response', async function (ctx) {
      await ctx.LaunchpadController.sendTestEmail(ctx.req, ctx.res, ctx.next)
      expect(ctx.res.json).toHaveBeenCalledWith({ message: 'email_sent' })
    })

    it('should not call next with an error', function (ctx) {
      ctx.LaunchpadController.sendTestEmail(ctx.req, ctx.res, ctx.next)
      ctx.next.callCount.should.equal(0)
    })

    it('should have called sendEmail', async function (ctx) {
      await ctx.LaunchpadController.sendTestEmail(ctx.req, ctx.res, ctx.next)
      ctx.EmailHandler.promises.sendEmail.callCount.should.equal(1)
      ctx.EmailHandler.promises.sendEmail
        .calledWith('testEmail')
        .should.equal(true)
    })

    describe('when sendEmail produces an error', function () {
      beforeEach(function (ctx) {
        ctx.EmailHandler.promises.sendEmail = sinon
          .stub()
          .rejects(new Error('woops'))
      })

      it('should call next with an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.next = sinon.stub().callsFake(err => {
            expect(err).to.be.instanceof(Error)
            ctx.next.callCount.should.equal(1)
            resolve()
          })
          ctx.LaunchpadController.sendTestEmail(ctx.req, ctx.res, ctx.next)
        })
      })
    })

    describe('when no email address is supplied', function () {
      beforeEach(function (ctx) {
        ctx.req.body.email = undefined
      })

      it('should produce a 400 response', function (ctx) {
        ctx.LaunchpadController.sendTestEmail(ctx.req, ctx.res, ctx.next)
        expect(ctx.res.status).toHaveBeenCalledWith(400)
        expect(ctx.res.json).toHaveBeenCalledWith({
          message: 'no email address supplied',
        })
      })
    })
  })

  describe('registerAdmin', function () {
    beforeEach(function (ctx) {
      ctx.LaunchpadController._mocks._atLeastOneAdminExists = sinon.stub()
      ctx._atLeastOneAdminExists =
        ctx.LaunchpadController._mocks._atLeastOneAdminExists
    })

    describe('when all goes well', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = 'someone@example.com'
        ctx.password = 'a_really_bad_password'
        ctx.req.body.email = ctx.email
        ctx.req.body.password = ctx.password
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .resolves(ctx.user)
        ctx.User.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        ctx.AuthenticationManager.validateEmail = sinon.stub().returns(null)
        ctx.AuthenticationManager.validatePassword = sinon.stub().returns(null)
        await ctx.LaunchpadController.registerAdmin(ctx.req, ctx.res, ctx.next)
      })

      it('should send back a json response', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledTimes(1)
        expect(ctx.res.json).toHaveBeenCalledWith({ redir: '/launchpad' })
      })

      it('should have checked for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        ctx.UserRegistrationHandler.promises.registerNewUser
          .calledWith({ email: ctx.email, password: ctx.password })
          .should.equal(true)
      })

      it('should have updated the user to make them an admin', function (ctx) {
        ctx.User.updateOne.callCount.should.equal(1)
        ctx.User.updateOne
          .calledWithMatch(
            { _id: ctx.user._id },
            {
              $set: {
                isAdmin: true,
                emails: [
                  { email: ctx.user.email, reversedHostname: 'moc.elpmaxe' },
                ],
              },
            }
          )
          .should.equal(true)
      })
    })

    describe('when no email is supplied', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = undefined
        ctx.password = 'a_really_bad_password'
        ctx.req.body.email = ctx.email
        ctx.req.body.password = ctx.password
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        ctx.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        await ctx.LaunchpadController.registerAdmin(ctx.req, ctx.res, ctx.next)
      })

      it('should send a 400 response', function (ctx) {
        expect(ctx.res.sendStatus).toHaveBeenCalledTimes(1)
        expect(ctx.res.sendStatus).toHaveBeenCalledWith(400)
      })

      it('should not check for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(0)
      })

      it('should not call registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when no password is supplied', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = 'someone@example.com'
        ctx.password = undefined
        ctx.req.body.email = ctx.email
        ctx.req.body.password = ctx.password
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        ctx.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        await ctx.LaunchpadController.registerAdmin(ctx.req, ctx.res, ctx.next)
      })

      it('should send a 400 response', function (ctx) {
        expect(ctx.res.sendStatus).toHaveBeenCalledTimes(1)
        expect(ctx.res.sendStatus).toHaveBeenCalledWith(400)
      })

      it('should not check for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(0)
      })

      it('should not call registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when an invalid email is supplied', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = 'someone@example.com'
        ctx.password = 'invalid password'
        ctx.req.body.email = ctx.email
        ctx.req.body.password = ctx.password
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        ctx.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        ctx.AuthenticationManager.validateEmail = sinon
          .stub()
          .returns(new Error('bad email'))
        ctx.AuthenticationManager.validatePassword = sinon.stub().returns(null)
        await ctx.LaunchpadController.registerAdmin(ctx.req, ctx.res, ctx.next)
      })

      it('should send a 400 response', function (ctx) {
        expect(ctx.res.status).toHaveBeenCalledTimes(1)
        expect(ctx.res.status).toHaveBeenCalledWith(400)
        expect(ctx.res.json).toHaveBeenCalledWith({
          message: { type: 'error', text: 'bad email' },
        })
      })

      it('should not call registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when an invalid password is supplied', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = 'someone@example.com'
        ctx.password = 'invalid password'
        ctx.req.body.email = ctx.email
        ctx.req.body.password = ctx.password
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        ctx.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        ctx.AuthenticationManager.validateEmail = sinon.stub().returns(null)
        ctx.AuthenticationManager.validatePassword = sinon
          .stub()
          .returns(new Error('bad password'))
        await ctx.LaunchpadController.registerAdmin(ctx.req, ctx.res, ctx.next)
      })

      it('should send a 400 response', function (ctx) {
        expect(ctx.res.status).toHaveBeenCalledTimes(1)
        expect(ctx.res.status).toHaveBeenCalledWith(400)
        expect(ctx.res.json).toHaveBeenCalledWith({
          message: { type: 'error', text: 'bad password' },
        })
      })

      it('should not call registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when there are already existing admins', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(true)
        ctx.email = 'someone@example.com'
        ctx.password = 'a_really_bad_password'
        ctx.req.body.email = ctx.email
        ctx.req.body.password = ctx.password
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        ctx.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        ctx.AuthenticationManager.validateEmail = sinon.stub().returns(null)
        ctx.AuthenticationManager.validatePassword = sinon.stub().returns(null)
        await ctx.LaunchpadController.registerAdmin(ctx.req, ctx.res, ctx.next)
      })

      it('should send a 403 response', function (ctx) {
        expect(ctx.res.status).toHaveBeenCalledTimes(1)
        expect(ctx.res.status).toHaveBeenCalledWith(403)
      })

      it('should not call registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when checking admins produces an error', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.rejects(new Error('woops'))
        ctx.email = 'someone@example.com'
        ctx.password = 'a_really_bad_password'
        ctx.req.body.email = ctx.email
        ctx.req.body.password = ctx.password
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        ctx.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        await ctx.LaunchpadController.registerAdmin(ctx.req, ctx.res, ctx.next)
      })

      it('should call next with an error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        expect(ctx.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should not call registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when registerNewUser produces an error', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = 'someone@example.com'
        ctx.password = 'a_really_bad_password'
        ctx.req.body.email = ctx.email
        ctx.req.body.password = ctx.password
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .rejects(new Error('woops'))
        ctx.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        ctx.AuthenticationManager.validateEmail = sinon.stub().returns(null)
        ctx.AuthenticationManager.validatePassword = sinon.stub().returns(null)
        await ctx.LaunchpadController.registerAdmin(ctx.req, ctx.res, ctx.next)
      })

      it('should call next with an error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        expect(ctx.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        ctx.UserRegistrationHandler.promises.registerNewUser
          .calledWith({ email: ctx.email, password: ctx.password })
          .should.equal(true)
      })

      it('should not call update', function (ctx) {
        ctx.User.updateOne.callCount.should.equal(0)
      })
    })

    describe('when user update produces an error', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = 'someone@example.com'
        ctx.password = 'a_really_bad_password'
        ctx.req.body.email = ctx.email
        ctx.req.body.password = ctx.password
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .resolves(ctx.user)
        ctx.User.updateOne = sinon.stub().returns({
          exec: sinon.stub().rejects(new Error('woops')),
        })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        ctx.AuthenticationManager.validateEmail = sinon.stub().returns(null)
        ctx.AuthenticationManager.validatePassword = sinon.stub().returns(null)
        await ctx.LaunchpadController.registerAdmin(ctx.req, ctx.res, ctx.next)
      })

      it('should call next with an error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        expect(ctx.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        ctx.UserRegistrationHandler.promises.registerNewUser
          .calledWith({ email: ctx.email, password: ctx.password })
          .should.equal(true)
      })
    })

    describe('when overleaf', function () {
      beforeEach(async function (ctx) {
        ctx.Settings.overleaf = { one: 1 }
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = 'someone@example.com'
        ctx.password = 'a_really_bad_password'
        ctx.req.body.email = ctx.email
        ctx.req.body.password = ctx.password
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .resolves(ctx.user)
        ctx.User.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        ctx.AuthenticationManager.validateEmail = sinon.stub().returns(null)
        ctx.AuthenticationManager.validatePassword = sinon.stub().returns(null)
        ctx.UserGetter.promises.getUser = sinon.stub().resolves({ _id: '1234' })
        await ctx.LaunchpadController.registerAdmin(ctx.req, ctx.res, ctx.next)
      })

      it('should send back a json response', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledTimes(1)
        expect(ctx.res.json).toHaveBeenCalledWith({ redir: '/launchpad' })
      })

      it('should have checked for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        ctx.UserRegistrationHandler.promises.registerNewUser
          .calledWith({ email: ctx.email, password: ctx.password })
          .should.equal(true)
      })

      it('should have updated the user to make them an admin', function (ctx) {
        ctx.User.updateOne
          .calledWith(
            { _id: ctx.user._id },
            {
              $set: {
                isAdmin: true,
                emails: [
                  { email: ctx.user.email, reversedHostname: 'moc.elpmaxe' },
                ],
              },
            }
          )
          .should.equal(true)
      })
    })
  })

  describe('registerExternalAuthAdmin', function () {
    beforeEach(function (ctx) {
      ctx.Settings.ldap = { one: 1 }
      ctx.LaunchpadController._mocks._atLeastOneAdminExists = sinon.stub()
      ctx._atLeastOneAdminExists =
        ctx.LaunchpadController._mocks._atLeastOneAdminExists
    })

    describe('when all goes well', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = 'someone@example.com'
        ctx.req.body.email = ctx.email
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .resolves(ctx.user)
        ctx.User.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        await ctx.LaunchpadController.registerExternalAuthAdmin('ldap')(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should send back a json response', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledTimes(1)
        expect(ctx.res.json.mock.lastCall[0].email).to.equal(ctx.email)
      })

      it('should have checked for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        ctx.UserRegistrationHandler.promises.registerNewUser
          .calledWith({
            email: ctx.email,
            password: 'password_here',
            first_name: ctx.email,
            last_name: '',
          })
          .should.equal(true)
      })

      it('should have updated the user to make them an admin', function (ctx) {
        ctx.User.updateOne.callCount.should.equal(1)
        ctx.User.updateOne
          .calledWith(
            { _id: ctx.user._id },
            {
              $set: {
                isAdmin: true,
                emails: [
                  { email: ctx.user.email, reversedHostname: 'moc.elpmaxe' },
                ],
              },
            }
          )
          .should.equal(true)
      })

      it('should have set a redirect in session', function (ctx) {
        ctx.AuthenticationController.setRedirectInSession.callCount.should.equal(
          1
        )
        ctx.AuthenticationController.setRedirectInSession
          .calledWith(ctx.req, '/launchpad')
          .should.equal(true)
      })
    })

    describe('when the authMethod is invalid', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = undefined
        ctx.req.body.email = ctx.email
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        ctx.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        await ctx.LaunchpadController.registerExternalAuthAdmin(
          'NOTAVALIDAUTHMETHOD'
        )(ctx.req, ctx.res, ctx.next)
      })

      it('should send a 403 response', function (ctx) {
        expect(ctx.res.sendStatus).toHaveBeenCalledTimes(1)
        expect(ctx.res.sendStatus).toHaveBeenCalledWith(403)
      })

      it('should not check for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(0)
      })

      it('should not call registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when no email is supplied', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = undefined
        ctx.req.body.email = ctx.email
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        ctx.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        await ctx.LaunchpadController.registerExternalAuthAdmin('ldap')(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should send a 400 response', function (ctx) {
        expect(ctx.res.sendStatus).toHaveBeenCalledTimes(1)
        expect(ctx.res.sendStatus).toHaveBeenCalledWith(400)
      })

      it('should not check for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(0)
      })

      it('should not call registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when there are already existing admins', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(true)
        ctx.email = 'someone@example.com'
        ctx.req.body.email = ctx.email
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        ctx.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        await ctx.LaunchpadController.registerExternalAuthAdmin('ldap')(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should send a 403 response', function (ctx) {
        expect(ctx.res.sendStatus).toHaveBeenCalledTimes(1)
        expect(ctx.res.sendStatus).toHaveBeenCalledWith(403)
      })

      it('should not call registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when checking admins produces an error', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.rejects(new Error('woops'))
        ctx.email = 'someone@example.com'
        ctx.req.body.email = ctx.email
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        ctx.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        await ctx.LaunchpadController.registerExternalAuthAdmin('ldap')(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call next with an error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        expect(ctx.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should not call registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when registerNewUser produces an error', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = 'someone@example.com'
        ctx.req.body.email = ctx.email
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .rejects(new Error('woops'))
        ctx.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        await ctx.LaunchpadController.registerExternalAuthAdmin('ldap')(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call next with an error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        expect(ctx.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        ctx.UserRegistrationHandler.promises.registerNewUser
          .calledWith({
            email: ctx.email,
            password: 'password_here',
            first_name: ctx.email,
            last_name: '',
          })
          .should.equal(true)
      })

      it('should not call update', function (ctx) {
        ctx.User.updateOne.callCount.should.equal(0)
      })
    })

    describe('when user update produces an error', function () {
      beforeEach(async function (ctx) {
        ctx._atLeastOneAdminExists.resolves(false)
        ctx.email = 'someone@example.com'
        ctx.req.body.email = ctx.email
        ctx.user = {
          _id: 'abcdef',
          email: ctx.email,
        }
        ctx.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .resolves(ctx.user)
        ctx.User.updateOne = sinon.stub().returns({
          exec: sinon.stub().rejects(new Error('woops')),
        })
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        await ctx.LaunchpadController.registerExternalAuthAdmin('ldap')(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call next with an error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        expect(ctx.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function (ctx) {
        ctx._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function (ctx) {
        ctx.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        ctx.UserRegistrationHandler.promises.registerNewUser
          .calledWith({
            email: ctx.email,
            password: 'password_here',
            first_name: ctx.email,
            last_name: '',
          })
          .should.equal(true)
      })
    })
  })
})
