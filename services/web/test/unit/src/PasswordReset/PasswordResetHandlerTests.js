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
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const chai = require('chai')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/PasswordReset/PasswordResetHandler'
)
const should = require('chai').should()
chai.use(sinonChai)
const { expect } = chai

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
    this.PasswordResetHandler = SandboxedModule.require(modulePath, {
      globals: { console: console },
      requires: {
        '../User/UserGetter': this.UserGetter,
        '../Security/OneTimeTokenHandler': this.OneTimeTokenHandler,
        '../Email/EmailHandler': this.EmailHandler,
        '../Authentication/AuthenticationManager': this.AuthenticationManager,
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    })
    this.token = '12312321i'
    this.user_id = 'user_id_here'
    this.user = { email: (this.email = 'bob@bob.com'), _id: 'user-id' }
    this.password = 'my great secret password'
    this.callback = sinon.stub()
    // this should not have any effect now
    this.settings.overleaf = true
  })

  afterEach(function() {
    this.settings.overleaf = false
  })

  describe('generateAndEmailResetToken', function() {
    it('should check the user exists', function() {
      this.UserGetter.getUserByAnyEmail.yields()
      this.PasswordResetHandler.generateAndEmailResetToken(
        this.user.email,
        this.callback
      )
      this.UserGetter.getUserByAnyEmail.should.have.been.calledWith(
        this.user.email
      )
    })

    it('should send the email with the token', function(done) {
      this.UserGetter.getUserByAnyEmail.yields(null, this.user)
      this.OneTimeTokenHandler.getNewToken.yields(null, this.token)
      this.EmailHandler.sendEmail.yields()
      this.PasswordResetHandler.generateAndEmailResetToken(
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
          done()
        }
      )
    })

    describe('when the email exists', function() {
      beforeEach(function() {
        this.UserGetter.getUserByAnyEmail.yields(null, this.user)
        this.OneTimeTokenHandler.getNewToken.yields(null, this.token)
        this.EmailHandler.sendEmail.yields()
        this.PasswordResetHandler.generateAndEmailResetToken(
          this.email,
          this.callback
        )
      })

      it('should set the password token data to the user id and email', function() {
        this.OneTimeTokenHandler.getNewToken.should.have.been.calledWith(
          'password',
          {
            email: this.email,
            user_id: this.user._id
          }
        )
      })

      it('should send an email with the token', function() {
        this.EmailHandler.sendEmail.called.should.equal(true)
        const args = this.EmailHandler.sendEmail.args[0]
        args[0].should.equal('passwordResetRequested')
        args[1].setNewPasswordUrl.should.equal(
          `${this.settings.siteUrl}/user/password/set?passwordResetToken=${
            this.token
          }&email=${encodeURIComponent(this.user.email)}`
        )
      })

      it('should return status == true', function() {
        this.callback.calledWith(null, 'primary').should.equal(true)
      })
    })

    describe("when the email doesn't exist", function() {
      beforeEach(function() {
        this.UserGetter.getUserByAnyEmail.yields(null, null)
        this.PasswordResetHandler.generateAndEmailResetToken(
          this.email,
          this.callback
        )
      })

      it('should not set the password token data', function() {
        this.OneTimeTokenHandler.getNewToken.called.should.equal(false)
      })

      it('should send an email with the token', function() {
        this.EmailHandler.sendEmail.called.should.equal(false)
      })

      it('should return status == null', function() {
        this.callback.calledWith(null, null).should.equal(true)
      })
    })

    describe('when the email is a secondary email', function() {
      beforeEach(function() {
        this.UserGetter.getUserByAnyEmail.callsArgWith(1, null, this.user)
        this.PasswordResetHandler.generateAndEmailResetToken(
          'secondary@email.com',
          this.callback
        )
      })

      it('should not set the password token data', function() {
        this.OneTimeTokenHandler.getNewToken.called.should.equal(false)
      })

      it('should not send an email with the token', function() {
        this.EmailHandler.sendEmail.called.should.equal(false)
      })

      it('should return status == secondary', function() {
        this.callback.calledWith(null, 'secondary').should.equal(true)
      })
    })
  })

  describe('setNewUserPassword', function() {
    describe('when no data is found', function() {
      beforeEach(function() {
        this.OneTimeTokenHandler.getValueFromTokenAndExpire.yields(null, null)
        this.PasswordResetHandler.setNewUserPassword(
          this.token,
          this.password,
          this.callback
        )
      })

      it('should return exists == false', function() {
        this.callback.calledWith(null, false).should.equal(true)
      })
    })

    describe('when the token has a user_id and email', function() {
      beforeEach(function() {
        this.OneTimeTokenHandler.getValueFromTokenAndExpire
          .withArgs('password', this.token)
          .yields(null, {
            user_id: this.user._id,
            email: this.email
          })
        this.AuthenticationManager.setUserPassword
          .withArgs(this.user._id, this.password)
          .yields(null, true, this.user._id)
      })

      describe('when no user is found with this email', function() {
        beforeEach(function() {
          this.UserGetter.getUserByMainEmail
            .withArgs(this.email)
            .yields(null, null)
        })

        it('should return found == false', function(done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            (err, found) => {
              if (err != null) {
                return done(err)
              }
              expect(found).to.be.false
              done()
            }
          )
        })
      })

      describe("when the email and user don't match", function() {
        beforeEach(function() {
          this.UserGetter.getUserByMainEmail
            .withArgs(this.email)
            .yields(null, { _id: 'not-the-same', email: this.email })
        })

        it('should return found == false', function(done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            (err, found) => {
              if (err != null) {
                return done(err)
              }
              expect(found).to.be.false
              done()
            }
          )
        })
      })

      describe('when the email and user match', function() {
        beforeEach(function() {
          this.PasswordResetHandler.getUserForPasswordResetToken = sinon
            .stub()
            .withArgs(this.token)
            .yields(null, this.user)
        })

        it('should return found == true and the user id', function(done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            (err, found, userId) => {
              if (err != null) {
                return done(err)
              }
              expect(found).to.be.true
              expect(userId).to.equal(this.user._id)
              done()
            }
          )
        })
      })
    })

    describe('when the token has a v1_user_id and email', function() {
      beforeEach(function() {
        this.user.overleaf = { id: 184 }
        this.OneTimeTokenHandler.getValueFromTokenAndExpire
          .withArgs('password', this.token)
          .yields(null, {
            v1_user_id: this.user.overleaf.id,
            email: this.email
          })
        this.AuthenticationManager.setUserPassword
          .withArgs(this.user._id, this.password)
          .yields(null, true)
      })

      describe('when no user is found with this email', function() {
        beforeEach(function() {
          this.UserGetter.getUserByMainEmail
            .withArgs(this.email)
            .yields(null, null)
        })

        it('should return found == false', function(done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            (err, found) => {
              if (err != null) {
                return done(err)
              }
              expect(found).to.be.false
              done()
            }
          )
        })
      })

      describe("when the email and user don't match", function() {
        beforeEach(function() {
          this.UserGetter.getUserByMainEmail.withArgs(this.email).yields(null, {
            _id: this.user._id,
            email: this.email,
            overleaf: { id: 'not-the-same' }
          })
        })

        it('should return found == false', function(done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            (err, found) => {
              if (err != null) {
                return done(err)
              }
              expect(found).to.be.false
              done()
            }
          )
        })
      })

      describe('when the email and user match', function() {
        beforeEach(function() {
          this.UserGetter.getUserByMainEmail
            .withArgs(this.email)
            .yields(null, this.user)
        })

        it('should return found == true and the user id', function(done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            (err, found, userId) => {
              if (err != null) {
                return done(err)
              }
              expect(found).to.be.true
              expect(userId).to.equal(this.user._id)
              done()
            }
          )
        })
      })
    })
  })
})
