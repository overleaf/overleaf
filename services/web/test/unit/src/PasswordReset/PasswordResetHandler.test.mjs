import esmock from 'esmock'
import sinon from 'sinon'
import { expect } from 'chai'
const modulePath = new URL(
  '../../../../app/src/Features/PasswordReset/PasswordResetHandler',
  import.meta.url
).pathname

describe('PasswordResetHandler', function () {
  beforeEach(async function () {
    this.settings = { siteUrl: 'https://www.overleaf.com' }
    this.OneTimeTokenHandler = {
      promises: {
        getNewToken: sinon.stub(),
        peekValueFromToken: sinon.stub(),
      },
      peekValueFromToken: sinon.stub(),
      expireToken: sinon.stub(),
    }
    this.UserGetter = {
      getUserByMainEmail: sinon.stub(),
      getUser: sinon.stub(),
      promises: {
        getUserByAnyEmail: sinon.stub(),
        getUserByMainEmail: sinon.stub(),
      },
    }
    this.EmailHandler = { promises: { sendEmail: sinon.stub() } }
    this.AuthenticationManager = {
      setUserPasswordInV2: sinon.stub(),
      promises: {
        setUserPassword: sinon.stub().resolves(),
      },
    }
    this.PasswordResetHandler = await esmock.strict(modulePath, {
      '../../../../app/src/Features/User/UserAuditLogHandler':
        (this.UserAuditLogHandler = {
          promises: {
            addEntry: sinon.stub().resolves(),
          },
        }),
      '../../../../app/src/Features/User/UserGetter': this.UserGetter,
      '../../../../app/src/Features/Security/OneTimeTokenHandler':
        this.OneTimeTokenHandler,
      '../../../../app/src/Features/Email/EmailHandler': this.EmailHandler,
      '../../../../app/src/Features/Authentication/AuthenticationManager':
        this.AuthenticationManager,
      '@overleaf/settings': this.settings,
      '../../../../app/src/Features/Authorization/PermissionsManager':
        (this.PermissionsManager = {
          promises: {
            assertUserPermissions: sinon.stub(),
          },
        }),
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
      this.UserGetter.promises.getUserByAnyEmail.resolves()
      this.PasswordResetHandler.generateAndEmailResetToken(
        this.user.email,
        this.callback
      )
      this.UserGetter.promises.getUserByAnyEmail.should.have.been.calledWith(
        this.user.email
      )
    })

    it('should send the email with the token', function (done) {
      this.UserGetter.promises.getUserByAnyEmail.resolves(this.user)
      this.OneTimeTokenHandler.promises.getNewToken.resolves(this.token)
      this.EmailHandler.promises.sendEmail.resolves()
      this.PasswordResetHandler.generateAndEmailResetToken(
        this.user.email,
        (err, status) => {
          expect(err).to.not.exist
          this.EmailHandler.promises.sendEmail.called.should.equal(true)
          status.should.equal('primary')
          const args = this.EmailHandler.promises.sendEmail.args[0]
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

    it('should return errors from getUserByAnyEmail', function (done) {
      const err = new Error('oops')
      this.UserGetter.promises.getUserByAnyEmail.rejects(err)
      this.PasswordResetHandler.generateAndEmailResetToken(
        this.user.email,
        err => {
          expect(err).to.equal(err)
          done()
        }
      )
    })

    describe('when the email exists', function () {
      let result
      beforeEach(async function () {
        this.UserGetter.promises.getUserByAnyEmail.resolves(this.user)
        this.OneTimeTokenHandler.promises.getNewToken.resolves(this.token)
        this.EmailHandler.promises.sendEmail.resolves()
        result =
          await this.PasswordResetHandler.promises.generateAndEmailResetToken(
            this.email
          )
      })

      it('should set the password token data to the user id and email', function () {
        this.OneTimeTokenHandler.promises.getNewToken.should.have.been.calledWith(
          'password',
          {
            email: this.email,
            user_id: this.user._id,
          }
        )
      })

      it('should send an email with the token', function () {
        this.EmailHandler.promises.sendEmail.called.should.equal(true)
        const args = this.EmailHandler.promises.sendEmail.args[0]
        args[0].should.equal('passwordResetRequested')
        args[1].setNewPasswordUrl.should.equal(
          `${this.settings.siteUrl}/user/password/set?passwordResetToken=${
            this.token
          }&email=${encodeURIComponent(this.user.email)}`
        )
      })

      it('should return status == true', async function () {
        expect(result).to.equal('primary')
      })
    })

    describe("when the email doesn't exist", function () {
      let result
      beforeEach(async function () {
        this.UserGetter.promises.getUserByAnyEmail.resolves(null)
        result =
          await this.PasswordResetHandler.promises.generateAndEmailResetToken(
            this.email
          )
      })

      it('should not set the password token data', function () {
        this.OneTimeTokenHandler.promises.getNewToken.called.should.equal(false)
      })

      it('should send an email with the token', function () {
        this.EmailHandler.promises.sendEmail.called.should.equal(false)
      })

      it('should return status == null', function () {
        expect(result).to.equal(null)
      })
    })

    describe('when the email is a secondary email', function () {
      let result
      beforeEach(async function () {
        this.UserGetter.promises.getUserByAnyEmail.resolves(this.user)
        result =
          await this.PasswordResetHandler.promises.generateAndEmailResetToken(
            'secondary@email.com'
          )
      })

      it('should not set the password token data', function () {
        this.OneTimeTokenHandler.promises.getNewToken.called.should.equal(false)
      })

      it('should not send an email with the token', function () {
        this.EmailHandler.promises.sendEmail.called.should.equal(false)
      })

      it('should return status == secondary', function () {
        expect(result).to.equal('secondary')
      })
    })
  })

  describe('setNewUserPassword', function () {
    beforeEach(function () {
      this.auditLog = { ip: '0:0:0:0' }
    })
    describe('when no data is found', function () {
      beforeEach(function () {
        this.OneTimeTokenHandler.promises.peekValueFromToken.resolves(null)
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
              userId: null,
            })
          }
        )
      })
    })

    describe('when the token has a user_id and email', function () {
      beforeEach(function () {
        this.OneTimeTokenHandler.promises.peekValueFromToken.resolves({
          data: {
            user_id: this.user._id,
            email: this.email,
          },
        })
        this.AuthenticationManager.promises.setUserPassword
          .withArgs(this.user, this.password)
          .resolves(true)
        this.OneTimeTokenHandler.expireToken = sinon
          .stub()
          .callsArgWith(2, null)
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
              const { found, reset } = result
              expect(err).to.not.exist
              expect(found).to.be.false
              expect(reset).to.be.false
              expect(this.OneTimeTokenHandler.expireToken.callCount).to.equal(0)
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
          this.OneTimeTokenHandler.expireToken.callsArgWith(2, null)
        })

        it('should return found == false and reset == false', function (done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            this.auditLog,
            (err, result) => {
              const { found, reset } = result
              expect(err).to.not.exist
              expect(found).to.be.false
              expect(reset).to.be.false
              expect(this.OneTimeTokenHandler.expireToken.callCount).to.equal(0)
              done()
            }
          )
        })
      })

      describe('when the email and user match', function () {
        describe('success', function () {
          beforeEach(function () {
            this.UserGetter.promises.getUserByMainEmail.resolves(this.user)
            this.OneTimeTokenHandler.expireToken = sinon
              .stub()
              .callsArgWith(2, null)
          })

          it('should update the user audit log', function (done) {
            this.PasswordResetHandler.setNewUserPassword(
              this.token,
              this.password,
              this.auditLog,
              (error, result) => {
                sinon.assert.calledWith(
                  this.UserAuditLogHandler.promises.addEntry,
                  this.user_id,
                  'reset-password',
                  undefined,
                  this.auditLog.ip,
                  { token: this.token.substring(0, 10) }
                )
                expect(error).to.not.exist
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

          it('should expire the token', function (done) {
            this.PasswordResetHandler.setNewUserPassword(
              this.token,
              this.password,
              this.auditLog,
              (_err, _result) => {
                expect(this.OneTimeTokenHandler.expireToken.called).to.equal(
                  true
                )
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
                  expect(error).to.not.exist
                  sinon.assert.calledWith(
                    this.UserAuditLogHandler.promises.addEntry,
                    this.user_id,
                    'reset-password',
                    this.user_id,
                    this.auditLog.ip,
                    { token: this.token.substring(0, 10) }
                  )
                  done()
                }
              )
            })
          })
        })

        describe('errors', function () {
          describe('via setUserPassword', function () {
            beforeEach(function () {
              this.PasswordResetHandler.promises.getUserForPasswordResetToken =
                sinon.stub().withArgs(this.token).resolves({ user: this.user })
              this.AuthenticationManager.promises.setUserPassword
                .withArgs(this.user, this.password)
                .rejects()
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
                  done()
                }
              )
            })
          })

          describe('via UserAuditLogHandler', function () {
            beforeEach(function () {
              this.PasswordResetHandler.promises.getUserForPasswordResetToken =
                sinon.stub().withArgs(this.token).resolves({ user: this.user })
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
                    .not.have.been.called
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
        this.OneTimeTokenHandler.promises.peekValueFromToken.resolves({
          data: {
            v1_user_id: this.user.overleaf.id,
            email: this.email,
          },
        })
        this.AuthenticationManager.promises.setUserPassword
          .withArgs(this.user, this.password)
          .resolves(true)
        this.OneTimeTokenHandler.expireToken = sinon
          .stub()
          .callsArgWith(2, null)
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
              const { reset } = result
              expect(err).to.not.exist
              expect(reset).to.be.false
              expect(this.OneTimeTokenHandler.expireToken.called).to.equal(
                false
              )
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
            overleaf: { id: 'not-the-same' },
          })
        })

        it('should return reset == false', function (done) {
          this.PasswordResetHandler.setNewUserPassword(
            this.token,
            this.password,
            this.auditLog,
            (err, result) => {
              const { reset } = result
              expect(err).to.not.exist
              expect(reset).to.be.false
              expect(this.OneTimeTokenHandler.expireToken.called).to.equal(
                false
              )
              done()
            }
          )
        })
      })

      describe('when the email and user match', function () {
        beforeEach(function () {
          this.UserGetter.promises.getUserByMainEmail.resolves(this.user)
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
              expect(this.OneTimeTokenHandler.expireToken.called).to.equal(true)
              done()
            }
          )
        })
      })
    })
  })

  describe('getUserForPasswordResetToken', function () {
    beforeEach(function () {
      this.OneTimeTokenHandler.promises.peekValueFromToken.resolves({
        data: {
          user_id: this.user._id,
          email: this.email,
        },
        remainingPeeks: 1,
      })

      this.UserGetter.promises.getUserByMainEmail.resolves({
        _id: this.user._id,
        email: this.email,
      })
    })

    it('should returns errors from user permissions', async function () {
      let error
      const err = new Error('nope')
      this.PermissionsManager.promises.assertUserPermissions.rejects(err)
      try {
        await this.PasswordResetHandler.promises.getUserForPasswordResetToken(
          'abc123'
        )
      } catch (e) {
        error = e
      }
      expect(error).to.deep.equal(error)
    })

    it('returns user when user has permissions and remaining peaks', async function () {
      const result =
        await this.PasswordResetHandler.promises.getUserForPasswordResetToken(
          'abc123'
        )
      expect(result).to.deep.equal({
        user: { _id: this.user._id, email: this.email },
        remainingPeeks: 1,
      })
    })
  })
})
