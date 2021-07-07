const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { expect } = require('chai')
const MockResponse = require('../helpers/MockResponse')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/PasswordReset/PasswordResetController'
)

describe('PasswordResetController', function () {
  beforeEach(function () {
    this.email = 'bob@bob.com'
    this.user_id = 'mock-user-id'
    this.token = 'my security token that was emailed to me'
    this.password = 'my new password'
    this.req = {
      body: {
        email: this.email,
        passwordResetToken: this.token,
        password: this.password,
      },
      i18n: {
        translate() {},
      },
      session: {},
      query: {},
    }
    this.res = new MockResponse()

    this.settings = {}
    this.PasswordResetHandler = {
      generateAndEmailResetToken: sinon.stub(),
      promises: {
        setNewUserPassword: sinon
          .stub()
          .resolves({ found: true, reset: true, userID: this.user_id }),
      },
    }
    this.RateLimiter = { addCount: sinon.stub() }
    this.UserSessionsManager = {
      promises: {
        revokeAllUserSessions: sinon.stub().resolves(),
      },
    }
    this.UserUpdater = {
      promises: {
        removeReconfirmFlag: sinon.stub().resolves(),
      },
    }
    this.PasswordResetController = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': this.settings,
        './PasswordResetHandler': this.PasswordResetHandler,
        '../../infrastructure/RateLimiter': this.RateLimiter,
        '../Authentication/AuthenticationController': (this.AuthenticationController = {
          getLoggedInUserId: sinon.stub(),
          finishLogin: sinon.stub(),
        }),
        '../User/UserGetter': (this.UserGetter = {
          promises: {
            getUser: sinon.stub(),
          },
        }),
        '../User/UserSessionsManager': this.UserSessionsManager,
        '../User/UserUpdater': this.UserUpdater,
      },
    })
  })

  describe('requestReset', function () {
    it('should error if the rate limit is hit', function (done) {
      this.PasswordResetHandler.generateAndEmailResetToken.callsArgWith(
        1,
        null,
        'primary'
      )
      this.RateLimiter.addCount.callsArgWith(1, null, false)
      this.PasswordResetController.requestReset(this.req, this.res)
      this.PasswordResetHandler.generateAndEmailResetToken
        .calledWith(this.email)
        .should.equal(false)
      this.res.statusCode.should.equal(429)
      done()
    })

    it('should tell the handler to process that email', function (done) {
      this.RateLimiter.addCount.callsArgWith(1, null, true)
      this.PasswordResetHandler.generateAndEmailResetToken.callsArgWith(
        1,
        null,
        'primary'
      )
      this.PasswordResetController.requestReset(this.req, this.res)
      this.PasswordResetHandler.generateAndEmailResetToken
        .calledWith(this.email)
        .should.equal(true)
      this.res.statusCode.should.equal(200)
      done()
    })

    it('should send a 500 if there is an error', function (done) {
      this.RateLimiter.addCount.callsArgWith(1, null, true)
      this.PasswordResetHandler.generateAndEmailResetToken.callsArgWith(
        1,
        new Error('error')
      )
      this.PasswordResetController.requestReset(this.req, this.res, error => {
        expect(error).to.exist
        done()
      })
    })

    it("should send a 404 if the email doesn't exist", function (done) {
      this.RateLimiter.addCount.callsArgWith(1, null, true)
      this.PasswordResetHandler.generateAndEmailResetToken.callsArgWith(
        1,
        null,
        null
      )
      this.PasswordResetController.requestReset(this.req, this.res)
      this.res.statusCode.should.equal(404)
      done()
    })

    it('should send a 404 if the email is registered as a secondard email', function (done) {
      this.RateLimiter.addCount.callsArgWith(1, null, true)
      this.PasswordResetHandler.generateAndEmailResetToken.callsArgWith(
        1,
        null,
        'secondary'
      )
      this.PasswordResetController.requestReset(this.req, this.res)
      this.res.statusCode.should.equal(404)
      done()
    })

    it('should normalize the email address', function (done) {
      this.email = '  UPperCaseEMAILWithSpacesAround@example.Com '
      this.req.body.email = this.email
      this.RateLimiter.addCount.callsArgWith(1, null, true)
      this.PasswordResetHandler.generateAndEmailResetToken.callsArgWith(
        1,
        null,
        'primary'
      )
      this.PasswordResetController.requestReset(this.req, this.res)
      this.PasswordResetHandler.generateAndEmailResetToken
        .calledWith(this.email.toLowerCase().trim())
        .should.equal(true)
      this.res.statusCode.should.equal(200)
      done()
    })
  })

  describe('setNewUserPassword', function () {
    beforeEach(function () {
      this.req.session.resetToken = this.token
    })

    it('should tell the user handler to reset the password', function (done) {
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.PasswordResetHandler.promises.setNewUserPassword
          .calledWith(this.token, this.password)
          .should.equal(true)
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should preserve spaces in the password', function (done) {
      this.password = this.req.body.password = ' oh! clever! spaces around!   '
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.PasswordResetHandler.promises.setNewUserPassword.should.have.been.calledWith(
          this.token,
          this.password
        )
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should send 404 if the token was not found', function (done) {
      this.PasswordResetHandler.promises.setNewUserPassword.resolves({
        found: false,
        reset: false,
        userId: this.user_id,
      })
      this.res.sendStatus = code => {
        code.should.equal(404)
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should return 500 if not reset', function (done) {
      this.PasswordResetHandler.promises.setNewUserPassword.resolves({
        found: true,
        reset: false,
        userId: this.user_id,
      })
      this.res.sendStatus = code => {
        code.should.equal(500)
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should return 400 (Bad Request) if there is no password', function (done) {
      this.req.body.password = ''
      this.res.sendStatus = code => {
        code.should.equal(400)
        this.PasswordResetHandler.promises.setNewUserPassword.called.should.equal(
          false
        )
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should return 400 (Bad Request) if there is no passwordResetToken', function (done) {
      this.req.body.passwordResetToken = ''
      this.res.sendStatus = code => {
        code.should.equal(400)
        this.PasswordResetHandler.promises.setNewUserPassword.called.should.equal(
          false
        )
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should return 400 (Bad Request) if the password is invalid', function (done) {
      this.req.body.password = 'correct horse battery staple'
      const err = new Error('bad')
      err.name = 'InvalidPasswordError'
      this.PasswordResetHandler.promises.setNewUserPassword.rejects(err)
      this.res.sendStatus = code => {
        code.should.equal(400)
        this.PasswordResetHandler.promises.setNewUserPassword.called.should.equal(
          true
        )
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should clear the session.resetToken', function (done) {
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.req.session.should.not.have.property('resetToken')
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should clear sessions', function (done) {
      this.res.sendStatus = code => {
        this.UserSessionsManager.promises.revokeAllUserSessions.callCount.should.equal(
          1
        )
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should call removeReconfirmFlag', function (done) {
      this.res.sendStatus = code => {
        this.UserUpdater.promises.removeReconfirmFlag.callCount.should.equal(1)
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    describe('catch errors', function () {
      it('should return 404 for NotFoundError', function (done) {
        const anError = new Error('oops')
        anError.name = 'NotFoundError'
        this.PasswordResetHandler.promises.setNewUserPassword.rejects(anError)
        this.res.sendStatus = code => {
          code.should.equal(404)
          done()
        }
        this.PasswordResetController.setNewUserPassword(this.req, this.res)
      })
      it('should return 400 for InvalidPasswordError', function (done) {
        const anError = new Error('oops')
        anError.name = 'InvalidPasswordError'
        this.PasswordResetHandler.promises.setNewUserPassword.rejects(anError)
        this.res.sendStatus = code => {
          code.should.equal(400)
          done()
        }
        this.PasswordResetController.setNewUserPassword(this.req, this.res)
      })
      it('should return 500 for other errors', function (done) {
        const anError = new Error('oops')
        this.PasswordResetHandler.promises.setNewUserPassword.rejects(anError)
        this.res.sendStatus = code => {
          code.should.equal(500)
          done()
        }
        this.PasswordResetController.setNewUserPassword(this.req, this.res)
      })
    })

    describe('when doLoginAfterPasswordReset is set', function () {
      beforeEach(function () {
        this.user = {
          _id: this.userId,
          email: 'joe@example.com',
        }
        this.UserGetter.promises.getUser.resolves(this.user)
        this.req.session.doLoginAfterPasswordReset = 'true'
      })

      it('should login user', function (done) {
        this.AuthenticationController.finishLogin.callsFake((...args) => {
          expect(args[0]).to.equal(this.user)
          done()
        })
        this.PasswordResetController.setNewUserPassword(this.req, this.res)
      })
    })
  })

  describe('renderSetPasswordForm', function () {
    describe('with token in query-string', function () {
      beforeEach(function () {
        this.req.query.passwordResetToken = this.token
      })

      it('should set session.resetToken and redirect', function (done) {
        this.req.session.should.not.have.property('resetToken')
        this.res.redirect = path => {
          path.should.equal('/user/password/set')
          this.req.session.resetToken.should.equal(this.token)
          done()
        }
        this.PasswordResetController.renderSetPasswordForm(this.req, this.res)
      })
    })

    describe('with token and email in query-string', function () {
      beforeEach(function () {
        this.req.query.passwordResetToken = this.token
        this.req.query.email = 'foo@bar.com'
      })

      it('should set session.resetToken and redirect with email', function (done) {
        this.req.session.should.not.have.property('resetToken')
        this.res.redirect = path => {
          path.should.equal('/user/password/set?email=foo%40bar.com')
          this.req.session.resetToken.should.equal(this.token)
          done()
        }
        this.PasswordResetController.renderSetPasswordForm(this.req, this.res)
      })
    })

    describe('with token and invalid email in query-string', function () {
      beforeEach(function () {
        this.req.query.passwordResetToken = this.token
        this.req.query.email = 'not-an-email'
      })

      it('should set session.resetToken and redirect without email', function (done) {
        this.req.session.should.not.have.property('resetToken')
        this.res.redirect = path => {
          path.should.equal('/user/password/set')
          this.req.session.resetToken.should.equal(this.token)
          done()
        }
        this.PasswordResetController.renderSetPasswordForm(this.req, this.res)
      })
    })

    describe('with token and non-string email in query-string', function () {
      beforeEach(function () {
        this.req.query.passwordResetToken = this.token
        this.req.query.email = { foo: 'bar' }
      })

      it('should set session.resetToken and redirect without email', function (done) {
        this.req.session.should.not.have.property('resetToken')
        this.res.redirect = path => {
          path.should.equal('/user/password/set')
          this.req.session.resetToken.should.equal(this.token)
          done()
        }
        this.PasswordResetController.renderSetPasswordForm(this.req, this.res)
      })
    })

    describe('without a token in query-string', function () {
      describe('with token in session', function () {
        beforeEach(function () {
          this.req.session.resetToken = this.token
        })

        it('should render the page, passing the reset token', function (done) {
          this.res.render = (templatePath, options) => {
            options.passwordResetToken.should.equal(this.req.session.resetToken)
            done()
          }
          this.PasswordResetController.renderSetPasswordForm(this.req, this.res)
        })
      })

      describe('without a token in session', function () {
        it('should redirect to the reset request page', function (done) {
          this.res.redirect = path => {
            path.should.equal('/user/password/reset')
            this.req.session.should.not.have.property('resetToken')
            done()
          }
          this.PasswordResetController.renderSetPasswordForm(this.req, this.res)
        })
      })
    })
  })
})
