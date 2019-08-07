/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
let { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/PasswordReset/PasswordResetController'
)
;({ expect } = require('chai'))

describe('PasswordResetController', function() {
  beforeEach(function() {
    this.settings = {}
    this.PasswordResetHandler = {
      generateAndEmailResetToken: sinon.stub(),
      setNewUserPassword: sinon.stub()
    }
    this.RateLimiter = { addCount: sinon.stub() }
    this.UserSessionsManager = {
      revokeAllUserSessions: sinon.stub().callsArgWith(2, null)
    }
    this.AuthenticationManager = { validatePassword: sinon.stub() }
    this.UserUpdater = {
      removeReconfirmFlag: sinon.stub().callsArgWith(1, null)
    }
    this.PasswordResetController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        './PasswordResetHandler': this.PasswordResetHandler,
        'logger-sharelatex': {
          log() {}
        },
        '../../infrastructure/RateLimiter': this.RateLimiter,
        '../Authentication/AuthenticationController': (this.AuthenticationController = {}),
        '../Authentication/AuthenticationManager': this.AuthenticationManager,
        '../User/UserGetter': (this.UserGetter = {}),
        '../User/UserSessionsManager': this.UserSessionsManager,
        '../User/UserUpdater': this.UserUpdater
      }
    })

    this.email = 'bob@bob.com '
    this.user_id = 'mock-user-id'
    this.token = 'my security token that was emailed to me'
    this.password = 'my new password'
    this.req = {
      body: {
        email: this.email,
        passwordResetToken: this.token,
        password: this.password
      },
      i18n: {
        translate() {}
      },
      session: {},
      query: {}
    }

    this.res = {}
  })

  describe('requestReset', function() {
    it('should error if the rate limit is hit', function(done) {
      this.PasswordResetHandler.generateAndEmailResetToken.callsArgWith(
        1,
        null,
        'primary'
      )
      this.RateLimiter.addCount.callsArgWith(1, null, false)
      this.res.send = code => {
        code.should.equal(429)
        this.PasswordResetHandler.generateAndEmailResetToken
          .calledWith(this.email.trim())
          .should.equal(false)
        return done()
      }
      return this.PasswordResetController.requestReset(this.req, this.res)
    })

    it('should tell the handler to process that email', function(done) {
      this.RateLimiter.addCount.callsArgWith(1, null, true)
      this.PasswordResetHandler.generateAndEmailResetToken.callsArgWith(
        1,
        null,
        'primary'
      )
      this.res.send = code => {
        code.should.equal(200)
        this.PasswordResetHandler.generateAndEmailResetToken
          .calledWith(this.email.trim())
          .should.equal(true)
        return done()
      }
      return this.PasswordResetController.requestReset(this.req, this.res)
    })

    it('should send a 500 if there is an error', function(done) {
      this.RateLimiter.addCount.callsArgWith(1, null, true)
      this.PasswordResetHandler.generateAndEmailResetToken.callsArgWith(
        1,
        'error'
      )
      this.res.send = code => {
        code.should.equal(500)
        return done()
      }
      return this.PasswordResetController.requestReset(this.req, this.res)
    })

    it("should send a 404 if the email doesn't exist", function(done) {
      this.RateLimiter.addCount.callsArgWith(1, null, true)
      this.PasswordResetHandler.generateAndEmailResetToken.callsArgWith(
        1,
        null,
        null
      )
      this.res.send = code => {
        code.should.equal(404)
        return done()
      }
      return this.PasswordResetController.requestReset(this.req, this.res)
    })

    it('should send a 404 if the email is registered as a secondard email', function(done) {
      this.RateLimiter.addCount.callsArgWith(1, null, true)
      this.PasswordResetHandler.generateAndEmailResetToken.callsArgWith(
        1,
        null,
        'secondary'
      )
      this.res.send = code => {
        code.should.equal(404)
        return done()
      }
      return this.PasswordResetController.requestReset(this.req, this.res)
    })

    it('should lowercase the email address', function(done) {
      this.email = 'UPerCaseEMAIL@example.Com'
      this.req.body.email = this.email
      this.RateLimiter.addCount.callsArgWith(1, null, true)
      this.PasswordResetHandler.generateAndEmailResetToken.callsArgWith(
        1,
        null,
        'primary'
      )
      this.res.send = code => {
        code.should.equal(200)
        this.PasswordResetHandler.generateAndEmailResetToken
          .calledWith(this.email.toLowerCase())
          .should.equal(true)
        return done()
      }
      return this.PasswordResetController.requestReset(this.req, this.res)
    })
  })

  describe('setNewUserPassword', function() {
    beforeEach(function() {
      return (this.req.session.resetToken = this.token)
    })

    it('should tell the user handler to reset the password', function(done) {
      this.PasswordResetHandler.setNewUserPassword.callsArgWith(
        2,
        null,
        true,
        this.user_id
      )
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.PasswordResetHandler.setNewUserPassword
          .calledWith(this.token, this.password)
          .should.equal(true)
        return done()
      }
      return this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it("should send 404 if the token didn't work", function(done) {
      this.PasswordResetHandler.setNewUserPassword.callsArgWith(
        2,
        null,
        false,
        this.user_id
      )
      this.res.status = code => {
        code.should.equal(404)
        done()
      }
      return this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should return 400 (Bad Request) if there is no password', function(done) {
      this.req.body.password = ''
      this.PasswordResetHandler.setNewUserPassword.callsArgWith(2)
      this.res.sendStatus = code => {
        code.should.equal(400)
        this.PasswordResetHandler.setNewUserPassword.called.should.equal(false)
        return done()
      }
      return this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should return 400 (Bad Request) if there is no passwordResetToken', function(done) {
      this.req.body.passwordResetToken = ''
      this.PasswordResetHandler.setNewUserPassword.callsArgWith(2)
      this.res.sendStatus = code => {
        code.should.equal(400)
        this.PasswordResetHandler.setNewUserPassword.called.should.equal(false)
        return done()
      }
      return this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should return 400 (Bad Request) if the password is invalid', function(done) {
      this.req.body.password = 'correct horse battery staple'
      this.AuthenticationManager.validatePassword = sinon
        .stub()
        .returns({ message: 'password contains invalid characters' })
      this.PasswordResetHandler.setNewUserPassword.callsArgWith(2)
      this.res.sendStatus = code => {
        code.should.equal(400)
        this.PasswordResetHandler.setNewUserPassword.called.should.equal(false)
        return done()
      }
      return this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should clear the session.resetToken', function(done) {
      this.PasswordResetHandler.setNewUserPassword.callsArgWith(
        2,
        null,
        true,
        this.user_id
      )
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.req.session.should.not.have.property('resetToken')
        return done()
      }
      return this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should clear sessions', function(done) {
      this.PasswordResetHandler.setNewUserPassword.callsArgWith(
        2,
        null,
        true,
        this.user_id
      )
      this.res.sendStatus = code => {
        this.UserSessionsManager.revokeAllUserSessions.callCount.should.equal(1)
        return done()
      }
      return this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should call removeReconfirmFlag', function(done) {
      this.PasswordResetHandler.setNewUserPassword.callsArgWith(
        2,
        null,
        true,
        this.user_id
      )
      this.res.sendStatus = code => {
        this.UserUpdater.removeReconfirmFlag.callCount.should.equal(1)
        return done()
      }
      return this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    describe('when login_after is set', function() {
      beforeEach(function() {
        this.UserGetter.getUser = sinon
          .stub()
          .callsArgWith(2, null, { email: 'joe@example.com' })
        this.PasswordResetHandler.setNewUserPassword.callsArgWith(
          2,
          null,
          true,
          (this.user_id = 'user-id-123')
        )
        this.req.body.login_after = 'true'
        this.res.json = sinon.stub()
        this.AuthenticationController.afterLoginSessionSetup = sinon
          .stub()
          .callsArgWith(2, null)
        return (this.AuthenticationController._getRedirectFromSession = sinon
          .stub()
          .returns('/some/path'))
      })

      it('should login user if login_after is set', function(done) {
        this.PasswordResetController.setNewUserPassword(this.req, this.res)
        this.AuthenticationController.afterLoginSessionSetup.callCount.should.equal(
          1
        )
        this.AuthenticationController.afterLoginSessionSetup
          .calledWith(this.req, { email: 'joe@example.com' })
          .should.equal(true)
        this.AuthenticationController._getRedirectFromSession.callCount.should.equal(
          1
        )
        this.res.json.callCount.should.equal(1)
        this.res.json.calledWith({ redir: '/some/path' }).should.equal(true)
        return done()
      })
    })
  })

  describe('renderSetPasswordForm', function() {
    describe('with token in query-string', function() {
      beforeEach(function() {
        return (this.req.query.passwordResetToken = this.token)
      })

      it('should set session.resetToken and redirect', function(done) {
        this.req.session.should.not.have.property('resetToken')
        this.res.redirect = path => {
          path.should.equal('/user/password/set')
          this.req.session.resetToken.should.equal(this.token)
          return done()
        }
        return this.PasswordResetController.renderSetPasswordForm(
          this.req,
          this.res
        )
      })
    })

    describe('without a token in query-string', function() {
      describe('with token in session', function() {
        beforeEach(function() {
          return (this.req.session.resetToken = this.token)
        })

        it('should render the page, passing the reset token', function(done) {
          this.res.render = (template_path, options) => {
            options.passwordResetToken.should.equal(this.req.session.resetToken)
            return done()
          }
          return this.PasswordResetController.renderSetPasswordForm(
            this.req,
            this.res
          )
        })
      })

      describe('without a token in session', function() {
        it('should redirect to the reset request page', function(done) {
          this.res.redirect = path => {
            path.should.equal('/user/password/reset')
            this.req.session.should.not.have.property('resetToken')
            return done()
          }
          return this.PasswordResetController.renderSetPasswordForm(
            this.req,
            this.res
          )
        })
      })
    })
  })
})
