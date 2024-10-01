const sinon = require('sinon')
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/Authentication/AuthenticationController.js'
const SandboxedModule = require('sandboxed-module')
const tk = require('timekeeper')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const { ObjectId } = require('mongodb-legacy')
const AuthenticationErrors = require('../../../../app/src/Features/Authentication/AuthenticationErrors')

describe('AuthenticationController', function () {
  beforeEach(function () {
    tk.freeze(Date.now())
    this.UserModel = { findOne: sinon.stub() }
    this.httpAuthUsers = {
      'valid-test-user': Math.random().toString(16).slice(2),
    }
    this.user = {
      _id: new ObjectId(),
      email: (this.email = 'USER@example.com'),
      first_name: 'bob',
      last_name: 'brown',
      referal_id: 1234,
      isAdmin: false,
    }
    this.staffUser = {
      ...this.user,
      staffAccess: {
        publisherMetrics: true,
        publisherManagement: false,
        institutionMetrics: true,
        institutionManagement: false,
        groupMetrics: true,
        groupManagement: false,
        adminMetrics: true,
        splitTestMetrics: false,
        splitTestManagement: true,
      },
    }
    this.noStaffAccessUser = {
      ...this.user,
      staffAccess: {
        publisherMetrics: false,
        publisherManagement: false,
        institutionMetrics: false,
        institutionManagement: false,
        groupMetrics: false,
        groupManagement: false,
        adminMetrics: false,
        splitTestMetrics: false,
        splitTestManagement: false,
      },
    }
    this.password = 'banana'
    this.req = new MockRequest()
    this.res = new MockResponse()
    this.callback = sinon.stub()
    this.next = sinon.stub()
    this.req.session.analyticsId = 'abc-123'

    this.AuthenticationController = SandboxedModule.require(modulePath, {
      requires: {
        '../Helpers/AdminAuthorizationHelper': (this.AdminAuthorizationHelper =
          {
            hasAdminAccess: sinon.stub().returns(false),
          }),
        './AuthenticationErrors': AuthenticationErrors,
        '../User/UserAuditLogHandler': (this.UserAuditLogHandler = {
          addEntry: sinon.stub().yields(null),
          promises: {
            addEntry: sinon.stub().resolves(),
          },
        }),
        '../Helpers/AsyncFormHelper': (this.AsyncFormHelper = {
          redirect: sinon.stub(),
        }),
        '../../infrastructure/RequestContentTypeDetection': {
          acceptsJson: (this.acceptsJson = sinon.stub().returns(false)),
        },
        './AuthenticationManager': (this.AuthenticationManager = {
          promises: {},
        }),
        '../User/UserUpdater': (this.UserUpdater = {
          updateUser: sinon.stub(),
        }),
        '@overleaf/metrics': (this.Metrics = { inc: sinon.stub() }),
        '../Security/LoginRateLimiter': (this.LoginRateLimiter = {
          processLoginRequest: sinon.stub(),
          recordSuccessfulLogin: sinon.stub(),
          promises: {
            processLoginRequest: sinon.stub(),
            recordSuccessfulLogin: sinon.stub(),
          },
        }),
        '../User/UserHandler': (this.UserHandler = {
          populateTeamInvites: sinon.stub(),
        }),
        '../Analytics/AnalyticsManager': (this.AnalyticsManager = {
          recordEventForUserInBackground: sinon.stub(),
          identifyUser: sinon.stub(),
          getIdsFromSession: sinon.stub().returns({ userId: this.user._id }),
        }),
        '@overleaf/settings': (this.Settings = {
          siteUrl: 'http://www.foo.bar',
          httpAuthUsers: this.httpAuthUsers,
          elevateAccountSecurityAfterFailedLogin: 90 * 24 * 60 * 60 * 1000,
        }),
        passport: (this.passport = {
          authenticate: sinon.stub().returns(sinon.stub()),
        }),
        '../User/UserSessionsManager': (this.UserSessionsManager = {
          trackSession: sinon.stub(),
          untrackSession: sinon.stub(),
          removeSessionsFromRedis: sinon.stub().yields(null),
        }),
        '../../infrastructure/Modules': (this.Modules = {
          hooks: { fire: sinon.stub().yields(null, []) },
          promises: { hooks: { fire: sinon.stub().resolves([]) } },
        }),
        '../Notifications/NotificationsBuilder': (this.NotificationsBuilder = {
          ipMatcherAffiliation: sinon.stub().returns({ create: sinon.stub() }),
        }),
        '../../models/User': { User: this.UserModel },
        '../../../../modules/oauth2-server/app/src/Oauth2Server':
          (this.Oauth2Server = {
            Request: sinon.stub(),
            Response: sinon.stub(),
            server: {
              authenticate: sinon.stub(),
            },
          }),
        '../Helpers/UrlHelper': (this.UrlHelper = {
          getSafeRedirectPath: sinon.stub(),
        }),
        './SessionManager': (this.SessionManager = {
          isUserLoggedIn: sinon.stub().returns(true),
          getSessionUser: sinon.stub().returns(this.user),
        }),
      },
    })
    this.UrlHelper.getSafeRedirectPath
      .withArgs('https://evil.com')
      .returns(undefined)
    this.UrlHelper.getSafeRedirectPath.returnsArg(0)
  })

  afterEach(function () {
    tk.reset()
  })

  describe('validateAdmin', function () {
    beforeEach(function () {
      this.Settings.adminDomains = ['good.example.com']
      this.goodAdmin = {
        email: 'alice@good.example.com',
        isAdmin: true,
      }
      this.badAdmin = {
        email: 'beatrice@bad.example.com',
        isAdmin: true,
      }
      this.normalUser = {
        email: 'claire@whatever.example.com',
        isAdmin: false,
      }
    })

    it('should skip when adminDomains are not configured', function (done) {
      this.Settings.adminDomains = []
      this.SessionManager.getSessionUser = sinon.stub().returns(this.normalUser)
      this.AuthenticationController.validateAdmin(this.req, this.res, err => {
        this.SessionManager.getSessionUser.called.should.equal(false)
        expect(err).to.not.exist
        done()
      })
    })

    it('should skip non-admin user', function (done) {
      this.SessionManager.getSessionUser = sinon.stub().returns(this.normalUser)
      this.AuthenticationController.validateAdmin(this.req, this.res, err => {
        this.SessionManager.getSessionUser.called.should.equal(true)
        expect(err).to.not.exist
        done()
      })
    })

    it('should permit an admin with the right doman', function (done) {
      this.SessionManager.getSessionUser = sinon.stub().returns(this.goodAdmin)
      this.AuthenticationController.validateAdmin(this.req, this.res, err => {
        this.SessionManager.getSessionUser.called.should.equal(true)
        expect(err).to.not.exist
        done()
      })
    })

    it('should block an admin with a missing email', function (done) {
      this.SessionManager.getSessionUser = sinon
        .stub()
        .returns({ isAdmin: true })
      this.AdminAuthorizationHelper.hasAdminAccess.returns(true)
      this.AuthenticationController.validateAdmin(this.req, this.res, err => {
        this.SessionManager.getSessionUser.called.should.equal(true)
        expect(err).to.exist
        done()
      })
    })

    it('should block an admin with a bad domain', function (done) {
      this.SessionManager.getSessionUser = sinon.stub().returns(this.badAdmin)
      this.AdminAuthorizationHelper.hasAdminAccess.returns(true)
      this.AuthenticationController.validateAdmin(this.req, this.res, err => {
        this.SessionManager.getSessionUser.called.should.equal(true)
        expect(err).to.exist
        done()
      })
    })
  })

  describe('serializeUser', function () {
    describe('when isAdmin is false', function () {
      it('does not return an isAdmin field', function () {
        const isAdminMatcher = sinon.match(value => {
          return !('isAdmin' in value)
        })

        this.AuthenticationController.serializeUser(this.user, this.callback)
        expect(this.callback).to.have.been.calledWith(null, isAdminMatcher)
      })
    })

    describe('when staffAccess fields are provided', function () {
      it('only returns the fields set to true', function () {
        const expectedStaffAccess = {
          publisherMetrics: true,
          institutionMetrics: true,
          groupMetrics: true,
          adminMetrics: true,
          splitTestManagement: true,
        }
        const staffAccessMatcher = sinon.match(value => {
          return (
            Object.keys(value.staffAccess).length ===
            Object.keys(expectedStaffAccess).length
          )
        })

        this.AuthenticationController.serializeUser(
          this.staffUser,
          this.callback
        )
        expect(this.callback).to.have.been.calledWith(null, staffAccessMatcher)
      })
    })

    describe('when all staffAccess fields are false', function () {
      it('no staffAccess attribute is set', function () {
        const staffAccessMatcher = sinon.match(value => {
          return !('staffAccess' in value)
        })

        this.AuthenticationController.serializeUser(
          this.noStaffAccessUser,
          this.callback
        )
        expect(this.callback).to.have.been.calledWith(null, staffAccessMatcher)
      })
    })
  })

  describe('passportLogin', function () {
    beforeEach(function () {
      this.info = null
      this.req.login = sinon.stub().yields(null)
      this.res.json = sinon.stub()
      this.req.session = {
        passport: { user: this.user },
        postLoginRedirect: '/path/to/redir/to',
      }
      this.req.session.destroy = sinon.stub().yields(null)
      this.req.session.save = sinon.stub().yields(null)
      this.req.sessionStore = { generate: sinon.stub() }
      this.AuthenticationController.promises.finishLogin = sinon.stub()
      this.passport.authenticate.yields(null, this.user, this.info)
      this.err = new Error('woops')
    })

    it('should call passport.authenticate', function () {
      this.AuthenticationController.passportLogin(this.req, this.res, this.next)
      this.passport.authenticate.callCount.should.equal(1)
    })

    describe('when authenticate produces an error', function () {
      beforeEach(function () {
        this.passport.authenticate.yields(this.err)
      })

      it('should return next with an error', function () {
        this.AuthenticationController.passportLogin(
          this.req,
          this.res,
          this.next
        )
        this.next.calledWith(this.err).should.equal(true)
      })
    })

    describe('when authenticate produces a user', function () {
      beforeEach(function () {
        this.req.session.postLoginRedirect = 'some_redirect'
        this.passport.authenticate.yields(null, this.user, this.info)
      })

      afterEach(function () {
        delete this.req.session.postLoginRedirect
      })

      it('should call finishLogin', function (done) {
        this.AuthenticationController.promises.finishLogin.callsFake(() => {
          this.AuthenticationController.promises.finishLogin.callCount.should.equal(
            1
          )
          this.AuthenticationController.promises.finishLogin
            .calledWith(this.user, this.req, this.res)
            .should.equal(true)
          done()
        })
        this.AuthenticationController.passportLogin(
          this.req,
          this.res,
          this.next
        )
      })
    })

    describe('when authenticate does not produce a user', function () {
      beforeEach(function () {
        this.info = { text: 'a', type: 'b' }
        this.passport.authenticate.yields(null, false, this.info)
      })

      it('should not call finishLogin', function () {
        this.AuthenticationController.passportLogin(
          this.req,
          this.res,
          this.next
        )
        this.AuthenticationController.promises.finishLogin.callCount.should.equal(
          0
        )
      })

      it('should not send a json response with redirect', function () {
        this.AuthenticationController.passportLogin(
          this.req,
          this.res,
          this.next
        )
        this.res.json.callCount.should.equal(1)
        this.res.json.should.have.been.calledWith({ message: this.info })
        expect(this.res.json.lastCall.args[0].redir != null).to.equal(false)
      })
    })
  })

  describe('doPassportLogin', function () {
    beforeEach(function () {
      this.AuthenticationController._recordFailedLogin = sinon.stub()
      this.AuthenticationController._recordSuccessfulLogin = sinon.stub()
      this.req.body = {
        email: this.email,
        password: this.password,
        session: {
          postLoginRedirect: '/path/to/redir/to',
        },
      }
      this.req.__authAuditInfo = { captcha: 'disabled' }
      this.cb = sinon.stub()
    })

    describe('when the authentication errors', function () {
      beforeEach(function () {
        this.LoginRateLimiter.promises.processLoginRequest.resolves(true)
        this.errorsWith = (error, done) => {
          this.AuthenticationManager.promises.authenticate = sinon
            .stub()
            .rejects(error)
          this.AuthenticationController.doPassportLogin(
            this.req,
            this.req.body.email,
            this.req.body.password,
            this.cb.callsFake(() => done())
          )
        }
      })
      describe('with "password is too long"', function () {
        beforeEach(function (done) {
          this.errorsWith(new Error('password is too long'), done)
        })
        it('should send a 429', function () {
          this.cb.should.have.been.calledWith(undefined, false, {
            status: 422,
            type: 'error',
            key: 'password-too-long',
            text: 'password_too_long_please_reset',
          })
        })
      })
      describe('with ParallelLoginError', function () {
        beforeEach(function (done) {
          this.errorsWith(new AuthenticationErrors.ParallelLoginError(), done)
        })
        it('should send a 429', function () {
          this.cb.should.have.been.calledWith(undefined, false, {
            status: 429,
          })
        })
      })
      describe('with PasswordReusedError', function () {
        beforeEach(function (done) {
          this.errorsWith(new AuthenticationErrors.PasswordReusedError(), done)
        })
        it('should send a 400', function () {
          this.cb.should.have.been.calledWith(undefined, false, {
            status: 400,
            type: 'error',
            key: 'password-compromised',
            text: 'password_compromised_try_again_or_use_known_device_or_reset.',
          })
        })
      })
      describe('with another error', function () {
        const err = new Error('unhandled error')
        beforeEach(function (done) {
          this.errorsWith(err, done)
        })
        it('should send a 400', function () {
          this.cb.should.have.been.calledWith(err)
        })
      })
    })

    describe('when the user is authenticated', function () {
      beforeEach(function () {
        this.cb = sinon.stub()
        this.LoginRateLimiter.promises.processLoginRequest.resolves(true)
        this.AuthenticationManager.promises.authenticate = sinon
          .stub()
          .resolves({ user: this.user })
        this.req.sessionID = Math.random()
      })

      describe('happy path', function () {
        beforeEach(function (done) {
          this.AuthenticationController.doPassportLogin(
            this.req,
            this.req.body.email,
            this.req.body.password,
            this.cb.callsFake(() => done())
          )
        })
        it('should attempt to authorise the user', function () {
          this.AuthenticationManager.promises.authenticate
            .calledWith({ email: this.email.toLowerCase() }, this.password)
            .should.equal(true)
        })

        it("should establish the user's session", function () {
          this.cb.calledWith(undefined, this.user).should.equal(true)
        })
      })

      describe('with a user having a recent failed login ', function () {
        beforeEach(function () {
          this.user.lastFailedLogin = new Date()
        })

        describe('with captcha disabled', function () {
          beforeEach(function (done) {
            this.req.__authAuditInfo.captcha = 'disabled'
            this.AuthenticationController.doPassportLogin(
              this.req,
              this.req.body.email,
              this.req.body.password,
              this.cb.callsFake(() => done())
            )
          })

          it('should let the user log in', function () {
            this.cb.should.have.been.calledWith(undefined, this.user)
          })
        })

        describe('with a solved captcha', function () {
          beforeEach(function (done) {
            this.req.__authAuditInfo.captcha = 'solved'
            this.AuthenticationController.doPassportLogin(
              this.req,
              this.req.body.email,
              this.req.body.password,
              this.cb.callsFake(() => done())
            )
          })

          it('should let the user log in', function () {
            this.cb.should.have.been.calledWith(undefined, this.user)
          })
        })

        describe('with a skipped captcha', function () {
          beforeEach(function (done) {
            this.req.__authAuditInfo.captcha = 'skipped'
            this.AuthenticationController.doPassportLogin(
              this.req,
              this.req.body.email,
              this.req.body.password,
              this.cb.callsFake(() => done())
            )
          })

          it('should request a captcha', function () {
            this.cb.should.have.been.calledWith(undefined, false, {
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
      beforeEach(function (done) {
        this.LoginRateLimiter.promises.processLoginRequest.resolves(true)
        this.AuthenticationManager.promises.authenticate = sinon
          .stub()
          .resolves({ user: null })
        this.cb = sinon.stub().callsFake(() => done())
        this.AuthenticationController.doPassportLogin(
          this.req,
          this.req.body.email,
          this.req.body.password,
          this.cb
        )
      })

      it('should not establish the login', function () {
        this.cb.callCount.should.equal(1)
        this.cb.calledWith(null, false)
        expect(this.cb.lastCall.args[2]).to.deep.equal({
          type: 'error',
          key: 'invalid-password-retry-or-reset',
          status: 401,
        })
      })

      it('should not setup the user data in the background', function () {
        this.UserHandler.populateTeamInvites.called.should.equal(false)
      })

      it('should record a failed login', function () {
        this.AuthenticationController._recordFailedLogin.called.should.equal(
          true
        )
      })

      it('should log the failed login', function () {
        this.logger.debug
          .calledWith({ email: this.email.toLowerCase() }, 'failed log in')
          .should.equal(true)
      })
    })
  })

  describe('requireLogin', function () {
    beforeEach(function () {
      this.user = {
        _id: 'user-id-123',
        email: 'user@overleaf.com',
      }
      this.middleware = this.AuthenticationController.requireLogin()
    })

    describe('when the user is logged in', function () {
      beforeEach(function () {
        this.req.session = {
          user: (this.user = {
            _id: 'user-id-123',
            email: 'user@overleaf.com',
          }),
        }
        this.middleware(this.req, this.res, this.next)
      })

      it('should call the next method in the chain', function () {
        this.next.called.should.equal(true)
      })
    })

    describe('when the user is not logged in', function () {
      beforeEach(function () {
        this.req.session = {}
        this.AuthenticationController._redirectToLoginOrRegisterPage =
          sinon.stub()
        this.req.query = {}
        this.SessionManager.isUserLoggedIn = sinon.stub().returns(false)
        this.middleware(this.req, this.res, this.next)
      })

      it('should redirect to the register or login page', function () {
        this.AuthenticationController._redirectToLoginOrRegisterPage
          .calledWith(this.req, this.res)
          .should.equal(true)
      })
    })
  })

  describe('requireOauth', function () {
    beforeEach(function () {
      this.res.json = sinon.stub()
      this.res.status = sinon.stub().returns(this.res)
      this.res.sendStatus = sinon.stub()
      this.middleware = this.AuthenticationController.requireOauth('scope')
    })

    describe('when Oauth2Server authenticates', function () {
      beforeEach(function (done) {
        this.token = {
          accessToken: 'token',
          user: 'user',
        }
        this.Oauth2Server.server.authenticate = sinon
          .stub()
          .resolves(this.token)
        this.middleware(this.req, this.res, () => done())
      })

      it('should set oauth_token on request', function () {
        this.req.oauth_token.should.equal(this.token)
      })

      it('should set oauth on request', function () {
        this.req.oauth.access_token.should.equal(this.token.accessToken)
      })

      it('should set oauth_user on request', function () {
        this.req.oauth_user.should.equal('user')
      })
    })

    describe('when Oauth2Server returns 401 error', function () {
      beforeEach(function (done) {
        this.res.json.callsFake(() => done())
        this.Oauth2Server.server.authenticate.rejects({ code: 401 })
        this.middleware(this.req, this.res, this.next)
      })

      it('should return 401 error', function () {
        this.res.status.should.have.been.calledWith(401)
      })

      it('should not call next', function () {
        this.next.should.have.not.been.calledOnce
      })
    })
  })

  describe('requireGlobalLogin', function () {
    beforeEach(function () {
      this.req.headers = {}
      this.middleware = sinon.stub()
      this.AuthenticationController.requirePrivateApiAuth = sinon
        .stub()
        .returns(this.middleware)
      this.setRedirect = sinon.spy(
        this.AuthenticationController,
        'setRedirectInSession'
      )
    })

    afterEach(function () {
      this.setRedirect.restore()
    })

    describe('with white listed url', function () {
      beforeEach(function () {
        this.AuthenticationController.addEndpointToLoginWhitelist('/login')
        this.req._parsedUrl.pathname = '/login'
        this.AuthenticationController.requireGlobalLogin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next() directly', function () {
        this.next.called.should.equal(true)
      })
    })

    describe('with white listed url and a query string', function () {
      beforeEach(function () {
        this.AuthenticationController.addEndpointToLoginWhitelist('/login')
        this.req._parsedUrl.pathname = '/login'
        this.req.url = '/login?query=something'
        this.AuthenticationController.requireGlobalLogin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next() directly', function () {
        this.next.called.should.equal(true)
      })
    })

    describe('with http auth', function () {
      beforeEach(function () {
        this.req.headers.authorization = 'Mock Basic Auth'
        this.AuthenticationController.requireGlobalLogin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should pass the request onto requirePrivateApiAuth middleware', function () {
        this.middleware
          .calledWith(this.req, this.res, this.next)
          .should.equal(true)
      })
    })

    describe('with a user session', function () {
      beforeEach(function () {
        this.req.session = { user: { mock: 'user', _id: 'some_id' } }
        this.AuthenticationController.requireGlobalLogin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next() directly', function () {
        this.next.called.should.equal(true)
      })
    })

    describe('with no login credentials', function () {
      beforeEach(function () {
        this.req.session = {}
        this.SessionManager.isUserLoggedIn = sinon.stub().returns(false)
        this.AuthenticationController.requireGlobalLogin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should have called setRedirectInSession', function () {
        this.setRedirect.callCount.should.equal(1)
      })

      it('should redirect to the /login page', function () {
        this.res.redirectedTo.should.equal('/login')
      })
    })
  })

  describe('requireBasicAuth', function () {
    beforeEach(function () {
      this.basicAuthUsers = {
        'basic-auth-user': 'basic-auth-password',
      }
      this.middleware = this.AuthenticationController.requireBasicAuth(
        this.basicAuthUsers
      )
    })

    describe('with http auth', function () {
      it('should error with incorrect user', function (done) {
        this.req.headers = {
          authorization: `Basic ${Buffer.from('user:nope').toString('base64')}`,
        }
        this.req.sendStatus = status => {
          expect(status).to.equal(401)
          done()
        }
        this.middleware(this.req, this.req)
      })

      it('should error with incorrect password', function (done) {
        this.req.headers = {
          authorization: `Basic ${Buffer.from('basic-auth-user:nope').toString(
            'base64'
          )}`,
        }
        this.req.sendStatus = status => {
          expect(status).to.equal(401)
          done()
        }
        this.middleware(this.req, this.req)
      })

      it('should fail with empty pass', function (done) {
        this.req.headers = {
          authorization: `Basic ${Buffer.from(`basic-auth-user:`).toString(
            'base64'
          )}`,
        }
        this.req.sendStatus = status => {
          expect(status).to.equal(401)
          done()
        }
        this.middleware(this.req, this.req)
      })

      it('should fail with empty user and password of "undefined"', function (done) {
        this.req.headers = {
          authorization: `Basic ${Buffer.from(`:undefined`).toString(
            'base64'
          )}`,
        }
        this.req.sendStatus = status => {
          expect(status).to.equal(401)
          done()
        }
        this.middleware(this.req, this.req)
      })

      it('should fail with empty user and empty password', function (done) {
        this.req.headers = {
          authorization: `Basic ${Buffer.from(`:`).toString('base64')}`,
        }
        this.req.sendStatus = status => {
          expect(status).to.equal(401)
          done()
        }
        this.middleware(this.req, this.req)
      })

      it('should fail with a user that is not a valid property', function (done) {
        this.req.headers = {
          authorization: `Basic ${Buffer.from(
            `constructor:[Function ]`
          ).toString('base64')}`,
        }
        this.req.sendStatus = status => {
          expect(status).to.equal(401)
          done()
        }
        this.middleware(this.req, this.req)
      })

      it('should succeed with correct user/pass', function (done) {
        this.req.headers = {
          authorization: `Basic ${Buffer.from(
            `basic-auth-user:${this.basicAuthUsers['basic-auth-user']}`
          ).toString('base64')}`,
        }
        this.middleware(this.req, this.res, done)
      })
    })
  })

  describe('requirePrivateApiAuth', function () {
    beforeEach(function () {
      this.AuthenticationController.requireBasicAuth = sinon.stub()
    })

    it('should call requireBasicAuth with the private API user details', function () {
      this.AuthenticationController.requirePrivateApiAuth()
      this.AuthenticationController.requireBasicAuth
        .calledWith(this.httpAuthUsers)
        .should.equal(true)
    })
  })

  describe('_redirectToLoginOrRegisterPage', function () {
    beforeEach(function () {
      this.middleware = this.AuthenticationController.requireLogin(
        (this.options = { load_from_db: false })
      )
      this.req.session = {}
      this.AuthenticationController._redirectToRegisterPage = sinon.stub()
      this.AuthenticationController._redirectToLoginPage = sinon.stub()
      this.req.query = {}
    })

    describe('they have come directly to the url', function () {
      beforeEach(function () {
        this.req.query = {}
        this.SessionManager.isUserLoggedIn = sinon.stub().returns(false)
        this.middleware(this.req, this.res, this.next)
      })

      it('should redirect to the login page', function () {
        this.AuthenticationController._redirectToRegisterPage
          .calledWith(this.req, this.res)
          .should.equal(false)
        this.AuthenticationController._redirectToLoginPage
          .calledWith(this.req, this.res)
          .should.equal(true)
      })
    })

    describe('they have come via a templates link', function () {
      beforeEach(function () {
        this.req.query.zipUrl = 'something'
        this.SessionManager.isUserLoggedIn = sinon.stub().returns(false)
        this.middleware(this.req, this.res, this.next)
      })

      it('should redirect to the register page', function () {
        this.AuthenticationController._redirectToRegisterPage
          .calledWith(this.req, this.res)
          .should.equal(true)
        this.AuthenticationController._redirectToLoginPage
          .calledWith(this.req, this.res)
          .should.equal(false)
      })
    })

    describe('they have been invited to a project', function () {
      beforeEach(function () {
        this.req.session.sharedProjectData = {
          project_name: 'something',
          user_first_name: 'else',
        }
        this.SessionManager.isUserLoggedIn = sinon.stub().returns(false)
        this.middleware(this.req, this.res, this.next)
      })

      it('should redirect to the register page', function () {
        this.AuthenticationController._redirectToRegisterPage
          .calledWith(this.req, this.res)
          .should.equal(true)
        this.AuthenticationController._redirectToLoginPage
          .calledWith(this.req, this.res)
          .should.equal(false)
      })
    })
  })

  describe('_redirectToRegisterPage', function () {
    beforeEach(function () {
      this.req.path = '/target/url'
      this.req.query = { extra_query: 'foo' }
      this.AuthenticationController._redirectToRegisterPage(this.req, this.res)
    })

    it('should redirect to the register page with a query string attached', function () {
      this.req.session.postLoginRedirect.should.equal(
        '/target/url?extra_query=foo'
      )
      this.res.redirectedTo.should.equal('/register?extra_query=foo')
    })

    it('should log out a message', function () {
      this.logger.debug
        .calledWith(
          { url: this.url },
          'user not logged in so redirecting to register page'
        )
        .should.equal(true)
    })
  })

  describe('_redirectToLoginPage', function () {
    beforeEach(function () {
      this.req.path = '/target/url'
      this.req.query = { extra_query: 'foo' }
      this.AuthenticationController._redirectToLoginPage(this.req, this.res)
    })

    it('should redirect to the register page with a query string attached', function () {
      this.req.session.postLoginRedirect.should.equal(
        '/target/url?extra_query=foo'
      )
      this.res.redirectedTo.should.equal('/login?extra_query=foo')
    })
  })

  describe('_recordSuccessfulLogin', function () {
    beforeEach(function () {
      this.UserUpdater.updateUser = sinon.stub().yields()
      this.AuthenticationController._recordSuccessfulLogin(
        this.user._id,
        this.callback
      )
    })

    it('should increment the user.login.success metric', function () {
      this.Metrics.inc.calledWith('user.login.success').should.equal(true)
    })

    it("should update the user's login count and last logged in date", function () {
      this.UserUpdater.updateUser.args[0][1].$set.lastLoggedIn.should.not.equal(
        undefined
      )
      this.UserUpdater.updateUser.args[0][1].$inc.loginCount.should.equal(1)
    })

    it('should call the callback', function () {
      this.callback.called.should.equal(true)
    })
  })

  describe('_recordFailedLogin', function () {
    beforeEach(function () {
      this.AuthenticationController._recordFailedLogin(this.callback)
    })

    it('should increment the user.login.failed metric', function () {
      this.Metrics.inc.calledWith('user.login.failed').should.equal(true)
    })

    it('should call the callback', function () {
      this.callback.called.should.equal(true)
    })
  })

  describe('setRedirectInSession', function () {
    beforeEach(function () {
      this.req = { session: {} }
      this.req.path = '/somewhere'
      this.req.query = { one: '1' }
    })

    it('should set redirect property on session', function () {
      this.AuthenticationController.setRedirectInSession(this.req)
      expect(this.req.session.postLoginRedirect).to.equal('/somewhere?one=1')
    })

    it('should set the supplied value', function () {
      this.AuthenticationController.setRedirectInSession(
        this.req,
        '/somewhere/specific'
      )
      expect(this.req.session.postLoginRedirect).to.equal('/somewhere/specific')
    })

    it('should not allow open redirects', function () {
      this.AuthenticationController.setRedirectInSession(
        this.req,
        'https://evil.com'
      )
      expect(this.req.session.postLoginRedirect).to.be.undefined
    })

    describe('with a png', function () {
      beforeEach(function () {
        this.req = { session: {} }
      })

      it('should not set the redirect', function () {
        this.AuthenticationController.setRedirectInSession(
          this.req,
          '/something.png'
        )
        expect(this.req.session.postLoginRedirect).to.equal(undefined)
      })
    })

    describe('with a js path', function () {
      beforeEach(function () {
        this.req = { session: {} }
      })

      it('should not set the redirect', function () {
        this.AuthenticationController.setRedirectInSession(
          this.req,
          '/js/something.js'
        )
        expect(this.req.session.postLoginRedirect).to.equal(undefined)
      })
    })
  })

  describe('getRedirectFromSession', function () {
    it('should get redirect property from session', function () {
      this.req = { session: { postLoginRedirect: '/a?b=c' } }
      expect(
        this.AuthenticationController.getRedirectFromSession(this.req)
      ).to.equal('/a?b=c')
    })

    it('should not allow open redirects', function () {
      this.req = { session: { postLoginRedirect: 'https://evil.com' } }
      expect(this.AuthenticationController.getRedirectFromSession(this.req)).to
        .be.null
    })

    it('handle null values', function () {
      this.req = { session: {} }
      expect(this.AuthenticationController.getRedirectFromSession(this.req)).to
        .be.null
    })
  })

  describe('_clearRedirectFromSession', function () {
    beforeEach(function () {
      this.req = { session: { postLoginRedirect: '/a?b=c' } }
    })

    it('should remove the redirect property from session', function () {
      this.AuthenticationController._clearRedirectFromSession(this.req)
      expect(this.req.session.postLoginRedirect).to.equal(undefined)
    })
  })

  describe('finishLogin', function () {
    // - get redirect
    // - async handlers
    // - afterLoginSessionSetup
    // - clear redirect
    // - issue redir, two ways
    beforeEach(function () {
      this.AuthenticationController.getRedirectFromSession = sinon
        .stub()
        .returns('/some/page')

      this.req.sessionID = 'thisisacryptographicallysecurerandomid'
      this.req.session = {
        passport: { user: { _id: 'one' } },
      }
      this.req.session.destroy = sinon.stub().yields(null)
      this.req.session.save = sinon.stub().yields(null)
      this.req.sessionStore = { generate: sinon.stub() }
      this.req.login = sinon.stub().yields(null)

      this.AuthenticationController._clearRedirectFromSession = sinon.stub()
      this.AuthenticationController._redirectToReconfirmPage = sinon.stub()
      this.UserSessionsManager.trackSession = sinon.stub()
      this.UserHandler.populateTeamInvites = sinon.stub()
      this.LoginRateLimiter.recordSuccessfulLogin = sinon.stub()
      this.AuthenticationController._recordSuccessfulLogin = sinon.stub()
      this.AnalyticsManager.recordEvent = sinon.stub()
      this.AnalyticsManager.identifyUser = sinon.stub()
      this.acceptsJson.returns(true)
      this.res.json = sinon.stub()
      this.res.redirect = sinon.stub()
    })

    it('should extract the redirect from the session', async function () {
      await this.AuthenticationController.promises.finishLogin(
        this.user,
        this.req,
        this.res,
        this.next
      )
      expect(
        this.AuthenticationController.getRedirectFromSession.callCount
      ).to.equal(1)
      expect(
        this.AuthenticationController.getRedirectFromSession.calledWith(
          this.req
        )
      ).to.equal(true)
    })

    it('should clear redirect from session', async function () {
      await this.AuthenticationController.promises.finishLogin(
        this.user,
        this.req,
        this.res,
        this.next
      )
      expect(
        this.AuthenticationController._clearRedirectFromSession.callCount
      ).to.equal(1)
      expect(
        this.AuthenticationController._clearRedirectFromSession.calledWith(
          this.req
        )
      ).to.equal(true)
    })

    it('should issue a json response with a redirect', async function () {
      await this.AuthenticationController.promises.finishLogin(
        this.user,
        this.req,
        this.res,
        this.next
      )
      expect(
        this.AsyncFormHelper.redirect.calledWith(
          this.req,
          this.res,
          '/some/page'
        )
      ).to.equal(true)
    })

    describe('with a non-json request', function () {
      beforeEach(function () {
        this.acceptsJson.returns(false)
        this.res.json = sinon.stub()
        this.res.redirect = sinon.stub()
      })

      it('should issue a plain redirect', async function () {
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
        expect(
          this.AsyncFormHelper.redirect.calledWith(
            this.req,
            this.res,
            '/some/page'
          )
        ).to.equal(true)
      })
    })

    describe('when user is flagged to reconfirm', function () {
      beforeEach(function () {
        this.req.session = {}
        this.user.must_reconfirm = true
      })
      it('should redirect to reconfirm page', async function () {
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
        expect(
          this.AuthenticationController._redirectToReconfirmPage.calledWith(
            this.req
          )
        ).to.equal(true)
      })
    })

    describe('when user account is suspended', function () {
      beforeEach(function () {
        this.req.session = {}
        this.user.suspended = true
      })
      it('should not log in and instead redirect to suspended account page', async function () {
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
        sinon.assert.notCalled(this.req.login)
        sinon.assert.calledWith(
          this.AsyncFormHelper.redirect,
          this.req,
          this.res,
          '/account-suspended'
        )
      })
    })

    describe('preFinishLogin hook', function () {
      it('call hook and proceed', async function () {
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
        sinon.assert.calledWith(
          this.Modules.promises.hooks.fire,
          'preFinishLogin',
          this.req,
          this.res,
          this.user
        )
        expect(this.AsyncFormHelper.redirect.called).to.equal(true)
      })

      it('stop if hook has redirected', async function () {
        this.Modules.promises.hooks.fire = sinon
          .stub()
          .resolves([{ doNotFinish: true }])
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
        expect(this.next.callCount).to.equal(0)
        expect(this.res.json.callCount).to.equal(0)
      })

      it('call next with hook errors', function (done) {
        this.Modules.promises.hooks.fire = sinon.stub().yields(new Error())
        this.AuthenticationController.promises
          .finishLogin(this.user, this.req, this.res)
          .catch(err => {
            expect(err).to.exist
            expect(this.res.json.callCount).to.equal(0)
            done()
          })
      })
    })

    describe('UserAuditLog', function () {
      it('should add an audit log entry', async function () {
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
        expect(
          this.UserAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          this.user._id,
          'login',
          this.user._id,
          '42.42.42.42'
        )
      })

      it('should add an audit log entry before logging the user in', async function () {
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
        expect(
          this.UserAuditLogHandler.promises.addEntry
        ).to.have.been.calledBefore(this.req.login)
      })

      it('should not log the user in without an audit log entry', function (done) {
        const theError = new Error()
        this.UserAuditLogHandler.promises.addEntry.rejects(theError)
        this.next.callsFake(err => {
          expect(err).to.equal(theError)
          expect(this.next).to.have.been.calledWith(theError)
          expect(this.req.login).to.not.have.been.called
          done()
        })
        this.AuthenticationController.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
      })

      it('should pass along auditInfo when present', async function () {
        this.AuthenticationController.setAuditInfo(this.req, {
          method: 'Login',
        })
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res
        )
        expect(
          this.UserAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          this.user._id,
          'login',
          this.user._id,
          '42.42.42.42',
          { method: 'Login' }
        )
      })
    })

    describe('_afterLoginSessionSetup', function () {
      beforeEach(function () {})

      it('should call req.login', async function () {
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
        this.req.login.callCount.should.equal(1)
      })

      it('should erase the CSRF secret', async function () {
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
        expect(this.req.session.csrfSecret).to.not.exist
      })

      it('should call req.session.save', async function () {
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
        this.req.session.save.callCount.should.equal(1)
      })

      it('should call UserSessionsManager.trackSession', async function () {
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
        this.UserSessionsManager.trackSession.callCount.should.equal(1)
      })

      describe('when req.session.save produces an error', function () {
        beforeEach(function () {
          this.req.session.save = sinon.stub().yields(new Error('woops'))
        })

        it('should produce an error', function (done) {
          this.AuthenticationController.promises
            .finishLogin(this.user, this.req, this.res)
            .catch(err => {
              expect(err).to.not.be.oneOf([null, undefined])
              expect(err).to.be.instanceof(Error)
              done()
            })
        })

        it('should not call UserSessionsManager.trackSession', function (done) {
          this.AuthenticationController.promises
            .finishLogin(this.user, this.req, this.res)
            .catch(err => {
              expect(err).to.exist
              this.UserSessionsManager.trackSession.callCount.should.equal(0)
              done()
            })
        })
      })
    })

    describe('_loginAsyncHandlers', function () {
      beforeEach(async function () {
        await this.AuthenticationController.promises.finishLogin(
          this.user,
          this.req,
          this.res,
          this.next
        )
      })

      it('should call identifyUser', function () {
        sinon.assert.calledWith(
          this.AnalyticsManager.identifyUser,
          this.user._id,
          this.req.session.analyticsId
        )
      })

      it('should setup the user data in the background', function () {
        this.UserHandler.populateTeamInvites
          .calledWith(this.user)
          .should.equal(true)
      })

      it('should set res.session.justLoggedIn', function () {
        this.req.session.justLoggedIn.should.equal(true)
      })

      it('should record the successful login', function () {
        this.AuthenticationController._recordSuccessfulLogin
          .calledWith(this.user._id)
          .should.equal(true)
      })

      it('should tell the rate limiter that there was a success for that email', function () {
        this.LoginRateLimiter.recordSuccessfulLogin
          .calledWith(this.user.email)
          .should.equal(true)
      })

      it('should log the successful login', function () {
        this.logger.debug
          .calledWith(
            { email: this.user.email, userId: this.user._id.toString() },
            'successful log in'
          )
          .should.equal(true)
      })

      it('should track the login event', function () {
        sinon.assert.calledWith(
          this.AnalyticsManager.recordEventForUserInBackground,
          this.user._id,
          'user-logged-in'
        )
      })
    })
  })
})
