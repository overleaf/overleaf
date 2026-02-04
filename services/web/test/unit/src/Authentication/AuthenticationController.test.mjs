import { beforeEach, describe, it, vi, expect } from 'vitest'
import sinon from 'sinon'
import tk from 'timekeeper'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import mongodb from 'mongodb-legacy'
import AuthenticationErrors from '../../../../app/src/Features/Authentication/AuthenticationErrors.mjs'
const modulePath =
  '../../../../app/src/Features/Authentication/AuthenticationController.mjs'

const { ObjectId } = mongodb

vi.mock(
  '../../../../app/src/Features/Analytics/AnalyticsRegistrationSourceHelper.js',
  () => ({
    default: {
      clearInbound: vi.fn(),
      clearSource: vi.fn(),
    },
  })
)

describe('AuthenticationController', function () {
  beforeEach(async function (ctx) {
    tk.freeze(Date.now())
    ctx.UserModel = { findOne: sinon.stub() }
    ctx.httpAuthUsers = {
      'valid-test-user': Math.random().toString(16).slice(2),
    }
    ctx.user = {
      _id: new ObjectId(),
      email: (ctx.email = 'USER@example.com'),
      first_name: 'bob',
      last_name: 'brown',
      referal_id: 1234,
      isAdmin: false,
    }
    ctx.password = 'banana'
    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
    ctx.callback = sinon.stub()
    ctx.next = sinon.stub()
    ctx.req.session.analyticsId = 'abc-123'

    vi.doMock(
      '../../../../app/src/Features/Helpers/AdminAuthorizationHelper',
      () => ({
        default: (ctx.AdminAuthorizationHelper = {
          hasAdminAccess: sinon.stub().returns(false),
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationErrors',
      () => AuthenticationErrors
    )

    vi.doMock('../../../../app/src/Features/User/UserAuditLogHandler', () => ({
      default: (ctx.UserAuditLogHandler = {
        addEntry: sinon.stub().yields(null),
        promises: {
          addEntry: sinon.stub().resolves(),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/Helpers/AsyncFormHelper', () => ({
      default: (ctx.AsyncFormHelper = {
        redirect: sinon.stub(),
      }),
    }))

    vi.doMock(
      '../../../../app/src/infrastructure/RequestContentTypeDetection',
      () => ({
        acceptsJson: (ctx.acceptsJson = sinon.stub().returns(false)),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationManager',
      () => ({
        default: (ctx.AuthenticationManager = {
          promises: {},
        }),
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: (ctx.UserUpdater = {
        updateUser: sinon.stub(),
      }),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.Metrics = { inc: sinon.stub() }),
    }))

    vi.doMock('../../../../app/src/Features/Security/LoginRateLimiter', () => ({
      default: (ctx.LoginRateLimiter = {
        processLoginRequest: sinon.stub(),
        recordSuccessfulLogin: sinon.stub(),
        promises: {
          processLoginRequest: sinon.stub(),
          recordSuccessfulLogin: sinon.stub(),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserHandler', () => ({
      default: (ctx.UserHandler = {
        promises: {
          populateTeamInvites: sinon.stub().resolves(),
        },
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: (ctx.AnalyticsManager = {
          recordEventForUserInBackground: sinon.stub(),
          identifyUser: sinon.stub(),
          getIdsFromSession: sinon.stub().returns({ userId: ctx.user._id }),
        }),
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {
        siteUrl: 'http://www.foo.bar',
        httpAuthUsers: ctx.httpAuthUsers,
        elevateAccountSecurityAfterFailedLogin: 90 * 24 * 60 * 60 * 1000,
      }),
    }))

    vi.doMock('passport', () => ({
      default: (ctx.passport = {
        authenticate: sinon.stub().returns(sinon.stub()),
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserSessionsManager', () => ({
      default: (ctx.UserSessionsManager = {
        trackSession: sinon.stub(),
        untrackSession: sinon.stub(),
        removeSessionsFromRedis: sinon.stub().yields(null),
      }),
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: (ctx.Modules = {
        hooks: { fire: sinon.stub().yields(null, []) },
        promises: { hooks: { fire: sinon.stub().resolves([]) } },
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsBuilder',
      () => ({
        default: (ctx.NotificationsBuilder = {
          ipMatcherAffiliation: sinon.stub().returns({ create: sinon.stub() }),
        }),
      })
    )

    vi.doMock('../../../../app/src/models/User', () => ({
      default: { User: ctx.UserModel },
    }))

    ctx.Oauth2Server = {
      Request: sinon.stub(),
      Response: sinon.stub(),
      server: {
        authenticate: sinon.stub(),
      },
    }

    vi.doMock('../../../../modules/oauth2-server/app/src/Oauth2Server', () => ({
      default: ctx.Oauth2Server,
    }))

    vi.doMock('../../../../app/src/Features/Helpers/UrlHelper', () => ({
      default: (ctx.UrlHelper = {
        getSafeRedirectPath: sinon.stub(),
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: (ctx.SessionManager = {
          isUserLoggedIn: sinon.stub().returns(true),
          getSessionUser: sinon.stub().returns(ctx.user),
        }),
      })
    )

    ctx.AuthenticationController = (await import(modulePath)).default
    ctx.UrlHelper.getSafeRedirectPath
      .withArgs('https://evil.com')
      .returns(undefined)
    ctx.UrlHelper.getSafeRedirectPath.returnsArg(0)
  })

  afterEach(function () {
    tk.reset()
  })

  describe('validateAdmin', function () {
    beforeEach(function (ctx) {
      ctx.Settings.adminDomains = ['good.example.com']
      ctx.goodAdmin = {
        email: 'alice@good.example.com',
        isAdmin: true,
      }
      ctx.badAdmin = {
        email: 'beatrice@bad.example.com',
        isAdmin: true,
      }
      ctx.normalUser = {
        email: 'claire@whatever.example.com',
        isAdmin: false,
      }
    })

    it('should skip when adminDomains are not configured', async function (ctx) {
      await new Promise(resolve => {
        ctx.Settings.adminDomains = []
        ctx.SessionManager.getSessionUser = sinon.stub().returns(ctx.normalUser)
        ctx.AuthenticationController.validateAdmin(ctx.req, ctx.res, err => {
          ctx.SessionManager.getSessionUser.called.should.equal(false)
          expect(err).to.not.exist
          resolve()
        })
      })
    })

    it('should skip non-admin user', async function (ctx) {
      await new Promise(resolve => {
        ctx.SessionManager.getSessionUser = sinon.stub().returns(ctx.normalUser)
        ctx.AuthenticationController.validateAdmin(ctx.req, ctx.res, err => {
          ctx.SessionManager.getSessionUser.called.should.equal(true)
          expect(err).to.not.exist
          resolve()
        })
      })
    })

    it('should permit an admin with the right doman', async function (ctx) {
      await new Promise(resolve => {
        ctx.SessionManager.getSessionUser = sinon.stub().returns(ctx.goodAdmin)
        ctx.AuthenticationController.validateAdmin(ctx.req, ctx.res, err => {
          ctx.SessionManager.getSessionUser.called.should.equal(true)
          expect(err).to.not.exist
          resolve()
        })
      })
    })

    it('should block an admin with a missing email', async function (ctx) {
      await new Promise(resolve => {
        ctx.SessionManager.getSessionUser = sinon
          .stub()
          .returns({ isAdmin: true })
        ctx.AdminAuthorizationHelper.hasAdminAccess.returns(true)
        ctx.AuthenticationController.validateAdmin(ctx.req, ctx.res, err => {
          ctx.SessionManager.getSessionUser.called.should.equal(true)
          expect(err).to.exist
          resolve()
        })
      })
    })

    it('should block an admin with a bad domain', async function (ctx) {
      await new Promise(resolve => {
        ctx.SessionManager.getSessionUser = sinon.stub().returns(ctx.badAdmin)
        ctx.AdminAuthorizationHelper.hasAdminAccess.returns(true)
        ctx.AuthenticationController.validateAdmin(ctx.req, ctx.res, err => {
          ctx.SessionManager.getSessionUser.called.should.equal(true)
          expect(err).to.exist
          resolve()
        })
      })
    })
  })

  describe('serializeUser', function () {
    describe('when isAdmin is false', function () {
      it('does not return an isAdmin field', function (ctx) {
        const isAdminMatcher = sinon.match(value => {
          return !('isAdmin' in value)
        })

        ctx.AuthenticationController.serializeUser(ctx.user, ctx.callback)
        expect(ctx.callback).to.have.been.calledWith(null, isAdminMatcher)
      })
    })
  })

  describe('passportLogin', function () {
    beforeEach(function (ctx) {
      ctx.info = null
      ctx.req.login = sinon.stub().yields(null)
      ctx.res.json = sinon.stub()
      ctx.req.session = {
        passport: { user: ctx.user },
        postLoginRedirect: '/path/to/redir/to',
      }
      ctx.req.session.destroy = sinon.stub().yields(null)
      ctx.req.session.save = sinon.stub().yields(null)
      ctx.req.sessionStore = { generate: sinon.stub() }
      ctx.AuthenticationController.promises.finishLogin = sinon.stub()
      ctx.passport.authenticate.yields(null, ctx.user, ctx.info)
      ctx.err = new Error('woops')
    })

    it('should call passport.authenticate', function (ctx) {
      ctx.AuthenticationController.passportLogin(ctx.req, ctx.res, ctx.next)
      ctx.passport.authenticate.callCount.should.equal(1)
    })

    describe('when authenticate produces an error', function () {
      beforeEach(function (ctx) {
        ctx.passport.authenticate.yields(ctx.err)
      })

      it('should return next with an error', function (ctx) {
        ctx.AuthenticationController.passportLogin(ctx.req, ctx.res, ctx.next)
        ctx.next.calledWith(ctx.err).should.equal(true)
      })
    })

    describe('when authenticate produces a user', function () {
      beforeEach(function (ctx) {
        ctx.req.session.postLoginRedirect = 'some_redirect'
        ctx.passport.authenticate.yields(null, ctx.user, ctx.info)
      })

      afterEach(function (ctx) {
        delete ctx.req.session.postLoginRedirect
      })

      it('should call finishLogin', async function (ctx) {
        await new Promise(resolve => {
          ctx.AuthenticationController.promises.finishLogin.callsFake(() => {
            ctx.AuthenticationController.promises.finishLogin.callCount.should.equal(
              1
            )
            ctx.AuthenticationController.promises.finishLogin
              .calledWith(ctx.user, ctx.req, ctx.res)
              .should.equal(true)
            resolve()
          })
          ctx.AuthenticationController.passportLogin(ctx.req, ctx.res, ctx.next)
        })
      })
    })

    describe('when authenticate does not produce a user', function () {
      beforeEach(function (ctx) {
        ctx.info = { text: 'a', type: 'b' }
        ctx.passport.authenticate.yields(null, false, ctx.info)
      })

      it('should not call finishLogin', function (ctx) {
        ctx.AuthenticationController.passportLogin(ctx.req, ctx.res, ctx.next)
        ctx.AuthenticationController.promises.finishLogin.callCount.should.equal(
          0
        )
      })

      it('should not send a json response with redirect', function (ctx) {
        ctx.AuthenticationController.passportLogin(ctx.req, ctx.res, ctx.next)
        ctx.res.json.callCount.should.equal(1)
        ctx.res.json.should.have.been.calledWith({ message: ctx.info })
        expect(ctx.res.json.lastCall.args[0].redir != null).to.equal(false)
      })
    })
  })

  describe('doPassportLogin', function () {
    beforeEach(function (ctx) {
      ctx.AuthenticationController._recordFailedLogin = sinon.stub()
      ctx.AuthenticationController._recordSuccessfulLogin = sinon.stub()
      ctx.req.body = {
        email: ctx.email,
        password: ctx.password,
        session: {
          postLoginRedirect: '/path/to/redir/to',
        },
      }
      ctx.req.__authAuditInfo = { captcha: 'disabled' }
      ctx.cb = sinon.stub()
    })

    describe('when the authentication errors', function () {
      beforeEach(function (ctx) {
        ctx.LoginRateLimiter.promises.processLoginRequest.resolves(true)
        ctx.errorsWith = (error, done) => {
          ctx.AuthenticationManager.promises.authenticate = sinon
            .stub()
            .rejects(error)
          ctx.AuthenticationController.doPassportLogin(
            ctx.req,
            ctx.req.body.email,
            ctx.req.body.password,
            ctx.cb.callsFake(() => done())
          )
        }
      })
      describe('with "password is too long"', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.errorsWith(new Error('password is too long'), resolve)
          })
        })
        it('should send a 429', function (ctx) {
          ctx.cb.should.have.been.calledWith(undefined, false, {
            status: 422,
            type: 'error',
            key: 'password-too-long',
            text: 'password_too_long_please_reset',
          })
        })
      })
      describe('with ParallelLoginError', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.errorsWith(
              new AuthenticationErrors.ParallelLoginError(),
              resolve
            )
          })
        })
        it('should send a 429', function (ctx) {
          ctx.cb.should.have.been.calledWith(undefined, false, {
            status: 429,
          })
        })
      })
      describe('with PasswordReusedError', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.errorsWith(
              new AuthenticationErrors.PasswordReusedError(),
              resolve
            )
          })
        })
        it('should send a 400', function (ctx) {
          ctx.cb.should.have.been.calledWith(undefined, false, {
            status: 400,
            type: 'error',
            key: 'password-compromised',
            text: 'password_compromised_try_again_or_use_known_device_or_reset.',
          })
        })
      })
      describe('with another error', function () {
        const err = new Error('unhandled error')
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.errorsWith(err, resolve)
          })
        })
        it('should send a 400', function (ctx) {
          ctx.cb.should.have.been.calledWith(err)
        })
      })
    })

    describe('when the user is authenticated', function () {
      beforeEach(function (ctx) {
        ctx.cb = sinon.stub()
        ctx.LoginRateLimiter.promises.processLoginRequest.resolves(true)
        ctx.AuthenticationManager.promises.authenticate = sinon
          .stub()
          .resolves({ user: ctx.user })
        ctx.req.sessionID = Math.random()
      })

      describe('happy path', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.AuthenticationController.doPassportLogin(
              ctx.req,
              ctx.req.body.email,
              ctx.req.body.password,
              ctx.cb.callsFake(() => resolve())
            )
          })
        })
        it('should attempt to authorise the user', function (ctx) {
          ctx.AuthenticationManager.promises.authenticate
            .calledWith({ email: ctx.email.toLowerCase() }, ctx.password)
            .should.equal(true)
        })

        it("should establish the user's session", function (ctx) {
          ctx.cb.calledWith(undefined, ctx.user).should.equal(true)
        })
      })

      describe('with a user having a recent failed login ', function () {
        beforeEach(function (ctx) {
          ctx.user.lastFailedLogin = new Date()
        })

        describe('with captcha disabled', function () {
          beforeEach(async function (ctx) {
            await new Promise(resolve => {
              ctx.req.__authAuditInfo.captcha = 'disabled'
              ctx.AuthenticationController.doPassportLogin(
                ctx.req,
                ctx.req.body.email,
                ctx.req.body.password,
                ctx.cb.callsFake(() => resolve())
              )
            })
          })

          it('should let the user log in', function (ctx) {
            ctx.cb.should.have.been.calledWith(undefined, ctx.user)
          })
        })

        describe('with a solved captcha', function () {
          beforeEach(async function (ctx) {
            await new Promise(resolve => {
              ctx.req.__authAuditInfo.captcha = 'solved'
              ctx.AuthenticationController.doPassportLogin(
                ctx.req,
                ctx.req.body.email,
                ctx.req.body.password,
                ctx.cb.callsFake(() => resolve())
              )
            })
          })

          it('should let the user log in', function (ctx) {
            ctx.cb.should.have.been.calledWith(undefined, ctx.user)
          })
        })

        describe('with a skipped captcha', function () {
          beforeEach(async function (ctx) {
            await new Promise(resolve => {
              ctx.req.__authAuditInfo.captcha = 'skipped'
              ctx.AuthenticationController.doPassportLogin(
                ctx.req,
                ctx.req.body.email,
                ctx.req.body.password,
                ctx.cb.callsFake(() => resolve())
              )
            })
          })

          it('should request a captcha', function (ctx) {
            ctx.cb.should.have.been.calledWith(undefined, false, {
              text: 'cannot_verify_user_not_robot',
              type: 'error',
              errorReason: 'cannot_verify_user_not_robot',
              status: 400,
            })
          })
        })
      })
    })

    describe('when the user is not authenticated', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.LoginRateLimiter.promises.processLoginRequest.resolves(true)
          ctx.AuthenticationManager.promises.authenticate = sinon
            .stub()
            .resolves({ user: null })
          ctx.cb = sinon.stub().callsFake(() => resolve())
          ctx.AuthenticationController.doPassportLogin(
            ctx.req,
            ctx.req.body.email,
            ctx.req.body.password,
            ctx.cb
          )
        })
      })

      it('should not establish the login', function (ctx) {
        ctx.cb.callCount.should.equal(1)
        ctx.cb.calledWith(null, false)
        expect(ctx.cb.lastCall.args[2]).to.deep.equal({
          type: 'error',
          key: 'invalid-password-retry-or-reset',
          status: 401,
        })
      })

      it('should not setup the user data in the background', function (ctx) {
        ctx.UserHandler.promises.populateTeamInvites.called.should.equal(false)
      })

      it('should record a failed login', function (ctx) {
        ctx.AuthenticationController._recordFailedLogin.called.should.equal(
          true
        )
      })

      it('should log the failed login', function (ctx) {
        expect(ctx.logger.debug).toBeCalledWith(
          { email: ctx.email.toLowerCase() },
          'failed log in'
        )
      })
    })
  })

  describe('requireLogin', function () {
    beforeEach(function (ctx) {
      ctx.user = {
        _id: 'user-id-123',
        email: 'user@overleaf.com',
      }
      ctx.middleware = ctx.AuthenticationController.requireLogin()
    })

    describe('when the user is logged in', function () {
      beforeEach(function (ctx) {
        ctx.req.session = {
          user: (ctx.user = {
            _id: 'user-id-123',
            email: 'user@overleaf.com',
          }),
        }
        ctx.middleware(ctx.req, ctx.res, ctx.next)
      })

      it('should call the next method in the chain', function (ctx) {
        ctx.next.called.should.equal(true)
      })
    })

    describe('when the user is not logged in', function () {
      beforeEach(function (ctx) {
        ctx.req.session = {}
        ctx.AuthenticationController._redirectToLoginOrRegisterPage =
          sinon.stub()
        ctx.req.query = {}
        ctx.SessionManager.isUserLoggedIn = sinon.stub().returns(false)
        ctx.middleware(ctx.req, ctx.res, ctx.next)
      })

      it('should redirect to the register or login page', function (ctx) {
        ctx.AuthenticationController._redirectToLoginOrRegisterPage
          .calledWith(ctx.req, ctx.res)
          .should.equal(true)
      })
    })
  })

  describe('requireOauth', function () {
    beforeEach(function (ctx) {
      ctx.res.json = sinon.stub()
      ctx.res.status = sinon.stub().returns(ctx.res)
      ctx.res.sendStatus = sinon.stub()
      ctx.middleware = ctx.AuthenticationController.requireOauth('scope')
    })

    describe('when Oauth2Server authenticates', function () {
      beforeEach(async function (ctx) {
        ctx.token = {
          accessToken: 'token',
          user: 'user',
        }
        ctx.Oauth2Server.server.authenticate.resolves(ctx.token)
        await ctx.middleware(ctx.req, ctx.res)
      })

      it('should set oauth_token on request', function (ctx) {
        ctx.req.oauth_token.should.equal(ctx.token)
      })

      it('should set oauth on request', function (ctx) {
        ctx.req.oauth.access_token.should.equal(ctx.token.accessToken)
      })

      it('should set oauth_user on request', function (ctx) {
        ctx.req.oauth_user.should.equal('user')
      })
    })

    describe('when Oauth2Server returns 401 error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.res.json.callsFake(() => resolve())
          ctx.Oauth2Server.server.authenticate.rejects({ code: 401 })
          ctx.middleware(ctx.req, ctx.res, ctx.next)
        })
      })

      it('should return 401 error', function (ctx) {
        ctx.res.status.should.have.been.calledWith(401)
      })

      it('should not call next', function (ctx) {
        ctx.next.should.have.not.been.calledOnce
      })
    })
  })

  describe('requireGlobalLogin', function () {
    beforeEach(function (ctx) {
      ctx.req.headers = {}
      ctx.middleware = sinon.stub()
      ctx.AuthenticationController.requirePrivateApiAuth = sinon
        .stub()
        .returns(ctx.middleware)
      ctx.setRedirect = sinon.spy(
        ctx.AuthenticationController,
        'setRedirectInSession'
      )
    })

    afterEach(function (ctx) {
      ctx.setRedirect.restore()
    })

    describe('with white listed url', function () {
      beforeEach(function (ctx) {
        ctx.AuthenticationController.addEndpointToLoginWhitelist('/login')
        ctx.req._parsedUrl.pathname = '/login'
        ctx.AuthenticationController.requireGlobalLogin(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call next() directly', function (ctx) {
        ctx.next.called.should.equal(true)
      })
    })

    describe('with white listed url and a query string', function () {
      beforeEach(function (ctx) {
        ctx.AuthenticationController.addEndpointToLoginWhitelist('/login')
        ctx.req._parsedUrl.pathname = '/login'
        ctx.req.url = '/login?query=something'
        ctx.AuthenticationController.requireGlobalLogin(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call next() directly', function (ctx) {
        ctx.next.called.should.equal(true)
      })
    })

    describe('with http auth', function () {
      beforeEach(function (ctx) {
        ctx.req.headers.authorization = 'Mock Basic Auth'
        ctx.AuthenticationController.requireGlobalLogin(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should pass the request onto requirePrivateApiAuth middleware', function (ctx) {
        ctx.middleware.calledWith(ctx.req, ctx.res, ctx.next).should.equal(true)
      })
    })

    describe('with a user session', function () {
      beforeEach(function (ctx) {
        ctx.req.session = { user: { mock: 'user', _id: 'some_id' } }
        ctx.AuthenticationController.requireGlobalLogin(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call next() directly', function (ctx) {
        ctx.next.called.should.equal(true)
      })
    })

    describe('with no login credentials', function () {
      beforeEach(function (ctx) {
        ctx.req.session = {}
        ctx.SessionManager.isUserLoggedIn = sinon.stub().returns(false)
        ctx.AuthenticationController.requireGlobalLogin(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should have called setRedirectInSession', function (ctx) {
        ctx.setRedirect.callCount.should.equal(1)
      })

      it('should redirect to the /login page', function (ctx) {
        ctx.res.redirectedTo.should.equal('/login')
      })
    })
  })

  describe('requireBasicAuth', function () {
    beforeEach(function (ctx) {
      ctx.basicAuthUsers = {
        'basic-auth-user': 'basic-auth-password',
      }
      ctx.middleware = ctx.AuthenticationController.requireBasicAuth(
        ctx.basicAuthUsers
      )
    })

    describe('with http auth', function () {
      it('should error with incorrect user', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.headers = {
            authorization: `Basic ${Buffer.from('user:nope').toString('base64')}`,
          }
          ctx.req.sendStatus = status => {
            expect(status).to.equal(401)
            resolve()
          }
          ctx.middleware(ctx.req, ctx.req)
        })
      })

      it('should error with incorrect password', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.headers = {
            authorization: `Basic ${Buffer.from(
              'basic-auth-user:nope'
            ).toString('base64')}`,
          }
          ctx.req.sendStatus = status => {
            expect(status).to.equal(401)
            resolve()
          }
          ctx.middleware(ctx.req, ctx.req)
        })
      })

      it('should fail with empty pass', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.headers = {
            authorization: `Basic ${Buffer.from(`basic-auth-user:`).toString(
              'base64'
            )}`,
          }
          ctx.req.sendStatus = status => {
            expect(status).to.equal(401)
            resolve()
          }
          ctx.middleware(ctx.req, ctx.req)
        })
      })

      it('should fail with empty user and password of "undefined"', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.headers = {
            authorization: `Basic ${Buffer.from(`:undefined`).toString(
              'base64'
            )}`,
          }
          ctx.req.sendStatus = status => {
            expect(status).to.equal(401)
            resolve()
          }
          ctx.middleware(ctx.req, ctx.req)
        })
      })

      it('should fail with empty user and empty password', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.headers = {
            authorization: `Basic ${Buffer.from(`:`).toString('base64')}`,
          }
          ctx.req.sendStatus = status => {
            expect(status).to.equal(401)
            resolve()
          }
          ctx.middleware(ctx.req, ctx.req)
        })
      })

      it('should fail with a user that is not a valid property', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.headers = {
            authorization: `Basic ${Buffer.from(
              `constructor:[Function ]`
            ).toString('base64')}`,
          }
          ctx.req.sendStatus = status => {
            expect(status).to.equal(401)
            resolve()
          }
          ctx.middleware(ctx.req, ctx.req)
        })
      })

      it('should succeed with correct user/pass', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.headers = {
            authorization: `Basic ${Buffer.from(
              `basic-auth-user:${ctx.basicAuthUsers['basic-auth-user']}`
            ).toString('base64')}`,
          }
          ctx.middleware(ctx.req, ctx.res, resolve)
        })
      })
    })
  })

  describe('requirePrivateApiAuth', function () {
    beforeEach(function (ctx) {
      ctx.AuthenticationController.requireBasicAuth = sinon.stub()
    })

    it('should call requireBasicAuth with the private API user details', function (ctx) {
      ctx.AuthenticationController.requirePrivateApiAuth()
      ctx.AuthenticationController.requireBasicAuth
        .calledWith(ctx.httpAuthUsers)
        .should.equal(true)
    })
  })

  describe('_redirectToLoginOrRegisterPage', function () {
    beforeEach(function (ctx) {
      ctx.middleware = ctx.AuthenticationController.requireLogin(
        (ctx.options = { load_from_db: false })
      )
      ctx.req.session = {}
      ctx.AuthenticationController._redirectToRegisterPage = sinon.stub()
      ctx.AuthenticationController._redirectToLoginPage = sinon.stub()
      ctx.req.query = {}
    })

    describe('they have come directly to the url', function () {
      beforeEach(function (ctx) {
        ctx.req.query = {}
        ctx.SessionManager.isUserLoggedIn = sinon.stub().returns(false)
        ctx.middleware(ctx.req, ctx.res, ctx.next)
      })

      it('should redirect to the login page', function (ctx) {
        ctx.AuthenticationController._redirectToRegisterPage
          .calledWith(ctx.req, ctx.res)
          .should.equal(false)
        ctx.AuthenticationController._redirectToLoginPage
          .calledWith(ctx.req, ctx.res)
          .should.equal(true)
      })
    })

    describe('they have come via a templates link', function () {
      beforeEach(function (ctx) {
        ctx.req.query.zipUrl = 'something'
        ctx.SessionManager.isUserLoggedIn = sinon.stub().returns(false)
        ctx.middleware(ctx.req, ctx.res, ctx.next)
      })

      it('should redirect to the register page', function (ctx) {
        ctx.AuthenticationController._redirectToRegisterPage
          .calledWith(ctx.req, ctx.res)
          .should.equal(true)
        ctx.AuthenticationController._redirectToLoginPage
          .calledWith(ctx.req, ctx.res)
          .should.equal(false)
      })
    })

    describe('they have been invited to a project', function () {
      beforeEach(function (ctx) {
        ctx.req.session.sharedProjectData = {
          project_name: 'something',
          user_first_name: 'else',
        }
        ctx.SessionManager.isUserLoggedIn = sinon.stub().returns(false)
        ctx.middleware(ctx.req, ctx.res, ctx.next)
      })

      it('should redirect to the register page', function (ctx) {
        ctx.AuthenticationController._redirectToRegisterPage
          .calledWith(ctx.req, ctx.res)
          .should.equal(true)
        ctx.AuthenticationController._redirectToLoginPage
          .calledWith(ctx.req, ctx.res)
          .should.equal(false)
      })
    })
  })

  describe('_redirectToRegisterPage', function () {
    beforeEach(function (ctx) {
      ctx.req.path = '/target/url'
      ctx.req.query = { extra_query: 'foo' }
      ctx.AuthenticationController._redirectToRegisterPage(ctx.req, ctx.res)
    })

    it('should redirect to the register page with a query string attached', function (ctx) {
      ctx.req.session.postLoginRedirect.should.equal(
        '/target/url?extra_query=foo'
      )
      ctx.res.redirectedTo.should.equal('/register?extra_query=foo')
    })

    it('should log out a message', function (ctx) {
      expect(ctx.logger.debug).toBeCalledWith(
        { url: ctx.url },
        'user not logged in so redirecting to register page'
      )
    })
  })

  describe('_redirectToLoginPage', function () {
    beforeEach(function (ctx) {
      ctx.req.path = '/target/url'
      ctx.req.query = { extra_query: 'foo' }
      ctx.AuthenticationController._redirectToLoginPage(ctx.req, ctx.res)
    })

    it('should redirect to the register page with a query string attached', function (ctx) {
      ctx.req.session.postLoginRedirect.should.equal(
        '/target/url?extra_query=foo'
      )
      ctx.res.redirectedTo.should.equal('/login?extra_query=foo')
    })
  })

  describe('_recordSuccessfulLogin', function () {
    beforeEach(function (ctx) {
      ctx.UserUpdater.updateUser = sinon.stub().yields()
      ctx.AuthenticationController._recordSuccessfulLogin(
        ctx.user._id,
        ctx.callback
      )
    })

    it('should increment the user.login.success metric', function (ctx) {
      ctx.Metrics.inc.calledWith('user.login.success').should.equal(true)
    })

    it("should update the user's login count and last logged in date", function (ctx) {
      ctx.UserUpdater.updateUser.args[0][1].$set.lastLoggedIn.should.not.equal(
        undefined
      )
      ctx.UserUpdater.updateUser.args[0][1].$inc.loginCount.should.equal(1)
    })

    it('should call the callback', function (ctx) {
      ctx.callback.called.should.equal(true)
    })
  })

  describe('_recordFailedLogin', function () {
    beforeEach(function (ctx) {
      ctx.AuthenticationController._recordFailedLogin(ctx.callback)
    })

    it('should increment the user.login.failed metric', function (ctx) {
      ctx.Metrics.inc.calledWith('user.login.failed').should.equal(true)
    })

    it('should call the callback', function (ctx) {
      ctx.callback.called.should.equal(true)
    })
  })

  describe('setRedirectInSession', function () {
    beforeEach(function (ctx) {
      ctx.req = { session: {} }
      ctx.req.path = '/somewhere'
      ctx.req.query = { one: '1' }
    })

    it('should set redirect property on session', function (ctx) {
      ctx.AuthenticationController.setRedirectInSession(ctx.req)
      expect(ctx.req.session.postLoginRedirect).to.equal('/somewhere?one=1')
    })

    it('should set the supplied value', function (ctx) {
      ctx.AuthenticationController.setRedirectInSession(
        ctx.req,
        '/somewhere/specific'
      )
      expect(ctx.req.session.postLoginRedirect).to.equal('/somewhere/specific')
    })

    it('should not allow open redirects', function (ctx) {
      ctx.AuthenticationController.setRedirectInSession(
        ctx.req,
        'https://evil.com'
      )
      expect(ctx.req.session.postLoginRedirect).to.be.undefined
    })

    describe('with a png', function () {
      beforeEach(function (ctx) {
        ctx.req = { session: {} }
      })

      it('should not set the redirect', function (ctx) {
        ctx.AuthenticationController.setRedirectInSession(
          ctx.req,
          '/something.png'
        )
        expect(ctx.req.session.postLoginRedirect).to.equal(undefined)
      })
    })

    describe('with a js path', function () {
      beforeEach(function (ctx) {
        ctx.req = { session: {} }
      })

      it('should not set the redirect', function (ctx) {
        ctx.AuthenticationController.setRedirectInSession(
          ctx.req,
          '/js/something.js'
        )
        expect(ctx.req.session.postLoginRedirect).to.equal(undefined)
      })
    })
  })

  describe('getRedirectFromSession', function () {
    it('should get redirect property from session', function (ctx) {
      ctx.req = { session: { postLoginRedirect: '/a?b=c' } }
      expect(
        ctx.AuthenticationController.getRedirectFromSession(ctx.req)
      ).to.equal('/a?b=c')
    })

    it('should not allow open redirects', function (ctx) {
      ctx.req = { session: { postLoginRedirect: 'https://evil.com' } }
      expect(ctx.AuthenticationController.getRedirectFromSession(ctx.req)).to.be
        .null
    })

    it('handle null values', function (ctx) {
      ctx.req = { session: {} }
      expect(ctx.AuthenticationController.getRedirectFromSession(ctx.req)).to.be
        .null
    })
  })

  describe('_clearRedirectFromSession', function () {
    beforeEach(function (ctx) {
      ctx.req = { session: { postLoginRedirect: '/a?b=c' } }
    })

    it('should remove the redirect property from session', function (ctx) {
      ctx.AuthenticationController._clearRedirectFromSession(ctx.req)
      expect(ctx.req.session.postLoginRedirect).to.equal(undefined)
    })
  })

  describe('finishLogin', function () {
    // - get redirect
    // - async handlers
    // - afterLoginSessionSetup
    // - clear redirect
    // - issue redir, two ways
    beforeEach(function (ctx) {
      ctx.AuthenticationController.getRedirectFromSession = sinon
        .stub()
        .returns('/some/page')

      ctx.req.sessionID = 'thisisacryptographicallysecurerandomid'
      ctx.req.session = {
        passport: { user: { _id: 'one' } },
      }
      ctx.req.session.destroy = sinon.stub().yields(null)
      ctx.req.session.save = sinon.stub().yields(null)
      ctx.req.sessionStore = { generate: sinon.stub() }
      ctx.req.login = sinon.stub().yields(null)

      ctx.AuthenticationController._clearRedirectFromSession = sinon.stub()
      ctx.AuthenticationController._redirectToReconfirmPage = sinon.stub()
      ctx.UserSessionsManager.trackSession = sinon.stub()
      ctx.UserHandler.promises.populateTeamInvites = sinon.stub().resolves()
      ctx.LoginRateLimiter.recordSuccessfulLogin = sinon.stub()
      ctx.AuthenticationController._recordSuccessfulLogin = sinon.stub()
      ctx.AnalyticsManager.recordEvent = sinon.stub()
      ctx.AnalyticsManager.identifyUser = sinon.stub()
      ctx.acceptsJson.returns(true)
      ctx.res.json = sinon.stub()
      ctx.res.redirect = sinon.stub()
    })

    it('should extract the redirect from the session', async function (ctx) {
      await ctx.AuthenticationController.promises.finishLogin(
        ctx.user,
        ctx.req,
        ctx.res,
        ctx.next
      )
      expect(
        ctx.AuthenticationController.getRedirectFromSession.callCount
      ).to.equal(1)
      expect(
        ctx.AuthenticationController.getRedirectFromSession.calledWith(ctx.req)
      ).to.equal(true)
    })

    it('should clear redirect from session', async function (ctx) {
      await ctx.AuthenticationController.promises.finishLogin(
        ctx.user,
        ctx.req,
        ctx.res,
        ctx.next
      )
      expect(
        ctx.AuthenticationController._clearRedirectFromSession.callCount
      ).to.equal(1)
      expect(
        ctx.AuthenticationController._clearRedirectFromSession.calledWith(
          ctx.req
        )
      ).to.equal(true)
    })

    it('should issue a json response with a redirect', async function (ctx) {
      await ctx.AuthenticationController.promises.finishLogin(
        ctx.user,
        ctx.req,
        ctx.res,
        ctx.next
      )
      expect(
        ctx.AsyncFormHelper.redirect.calledWith(ctx.req, ctx.res, '/some/page')
      ).to.equal(true)
    })

    describe('with a non-json request', function () {
      beforeEach(function (ctx) {
        ctx.acceptsJson.returns(false)
        ctx.res.json = sinon.stub()
        ctx.res.redirect = sinon.stub()
      })

      it('should issue a plain redirect', async function (ctx) {
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res,
          ctx.next
        )
        expect(
          ctx.AsyncFormHelper.redirect.calledWith(
            ctx.req,
            ctx.res,
            '/some/page'
          )
        ).to.equal(true)
      })
    })

    describe('when user is flagged to reconfirm', function () {
      beforeEach(function (ctx) {
        ctx.req.session = {}
        ctx.user.must_reconfirm = true
      })
      it('should redirect to reconfirm page', async function (ctx) {
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res,
          ctx.next
        )
        expect(
          ctx.AuthenticationController._redirectToReconfirmPage.calledWith(
            ctx.req
          )
        ).to.equal(true)
      })
    })

    describe('when user account is suspended', function () {
      beforeEach(function (ctx) {
        ctx.req.session = {}
        ctx.user.suspended = true
      })
      it('should not log in and instead redirect to suspended account page', async function (ctx) {
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res,
          ctx.next
        )
        sinon.assert.notCalled(ctx.req.login)
        sinon.assert.calledWith(
          ctx.AsyncFormHelper.redirect,
          ctx.req,
          ctx.res,
          '/account-suspended'
        )
      })
    })

    describe('preFinishLogin hook', function () {
      it('call hook and proceed', async function (ctx) {
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res,
          ctx.next
        )
        sinon.assert.calledWith(
          ctx.Modules.promises.hooks.fire,
          'preFinishLogin',
          ctx.req,
          ctx.res,
          ctx.user
        )
        expect(ctx.AsyncFormHelper.redirect.called).to.equal(true)
      })

      it('stop if hook has redirected', async function (ctx) {
        ctx.Modules.promises.hooks.fire = sinon
          .stub()
          .resolves([{ doNotFinish: true }])
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res,
          ctx.next
        )
        expect(ctx.next.callCount).to.equal(0)
        expect(ctx.res.json.callCount).to.equal(0)
      })

      it('call next with hook errors', async function (ctx) {
        await new Promise(resolve => {
          ctx.Modules.promises.hooks.fire = sinon.stub().yields(new Error())
          ctx.AuthenticationController.promises
            .finishLogin(ctx.user, ctx.req, ctx.res)
            .catch(err => {
              expect(err).to.exist
              expect(ctx.res.json.callCount).to.equal(0)
              resolve()
            })
        })
      })
    })

    describe('UserAuditLog', function () {
      it('should add an audit log entry', async function (ctx) {
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res,
          ctx.next
        )
        expect(
          ctx.UserAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          ctx.user._id,
          'login',
          ctx.user._id,
          '42.42.42.42'
        )
      })

      it('should add an audit log entry before logging the user in', async function (ctx) {
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res,
          ctx.next
        )
        expect(
          ctx.UserAuditLogHandler.promises.addEntry
        ).to.have.been.calledBefore(ctx.req.login)
      })

      it('should not log the user in without an audit log entry', async function (ctx) {
        await new Promise(resolve => {
          const theError = new Error()
          ctx.UserAuditLogHandler.promises.addEntry.rejects(theError)
          ctx.next.callsFake(err => {
            expect(err).to.equal(theError)
            expect(ctx.next).to.have.been.calledWith(theError)
            expect(ctx.req.login).to.not.have.been.called
            resolve()
          })
          ctx.AuthenticationController.finishLogin(
            ctx.user,
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should pass along auditInfo when present', async function (ctx) {
        ctx.AuthenticationController.setAuditInfo(ctx.req, {
          method: 'Login',
        })
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res
        )
        expect(
          ctx.UserAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          ctx.user._id,
          'login',
          ctx.user._id,
          '42.42.42.42',
          { method: 'Login' }
        )
      })
    })

    describe('_afterLoginSessionSetup', function () {
      beforeEach(function () {})

      it('should call req.login', async function (ctx) {
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res,
          ctx.next
        )
        ctx.req.login.callCount.should.equal(1)
      })

      it('should erase the CSRF secret', async function (ctx) {
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res,
          ctx.next
        )
        expect(ctx.req.session.csrfSecret).to.not.exist
      })

      it('should call req.session.save', async function (ctx) {
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res,
          ctx.next
        )
        ctx.req.session.save.callCount.should.equal(1)
      })

      it('should call UserSessionsManager.trackSession', async function (ctx) {
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res,
          ctx.next
        )
        ctx.UserSessionsManager.trackSession.callCount.should.equal(1)
      })

      describe('when req.session.save produces an error', function () {
        beforeEach(function (ctx) {
          ctx.req.session.save = sinon.stub().yields(new Error('woops'))
        })

        it('should produce an error', async function (ctx) {
          await new Promise(resolve => {
            ctx.AuthenticationController.promises
              .finishLogin(ctx.user, ctx.req, ctx.res)
              .catch(err => {
                expect(err).to.not.be.oneOf([null, undefined])
                expect(err).to.be.instanceof(Error)
                resolve()
              })
          })
        })

        it('should not call UserSessionsManager.trackSession', async function (ctx) {
          await new Promise(resolve => {
            ctx.AuthenticationController.promises
              .finishLogin(ctx.user, ctx.req, ctx.res)
              .catch(err => {
                expect(err).to.exist
                ctx.UserSessionsManager.trackSession.callCount.should.equal(0)
                resolve()
              })
          })
        })
      })
    })

    describe('_loginAsyncHandlers', function () {
      beforeEach(async function (ctx) {
        await ctx.AuthenticationController.promises.finishLogin(
          ctx.user,
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call identifyUser', function (ctx) {
        sinon.assert.calledWith(
          ctx.AnalyticsManager.identifyUser,
          ctx.user._id,
          ctx.req.session.analyticsId
        )
      })

      it('should setup the user data in the background', function (ctx) {
        ctx.UserHandler.promises.populateTeamInvites
          .calledWith(ctx.user)
          .should.equal(true)
      })

      it('should set res.session.justLoggedIn', function (ctx) {
        ctx.req.session.justLoggedIn.should.equal(true)
      })

      it('should record the successful login', function (ctx) {
        ctx.AuthenticationController._recordSuccessfulLogin
          .calledWith(ctx.user._id)
          .should.equal(true)
      })

      it('should tell the rate limiter that there was a success for that email', function (ctx) {
        ctx.LoginRateLimiter.recordSuccessfulLogin
          .calledWith(ctx.user.email)
          .should.equal(true)
      })

      it('should log the successful login', function (ctx) {
        expect(ctx.logger.debug).toBeCalledWith(
          { email: ctx.user.email, userId: ctx.user._id.toString() },
          'successful log in'
        )
      })

      it('should track the login event', function (ctx) {
        sinon.assert.calledWith(
          ctx.AnalyticsManager.recordEventForUserInBackground,
          ctx.user._id,
          'user-logged-in'
        )
      })
    })
  })

  describe('checkCredentials', function () {
    beforeEach(function (ctx) {
      ctx.userDetailsMap = new Map()
      ctx.logger.err = sinon.stub()
      ctx.Metrics.inc = sinon.stub()
    })

    describe('with valid credentials', function () {
      describe('single password', function () {
        beforeEach(function (ctx) {
          ctx.userDetailsMap.set('testuser', 'correctpassword')
          ctx.result = ctx.AuthenticationController.checkCredentials(
            ctx.userDetailsMap,
            'testuser',
            'correctpassword'
          )
        })

        it('should return true', function (ctx) {
          ctx.result.should.equal(true)
        })

        it('should not log an error', function (ctx) {
          ctx.logger.err.called.should.equal(false)
        })

        it('should record success metrics', function (ctx) {
          ctx.Metrics.inc.should.have.been.calledWith(
            'security.http-auth.check-credentials',
            1,
            {
              path: 'known-user',
              status: 'pass',
            }
          )
        })
      })

      describe('array with primary password', function () {
        beforeEach(function (ctx) {
          ctx.userDetailsMap.set('testuser', ['primary', 'fallback'])
          ctx.result = ctx.AuthenticationController.checkCredentials(
            ctx.userDetailsMap,
            'testuser',
            'primary'
          )
        })

        it('should return true', function (ctx) {
          ctx.result.should.equal(true)
        })

        it('should not log an error', function (ctx) {
          ctx.logger.err.called.should.equal(false)
        })

        it('should record success metrics', function (ctx) {
          ctx.Metrics.inc.should.have.been.calledWith(
            'security.http-auth.check-credentials',
            1,
            {
              path: 'known-user',
              status: 'pass',
            }
          )
        })
      })

      describe('array with fallback password', function () {
        beforeEach(function (ctx) {
          ctx.userDetailsMap.set('testuser', ['primary', 'fallback'])
          ctx.result = ctx.AuthenticationController.checkCredentials(
            ctx.userDetailsMap,
            'testuser',
            'fallback'
          )
        })

        it('should return true', function (ctx) {
          ctx.result.should.equal(true)
        })

        it('should not log an error', function (ctx) {
          ctx.logger.err.called.should.equal(false)
        })

        it('should record success metrics', function (ctx) {
          ctx.Metrics.inc.should.have.been.calledWith(
            'security.http-auth.check-credentials',
            1,
            {
              path: 'known-user',
              status: 'pass',
            }
          )
        })
      })
    })

    describe('with invalid credentials', function () {
      describe('unknown user', function () {
        beforeEach(function (ctx) {
          ctx.userDetailsMap.set('testuser', 'correctpassword')
          ctx.result = ctx.AuthenticationController.checkCredentials(
            ctx.userDetailsMap,
            'unknownuser',
            'anypassword'
          )
        })

        it('should return false', function (ctx) {
          ctx.result.should.equal(false)
        })

        it('should log an error', function (ctx) {
          ctx.logger.err.should.have.been.calledWith(
            { user: 'unknownuser' },
            'invalid login details'
          )
        })

        it('should record failure metrics', function (ctx) {
          ctx.Metrics.inc.should.have.been.calledWith(
            'security.http-auth.check-credentials',
            1,
            {
              path: 'unknown-user',
              status: 'fail',
            }
          )
        })
      })

      describe('wrong password', function () {
        beforeEach(function (ctx) {
          ctx.userDetailsMap.set('testuser', 'correctpassword')
          ctx.result = ctx.AuthenticationController.checkCredentials(
            ctx.userDetailsMap,
            'testuser',
            'wrongpassword'
          )
        })

        it('should return false', function (ctx) {
          ctx.result.should.equal(false)
        })

        it('should log an error', function (ctx) {
          ctx.logger.err.should.have.been.calledWith(
            { user: 'testuser' },
            'invalid login details'
          )
        })

        it('should record failure metrics', function (ctx) {
          ctx.Metrics.inc.should.have.been.calledWith(
            'security.http-auth.check-credentials',
            1,
            {
              path: 'known-user',
              status: 'fail',
            }
          )
        })
      })

      describe('wrong password with array', function () {
        beforeEach(function (ctx) {
          ctx.userDetailsMap.set('testuser', ['primary', 'fallback'])
          ctx.result = ctx.AuthenticationController.checkCredentials(
            ctx.userDetailsMap,
            'testuser',
            'wrongpassword'
          )
        })

        it('should return false', function (ctx) {
          ctx.result.should.equal(false)
        })

        it('should log an error', function (ctx) {
          ctx.logger.err.should.have.been.calledWith(
            { user: 'testuser' },
            'invalid login details'
          )
        })

        it('should record failure metrics', function (ctx) {
          ctx.Metrics.inc.should.have.been.calledWith(
            'security.http-auth.check-credentials',
            1,
            {
              path: 'known-user',
              status: 'fail',
            }
          )
        })
      })

      describe('null user entry', function () {
        beforeEach(function (ctx) {
          ctx.userDetailsMap.set('testuser', null)
          ctx.result = ctx.AuthenticationController.checkCredentials(
            ctx.userDetailsMap,
            'testuser',
            'anypassword'
          )
        })

        it('should return false', function (ctx) {
          ctx.result.should.equal(false)
        })

        it('should log an error', function (ctx) {
          ctx.logger.err.should.have.been.calledWith(
            { user: 'testuser' },
            'invalid login details'
          )
        })

        it('should record failure metrics for unknown user', function (ctx) {
          ctx.Metrics.inc.should.have.been.calledWith(
            'security.http-auth.check-credentials',
            1,
            {
              path: 'unknown-user',
              status: 'fail',
            }
          )
        })
      })

      describe('empty primary password in array', function () {
        beforeEach(function (ctx) {
          ctx.userDetailsMap.set('testuser', ['', 'fallback'])
          ctx.result = ctx.AuthenticationController.checkCredentials(
            ctx.userDetailsMap,
            'testuser',
            'fallback'
          )
        })

        it('should return true with fallback password', function (ctx) {
          ctx.result.should.equal(true)
        })

        it('should not log an error', function (ctx) {
          ctx.logger.err.called.should.equal(false)
        })
      })

      describe('empty fallback password in array', function () {
        beforeEach(function (ctx) {
          ctx.userDetailsMap.set('testuser', ['primary', ''])
          ctx.result = ctx.AuthenticationController.checkCredentials(
            ctx.userDetailsMap,
            'testuser',
            'primary'
          )
        })

        it('should return true with primary password', function (ctx) {
          ctx.result.should.equal(true)
        })

        it('should not log an error', function (ctx) {
          ctx.logger.err.called.should.equal(false)
        })
      })

      describe('both passwords empty in array', function () {
        beforeEach(function (ctx) {
          ctx.userDetailsMap.set('testuser', ['', ''])
          ctx.result = ctx.AuthenticationController.checkCredentials(
            ctx.userDetailsMap,
            'testuser',
            'anypassword'
          )
        })

        it('should return false', function (ctx) {
          ctx.result.should.equal(false)
        })

        it('should log an error', function (ctx) {
          ctx.logger.err.should.have.been.calledWith(
            { user: 'testuser' },
            'invalid login details'
          )
        })
      })

      describe('empty single password', function () {
        beforeEach(function (ctx) {
          ctx.userDetailsMap.set('testuser', '')
          ctx.result = ctx.AuthenticationController.checkCredentials(
            ctx.userDetailsMap,
            'testuser',
            'anypassword'
          )
        })

        it('should return false', function (ctx) {
          ctx.result.should.equal(false)
        })

        it('should log an error', function (ctx) {
          ctx.logger.err.should.have.been.calledWith(
            { user: 'testuser' },
            'invalid login details'
          )
        })

        it('should record failure metrics for unknown user', function (ctx) {
          ctx.Metrics.inc.should.have.been.calledWith(
            'security.http-auth.check-credentials',
            1,
            {
              path: 'unknown-user',
              status: 'fail',
            }
          )
        })
      })
    })
  })
})
