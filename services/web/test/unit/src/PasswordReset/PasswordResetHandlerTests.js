/* eslint-disable
    handle-callback-err,
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
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/PasswordReset/PasswordResetHandler'
)
const { expect } = require('chai')

describe('PasswordResetHandler', function() {
  beforeEach(function() {
    this.settings = { siteUrl: 'www.sharelatex.com' }
    this.OneTimeTokenHandler = {
      getNewToken: sinon.stub(),
      getValueFromTokenAndExpire: sinon.stub()
    }
    this.UserGetter = {
      getUserByMainEmail: sinon.stub(),
      getUser: sinon.stub(),
      getUserByAnyEmail: sinon.stub()
    }
    this.EmailHandler = { sendEmail: sinon.stub() }
    this.AuthenticationManager = {
      setUserPassword: sinon.stub(),
      setUserPasswordInV1: sinon.stub(),
      setUserPasswordInV2: sinon.stub()
    }
    this.V1Api = { request: sinon.stub() }
    this.PasswordResetHandler = SandboxedModule.require(modulePath, {
      requires: {
        '../User/UserGetter': this.UserGetter,
        '../Security/OneTimeTokenHandler': this.OneTimeTokenHandler,
        '../Email/EmailHandler': this.EmailHandler,
        '../Authentication/AuthenticationManager': this.AuthenticationManager,
        '../V1/V1Api': this.V1Api,
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    })
    this.token = '12312321i'
    this.user_id = 'user_id_here'
    this.user = { email: (this.email = 'bob@bob.com') }
    this.password = 'my great secret password'
    return (this.callback = sinon.stub())
  })

  describe('generateAndEmailResetToken', function() {
    describe('when in ShareLaTeX', function() {
      it('should check the user exists', function(done) {
        this.UserGetter.getUserByMainEmail.callsArgWith(1)
        this.UserGetter.getUserByAnyEmail.callsArgWith(1)
        this.OneTimeTokenHandler.getNewToken.yields()
        return this.PasswordResetHandler.generateAndEmailResetToken(
          this.user.email,
          (err, status) => {
            should.equal(status, null)
            return done()
          }
        )
      })

      it('should send the email with the token', function(done) {
        this.UserGetter.getUserByMainEmail.callsArgWith(1, null, this.user)
        this.OneTimeTokenHandler.getNewToken.yields(null, this.token)
        this.EmailHandler.sendEmail.callsArgWith(2)
        return this.PasswordResetHandler.generateAndEmailResetToken(
          this.user.email,
          (err, status) => {
            this.EmailHandler.sendEmail.called.should.equal(true)
            status.should.equal('primary')
            const args = this.EmailHandler.sendEmail.args[0]
            args[0].should.equal('passwordResetRequested')
            args[1].setNewPasswordUrl.should.equal(
              `${this.settings.siteUrl}/user/password/set?passwordResetToken=${
                this.token
              }&email=${encodeURIComponent(this.user.email)}`
            )
            return done()
          }
        )
      })

      return it('should return exists == null for a holdingAccount', function(done) {
        this.user.holdingAccount = true
        this.UserGetter.getUserByMainEmail.callsArgWith(1, null, this.user)
        this.UserGetter.getUserByAnyEmail.callsArgWith(1)
        this.OneTimeTokenHandler.getNewToken.yields()
        return this.PasswordResetHandler.generateAndEmailResetToken(
          this.user.email,
          (err, status) => {
            should.equal(status, null)
            return done()
          }
        )
      })
    })

    return describe('when in overleaf', function() {
      beforeEach(function() {
        return (this.settings.overleaf = true)
      })

      describe('when the email exists', function() {
        beforeEach(function() {
          this.V1Api.request.yields(null, {}, { user_id: 42 })
          this.OneTimeTokenHandler.getNewToken.yields(null, this.token)
          this.EmailHandler.sendEmail.yields()
          return this.PasswordResetHandler.generateAndEmailResetToken(
            this.email,
            this.callback
          )
        })

        it('should call the v1 api for the user', function() {
          return this.V1Api.request
            .calledWith({
              url: '/api/v1/sharelatex/user_emails',
              qs: {
                email: this.email
              },
              expectedStatusCodes: [404]
            })
            .should.equal(true)
        })

        it('should set the password token data to the user id and email', function() {
          return this.OneTimeTokenHandler.getNewToken
            .calledWith('password', {
              v1_user_id: 42
            })
            .should.equal(true)
        })

        it('should send an email with the token', function() {
          this.EmailHandler.sendEmail.called.should.equal(true)
          const args = this.EmailHandler.sendEmail.args[0]
          args[0].should.equal('passwordResetRequested')
          return args[1].setNewPasswordUrl.should.equal(
            `${this.settings.siteUrl}/user/password/set?passwordResetToken=${
              this.token
            }&email=${encodeURIComponent(this.user.email)}`
          )
        })

        return it('should return status == true', function() {
          return this.callback.calledWith(null, 'primary').should.equal(true)
        })
      })

      describe("when the email doesn't exist", function() {
        beforeEach(function() {
          this.V1Api.request = sinon
            .stub()
            .yields(null, { statusCode: 404 }, {})
          this.UserGetter.getUserByAnyEmail.callsArgWith(1)
          return this.PasswordResetHandler.generateAndEmailResetToken(
            this.email,
            this.callback
          )
        })

        it('should not set the password token data', function() {
          return this.OneTimeTokenHandler.getNewToken.called.should.equal(false)
        })

        it('should send an email with the token', function() {
          return this.EmailHandler.sendEmail.called.should.equal(false)
        })

        return it('should return status == null', function() {
          return this.callback.calledWith(null, null).should.equal(true)
        })
      })

      describe("when the user isn't on v2", function() {
        beforeEach(function() {
          this.V1Api.request = sinon
            .stub()
            .yields(null, { statusCode: 404 }, {})
          this.UserGetter.getUserByAnyEmail.callsArgWith(1, null, this.user)
          return this.PasswordResetHandler.generateAndEmailResetToken(
            this.email,
            this.callback
          )
        })

        it('should not set the password token data', function() {
          return this.OneTimeTokenHandler.getNewToken.called.should.equal(false)
        })

        it('should not send an email with the token', function() {
          return this.EmailHandler.sendEmail.called.should.equal(false)
        })

        return it('should return status == sharelatex', function() {
          return this.callback.calledWith(null, 'sharelatex').should.equal(true)
        })
      })

      return describe('when the email is a secondary email', function() {
        beforeEach(function() {
          this.V1Api.request = sinon
            .stub()
            .yields(null, { statusCode: 404 }, {})
          this.user.overleaf = { id: 101 }
          this.UserGetter.getUserByAnyEmail.callsArgWith(1, null, this.user)
          return this.PasswordResetHandler.generateAndEmailResetToken(
            this.email,
            this.callback
          )
        })

        it('should not set the password token data', function() {
          return this.OneTimeTokenHandler.getNewToken.called.should.equal(false)
        })

        it('should not send an email with the token', function() {
          return this.EmailHandler.sendEmail.called.should.equal(false)
        })

        return it('should return status == secondary', function() {
          return this.callback.calledWith(null, 'secondary').should.equal(true)
        })
      })
    })
  })

  return describe('setNewUserPassword', function() {
    describe('when no data is found', function() {
      beforeEach(function() {
        this.OneTimeTokenHandler.getValueFromTokenAndExpire.yields(null, null)
        return this.PasswordResetHandler.setNewUserPassword(
          this.token,
          this.password,
          this.callback
        )
      })

      return it('should return exists == false', function() {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })

    describe('when the data is an old style user_id', function() {
      beforeEach(function() {
        this.AuthenticationManager.setUserPassword.yields(
          null,
          true,
          this.user_id
        )
        this.OneTimeTokenHandler.getValueFromTokenAndExpire.yields(
          null,
          this.user_id
        )
        return this.PasswordResetHandler.setNewUserPassword(
          this.token,
          this.password,
          this.callback
        )
      })

      it('should call setUserPasswordInV2', function() {
        return this.AuthenticationManager.setUserPassword
          .calledWith(this.user_id, this.password)
          .should.equal(true)
      })

      return it('should reset == true and the user_id', function() {
        return this.callback
          .calledWith(null, true, this.user_id)
          .should.equal(true)
      })
    })

    return describe('when the data is a new style user_id', function() {
      beforeEach(function() {
        this.AuthenticationManager.setUserPassword.yields(
          null,
          true,
          this.user_id
        )
        this.OneTimeTokenHandler.getValueFromTokenAndExpire.yields(null, {
          user_id: this.user_id
        })
        return this.PasswordResetHandler.setNewUserPassword(
          this.token,
          this.password,
          this.callback
        )
      })

      it('should call setUserPasswordInV2', function() {
        return this.AuthenticationManager.setUserPassword
          .calledWith(this.user_id, this.password)
          .should.equal(true)
      })

      return it('should reset == true and the user_id', function() {
        return this.callback
          .calledWith(null, true, this.user_id)
          .should.equal(true)
      })
    })
  })
})
