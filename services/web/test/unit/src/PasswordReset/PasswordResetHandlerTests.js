/* eslint-disable
    node/handle-callback-err,
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
const { expect } = require('chai')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/PasswordReset/PasswordResetHandler'
)

describe('PasswordResetHandler', function () {
  beforeEach(function () {
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
      setUserPasswordInV2: sinon.stub(),
      promises: {
        setUserPassword: sinon.stub().resolves()
      }
    }
    this.PasswordResetHandler = SandboxedModule.require(modulePath, {
      requires: {
        '../User/UserAuditLogHandler': (this.UserAuditLogHandler = {
          promises: {
            addEntry: sinon.stub().resolves()
          }
        }),
        '../User/UserGetter': this.UserGetter,
        '../Security/OneTimeTokenHandler': this.OneTimeTokenHandler,
        '../Email/EmailHandler': this.EmailHandler,
        '../Authentication/AuthenticationManager': this.AuthenticationManager,
        'settings-sharelatex': this.settings
      }
    })
    this.token = '12312321i'
    this.user_id = 'user_id_here'
    this.user = { email: (this.email = 'bob@bob.com'), _id: this.user_id }
    this.password = 'my great secret password'
    this.callback = sinon.stub()
    // this should not have any effect now
    this.settings.overleaf = true
  })

  afterEach(function () {
    this.settings.overleaf = false
  })

  describe('generateAndEmailResetToken', function () {
    it('should check the user exists', function () {
      this.UserGetter.getUserByAnyEmail.yields()
      this.PasswordResetHandler.generateAndEmailResetToken(
        this.user.email,
        this.callback
      )
      this.UserGetter.getUserByAnyEmail.should.have.been.calledWith(
        this.user.email
      )
    })

    it('should send the email with the token', function (done) {
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

    describe('when the email exists', function () {
      beforeEach(function () {
        this.UserGetter.getUserByAnyEmail.yields(null, this.user)
        this.OneTimeTokenHandler.getNewToken.yields(null, this.token)
        this.EmailHandler.sendEmail.yields()
        this.PasswordResetHandler.generateAndEmailResetToken(
          this.email,
          this.callback
        )
      })

      it('should set the password token data to the user id and email', function () {
        this.OneTimeTokenHandler.getNewToken.should.have.been.calledWith(
          'password',
          {
            email: this.email,
            user_id: this.user._id
          }
        )
      })

      it('should send an email with the token', function () {
        this.EmailHandler.sendEmail.called.should.equal(true)
        const args = this.EmailHandler.sendEmail.args[0]
        args[0].should.equal('passwordResetRequested')
        args[1].setNewPasswordUrl.should.equal(
          `${this.settings.siteUrl}/user/password/set?passwordResetToken=${
            this.token
          }&email=${encodeURIComponent(this.user.email)}`
        )
      })

      it('should return status == true', function () {
        this.callback.calledWith(null, 'primary').should.equal(true)
      })
    })

    describe("when the email doesn't exist", function () {
      beforeEach(function () {
        this.UserGetter.getUserByAnyEmail.yields(null, null)
        this.PasswordResetHandler.generateAndEmailResetToken(
          this.email,
          this.callback
        )
      })

      it('should not set the password token data', function () {
        this.OneTimeTokenHandler.getNewToken.called.should.equal(false)
      })

      it('should send an email with the token', function () {
        this.EmailHandler.sendEmail.called.should.equal(false)
      })

      it('should return status == null', function () {
        this.callback.calledWith(null, null).should.equal(true)
      })
    })

    describe('when the email is a secondary email', function () {
      beforeEach(function () {
        this.UserGetter.getUserByAnyEmail.callsArgWith(1, null, this.user)
        this.PasswordResetHandler.generateAndEmailResetToken(
          'secondary@email.com',
          this.callback
        )
      })

      it('should not set the password token data', function () {
        this.OneTimeTokenHandler.getNewToken.called.should.equal(false)
      })

      it('should not send an email with the token', function () {
        this.EmailHandler.sendEmail.called.should.equal(false)
      })

      it('should return status == secondary', function () {
        this.callback.calledWith(null, 'secondary').should.equal(true)
      })
    })
  })

  describe('setNewUserPassword', function () {
    beforeEach(function () {
      this.auditLog = { ip: '0:0:0:0' }
    })
    describe('when no data is found', function () {
      beforeEach(function () {
        this.OneTimeTokenHandler.getValueFromTokenAndExpire.yields(null, null)
      })

      it('should return found == false and reset == false', function () {
        this.PasswordResetHandler.setNewUserPassword(
          this.token,
          this.password,
          this.auditLog,
          (error, result) => {
            expect(error).to.not.exist
            expect(result).to.deep.equal({
              found: false,
              reset: false,
              userId: null
            })
          }
        )
      })
    })

    describe('when the token has a user_id and email', function () {
      beforeEach(function () {
        this.OneTimeTokenHandler.getValueFromTokenAndExpire
          .withArgs('password', this.token)
          .yields(null, {
            user_id: this.user._id,
            email: this.email
          })
        this.AuthenticationManager.promises.setUserPassword
          .withArgs(this.user, this.password)
          .resolves(true)
      })

      describe('when no user is found with this email', function () {
        beforeEach(function () {
          this.UserGetter.getUserByMainEmail
            .withArgs(this.email)
            .yields(null, null)
        })

        it('should return found == false and reset == false', function (done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            this.auditLog,
            (err, result) => {
              const { found, reset, userId } = result
              expect(err).to.not.exist
              expect(found).to.be.false
              expect(reset).to.be.false
              done()
            }
          )
        })
      })

      describe("when the email and user don't match", function () {
        beforeEach(function () {
          this.UserGetter.getUserByMainEmail
            .withArgs(this.email)
            .yields(null, { _id: 'not-the-same', email: this.email })
        })

        it('should return found == false and reset == false', function (done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            this.auditLog,
            (err, result) => {
              const { found, reset, userId } = result
              expect(err).to.not.exist
              expect(found).to.be.false
              expect(reset).to.be.false
              done()
            }
          )
        })
      })

      describe('when the email and user match', function () {
        describe('success', function () {
          beforeEach(function () {
            this.UserGetter.getUserByMainEmail.yields(null, this.user)
          })

          it('should update the user audit log', function (done) {
            this.PasswordResetHandler.setNewUserPassword(
              this.token,
              this.password,
              this.auditLog,
              (error, result) => {
                const { reset, userId } = result
                expect(error).to.not.exist
                const logCall = this.UserAuditLogHandler.promises.addEntry
                  .lastCall
                expect(logCall.args[0]).to.equal(this.user_id)
                expect(logCall.args[1]).to.equal('reset-password')
                expect(logCall.args[2]).to.equal(undefined)
                expect(logCall.args[3]).to.equal(this.auditLog.ip)
                expect(logCall.args[4]).to.equal(undefined)
                done()
              }
            )
          })

          it('should return reset == true and the user id', function (done) {
            this.PasswordResetHandler.setNewUserPassword(
              this.token,
              this.password,
              this.auditLog,
              (err, result) => {
                const { reset, userId } = result
                expect(err).to.not.exist
                expect(reset).to.be.true
                expect(userId).to.equal(this.user._id)
                done()
              }
            )
          })

          describe('when logged in', function () {
            beforeEach(function () {
              this.auditLog.initiatorId = this.user_id
            })
            it('should update the user audit log with initiatorId', function (done) {
              this.PasswordResetHandler.setNewUserPassword(
                this.token,
                this.password,
                this.auditLog,
                (error, result) => {
                  const { reset, userId } = result
                  expect(error).to.not.exist
                  const logCall = this.UserAuditLogHandler.promises.addEntry
                    .lastCall
                  expect(logCall.args[0]).to.equal(this.user_id)
                  expect(logCall.args[1]).to.equal('reset-password')
                  expect(logCall.args[2]).to.equal(this.user_id)
                  expect(logCall.args[3]).to.equal(this.auditLog.ip)
                  expect(logCall.args[4]).to.equal(undefined)
                  done()
                }
              )
            })
          })
        })

        describe('errors', function () {
          describe('via UserAuditLogHandler', function () {
            beforeEach(function () {
              this.PasswordResetHandler.promises.getUserForPasswordResetToken = sinon
                .stub()
                .withArgs(this.token)
                .resolves(this.user)
              this.UserAuditLogHandler.promises.addEntry.rejects(
                new Error('oops')
              )
            })
            it('should return the error', function (done) {
              this.PasswordResetHandler.setNewUserPassword(
                this.token,
                this.password,
                this.auditLog,
                (error, _result) => {
                  expect(error).to.exist
                  expect(
                    this.UserAuditLogHandler.promises.addEntry.callCount
                  ).to.equal(1)
                  expect(this.AuthenticationManager.promises.setUserPassword).to
                    .have.been.called
                  done()
                }
              )
            })
          })
        })
      })
    })

    describe('when the token has a v1_user_id and email', function () {
      beforeEach(function () {
        this.user.overleaf = { id: 184 }
        this.OneTimeTokenHandler.getValueFromTokenAndExpire
          .withArgs('password', this.token)
          .yields(null, {
            v1_user_id: this.user.overleaf.id,
            email: this.email
          })
        this.AuthenticationManager.promises.setUserPassword
          .withArgs(this.user, this.password)
          .resolves(true)
      })

      describe('when no user is reset with this email', function () {
        beforeEach(function () {
          this.UserGetter.getUserByMainEmail
            .withArgs(this.email)
            .yields(null, null)
        })

        it('should return reset == false', function (done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            this.auditLog,
            (err, result) => {
              const { reset, userId } = result
              expect(err).to.not.exist
              expect(reset).to.be.false
              done()
            }
          )
        })
      })

      describe("when the email and user don't match", function () {
        beforeEach(function () {
          this.UserGetter.getUserByMainEmail.withArgs(this.email).yields(null, {
            _id: this.user._id,
            email: this.email,
            overleaf: { id: 'not-the-same' }
          })
        })

        it('should return reset == false', function (done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            this.auditLog,
            (err, result) => {
              const { reset, userId } = result
              expect(err).to.not.exist
              expect(reset).to.be.false
              done()
            }
          )
        })
      })

      describe('when the email and user match', function () {
        beforeEach(function () {
          this.UserGetter.getUserByMainEmail
            .withArgs(this.email)
            .yields(null, this.user)
        })

        it('should return reset == true and the user id', function (done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            this.auditLog,
            (err, result) => {
              const { reset, userId } = result
              expect(err).to.not.exist
              expect(reset).to.be.true
              expect(userId).to.equal(this.user._id)
              done()
            }
          )
        })
      })
    })
  })
})
