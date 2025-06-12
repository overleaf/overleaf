import { expect, vi } from 'vitest'
import sinon from 'sinon'
const modulePath = new URL(
  '../../../../app/src/Features/PasswordReset/PasswordResetHandler',
  import.meta.url
).pathname

describe('PasswordResetHandler', function () {
  beforeEach(async function (ctx) {
    ctx.settings = { siteUrl: 'https://www.overleaf.com' }
    ctx.OneTimeTokenHandler = {
      promises: {
        getNewToken: sinon.stub(),
        peekValueFromToken: sinon.stub(),
      },
      peekValueFromToken: sinon.stub(),
      expireToken: sinon.stub(),
    }
    ctx.UserGetter = {
      getUserByMainEmail: sinon.stub(),
      getUser: sinon.stub(),
      promises: {
        getUserByAnyEmail: sinon.stub(),
        getUserByMainEmail: sinon.stub(),
      },
    }
    ctx.EmailHandler = { promises: { sendEmail: sinon.stub() } }
    ctx.AuthenticationManager = {
      setUserPasswordInV2: sinon.stub(),
      promises: {
        setUserPassword: sinon.stub().resolves(),
      },
    }

    vi.doMock('../../../../app/src/Features/User/UserAuditLogHandler', () => ({
      default: (ctx.UserAuditLogHandler = {
        promises: {
          addEntry: sinon.stub().resolves(),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Security/OneTimeTokenHandler',
      () => ({
        default: ctx.OneTimeTokenHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: ctx.EmailHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationManager',
      () => ({
        default: ctx.AuthenticationManager,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authorization/PermissionsManager',
      () => ({
        default: (ctx.PermissionsManager = {
          promises: {
            assertUserPermissions: sinon.stub(),
          },
        }),
      })
    )

    ctx.PasswordResetHandler = (await import(modulePath)).default
    ctx.token = '12312321i'
    ctx.user_id = 'user_id_here'
    ctx.user = { email: (ctx.email = 'bob@bob.com'), _id: ctx.user_id }
    ctx.password = 'my great secret password'
    ctx.callback = sinon.stub()
    // this should not have any effect now
    ctx.settings.overleaf = true
  })

  afterEach(function (ctx) {
    ctx.settings.overleaf = false
  })

  describe('generateAndEmailResetToken', function () {
    it('should check the user exists', function (ctx) {
      ctx.UserGetter.promises.getUserByAnyEmail.resolves()
      ctx.PasswordResetHandler.generateAndEmailResetToken(
        ctx.user.email,
        ctx.callback
      )
      ctx.UserGetter.promises.getUserByAnyEmail.should.have.been.calledWith(
        ctx.user.email
      )
    })

    it('should send the email with the token', async function (ctx) {
      await new Promise(resolve => {
        ctx.UserGetter.promises.getUserByAnyEmail.resolves(ctx.user)
        ctx.OneTimeTokenHandler.promises.getNewToken.resolves(ctx.token)
        ctx.EmailHandler.promises.sendEmail.resolves()
        ctx.PasswordResetHandler.generateAndEmailResetToken(
          ctx.user.email,
          (err, status) => {
            expect(err).to.not.exist
            ctx.EmailHandler.promises.sendEmail.called.should.equal(true)
            status.should.equal('primary')
            const args = ctx.EmailHandler.promises.sendEmail.args[0]
            args[0].should.equal('passwordResetRequested')
            args[1].setNewPasswordUrl.should.equal(
              `${ctx.settings.siteUrl}/user/password/set?passwordResetToken=${
                ctx.token
              }&email=${encodeURIComponent(ctx.user.email)}`
            )
            resolve()
          }
        )
      })
    })

    it('should return errors from getUserByAnyEmail', async function (ctx) {
      await new Promise(resolve => {
        const err = new Error('oops')
        ctx.UserGetter.promises.getUserByAnyEmail.rejects(err)
        ctx.PasswordResetHandler.generateAndEmailResetToken(
          ctx.user.email,
          err => {
            expect(err).to.equal(err)
            resolve()
          }
        )
      })
    })

    describe('when the email exists', function () {
      let result
      beforeEach(async function (ctx) {
        ctx.UserGetter.promises.getUserByAnyEmail.resolves(ctx.user)
        ctx.OneTimeTokenHandler.promises.getNewToken.resolves(ctx.token)
        ctx.EmailHandler.promises.sendEmail.resolves()
        result =
          await ctx.PasswordResetHandler.promises.generateAndEmailResetToken(
            ctx.email
          )
      })

      it('should set the password token data to the user id and email', function (ctx) {
        ctx.OneTimeTokenHandler.promises.getNewToken.should.have.been.calledWith(
          'password',
          {
            email: ctx.email,
            user_id: ctx.user._id,
          }
        )
      })

      it('should send an email with the token', function (ctx) {
        ctx.EmailHandler.promises.sendEmail.called.should.equal(true)
        const args = ctx.EmailHandler.promises.sendEmail.args[0]
        args[0].should.equal('passwordResetRequested')
        args[1].setNewPasswordUrl.should.equal(
          `${ctx.settings.siteUrl}/user/password/set?passwordResetToken=${
            ctx.token
          }&email=${encodeURIComponent(ctx.user.email)}`
        )
      })

      it('should return status == true', async function () {
        expect(result).to.equal('primary')
      })
    })

    describe("when the email doesn't exist", function () {
      let result
      beforeEach(async function (ctx) {
        ctx.UserGetter.promises.getUserByAnyEmail.resolves(null)
        result =
          await ctx.PasswordResetHandler.promises.generateAndEmailResetToken(
            ctx.email
          )
      })

      it('should not set the password token data', function (ctx) {
        ctx.OneTimeTokenHandler.promises.getNewToken.called.should.equal(false)
      })

      it('should send an email with the token', function (ctx) {
        ctx.EmailHandler.promises.sendEmail.called.should.equal(false)
      })

      it('should return status == null', function () {
        expect(result).to.equal(null)
      })
    })

    describe('when the email is a secondary email', function () {
      let result
      beforeEach(async function (ctx) {
        ctx.UserGetter.promises.getUserByAnyEmail.resolves(ctx.user)
        result =
          await ctx.PasswordResetHandler.promises.generateAndEmailResetToken(
            'secondary@email.com'
          )
      })

      it('should not set the password token data', function (ctx) {
        ctx.OneTimeTokenHandler.promises.getNewToken.called.should.equal(false)
      })

      it('should not send an email with the token', function (ctx) {
        ctx.EmailHandler.promises.sendEmail.called.should.equal(false)
      })

      it('should return status == secondary', function () {
        expect(result).to.equal('secondary')
      })
    })
  })

  describe('setNewUserPassword', function () {
    beforeEach(function (ctx) {
      ctx.auditLog = { ip: '0:0:0:0' }
    })
    describe('when no data is found', function () {
      beforeEach(function (ctx) {
        ctx.OneTimeTokenHandler.promises.peekValueFromToken.resolves(null)
      })

      it('should return found == false and reset == false', function (ctx) {
        ctx.PasswordResetHandler.setNewUserPassword(
          ctx.token,
          ctx.password,
          ctx.auditLog,
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
      beforeEach(function (ctx) {
        ctx.OneTimeTokenHandler.promises.peekValueFromToken.resolves({
          data: {
            user_id: ctx.user._id,
            email: ctx.email,
          },
        })
        ctx.AuthenticationManager.promises.setUserPassword
          .withArgs(ctx.user, ctx.password)
          .resolves(true)
        ctx.OneTimeTokenHandler.expireToken = sinon.stub().callsArgWith(2, null)
      })

      describe('when no user is found with this email', function () {
        beforeEach(function (ctx) {
          ctx.UserGetter.getUserByMainEmail
            .withArgs(ctx.email)
            .yields(null, null)
        })

        it('should return found == false and reset == false', async function (ctx) {
          await new Promise(resolve => {
            ctx.PasswordResetHandler.setNewUserPassword(
              ctx.token,
              ctx.password,
              ctx.auditLog,
              (err, result) => {
                const { found, reset } = result
                expect(err).to.not.exist
                expect(found).to.be.false
                expect(reset).to.be.false
                expect(ctx.OneTimeTokenHandler.expireToken.callCount).to.equal(
                  0
                )
                resolve()
              }
            )
          })
        })
      })

      describe("when the email and user don't match", function () {
        beforeEach(function (ctx) {
          ctx.UserGetter.getUserByMainEmail
            .withArgs(ctx.email)
            .yields(null, { _id: 'not-the-same', email: ctx.email })
          ctx.OneTimeTokenHandler.expireToken.callsArgWith(2, null)
        })

        it('should return found == false and reset == false', async function (ctx) {
          await new Promise(resolve => {
            ctx.PasswordResetHandler.setNewUserPassword(
              ctx.token,
              ctx.password,
              ctx.auditLog,
              (err, result) => {
                const { found, reset } = result
                expect(err).to.not.exist
                expect(found).to.be.false
                expect(reset).to.be.false
                expect(ctx.OneTimeTokenHandler.expireToken.callCount).to.equal(
                  0
                )
                resolve()
              }
            )
          })
        })
      })

      describe('when the email and user match', function () {
        describe('success', function () {
          beforeEach(function (ctx) {
            ctx.UserGetter.promises.getUserByMainEmail.resolves(ctx.user)
            ctx.OneTimeTokenHandler.expireToken = sinon
              .stub()
              .callsArgWith(2, null)
          })

          it('should update the user audit log', async function (ctx) {
            await new Promise(resolve => {
              ctx.PasswordResetHandler.setNewUserPassword(
                ctx.token,
                ctx.password,
                ctx.auditLog,
                (error, result) => {
                  sinon.assert.calledWith(
                    ctx.UserAuditLogHandler.promises.addEntry,
                    ctx.user_id,
                    'reset-password',
                    undefined,
                    ctx.auditLog.ip,
                    { token: ctx.token.substring(0, 10) }
                  )
                  expect(error).to.not.exist
                  resolve()
                }
              )
            })
          })

          it('should return reset == true and the user id', async function (ctx) {
            await new Promise(resolve => {
              ctx.PasswordResetHandler.setNewUserPassword(
                ctx.token,
                ctx.password,
                ctx.auditLog,
                (err, result) => {
                  const { reset, userId } = result
                  expect(err).to.not.exist
                  expect(reset).to.be.true
                  expect(userId).to.equal(ctx.user._id)
                  resolve()
                }
              )
            })
          })

          it('should expire the token', async function (ctx) {
            await new Promise(resolve => {
              ctx.PasswordResetHandler.setNewUserPassword(
                ctx.token,
                ctx.password,
                ctx.auditLog,
                (_err, _result) => {
                  expect(ctx.OneTimeTokenHandler.expireToken.called).to.equal(
                    true
                  )
                  resolve()
                }
              )
            })
          })

          describe('when logged in', function () {
            beforeEach(function (ctx) {
              ctx.auditLog.initiatorId = ctx.user_id
            })
            it('should update the user audit log with initiatorId', async function (ctx) {
              await new Promise(resolve => {
                ctx.PasswordResetHandler.setNewUserPassword(
                  ctx.token,
                  ctx.password,
                  ctx.auditLog,
                  (error, result) => {
                    expect(error).to.not.exist
                    sinon.assert.calledWith(
                      ctx.UserAuditLogHandler.promises.addEntry,
                      ctx.user_id,
                      'reset-password',
                      ctx.user_id,
                      ctx.auditLog.ip,
                      { token: ctx.token.substring(0, 10) }
                    )
                    resolve()
                  }
                )
              })
            })
          })
        })

        describe('errors', function () {
          describe('via setUserPassword', function () {
            beforeEach(function (ctx) {
              ctx.PasswordResetHandler.promises.getUserForPasswordResetToken =
                sinon.stub().withArgs(ctx.token).resolves({ user: ctx.user })
              ctx.AuthenticationManager.promises.setUserPassword
                .withArgs(ctx.user, ctx.password)
                .rejects()
            })
            it('should return the error', async function (ctx) {
              await new Promise(resolve => {
                ctx.PasswordResetHandler.setNewUserPassword(
                  ctx.token,
                  ctx.password,
                  ctx.auditLog,
                  (error, _result) => {
                    expect(error).to.exist
                    expect(
                      ctx.UserAuditLogHandler.promises.addEntry.callCount
                    ).to.equal(1)
                    resolve()
                  }
                )
              })
            })
          })

          describe('via UserAuditLogHandler', function () {
            beforeEach(function (ctx) {
              ctx.PasswordResetHandler.promises.getUserForPasswordResetToken =
                sinon.stub().withArgs(ctx.token).resolves({ user: ctx.user })
              ctx.UserAuditLogHandler.promises.addEntry.rejects(
                new Error('oops')
              )
            })
            it('should return the error', async function (ctx) {
              await new Promise(resolve => {
                ctx.PasswordResetHandler.setNewUserPassword(
                  ctx.token,
                  ctx.password,
                  ctx.auditLog,
                  (error, _result) => {
                    expect(error).to.exist
                    expect(
                      ctx.UserAuditLogHandler.promises.addEntry.callCount
                    ).to.equal(1)
                    expect(ctx.AuthenticationManager.promises.setUserPassword)
                      .to.not.have.been.called
                    resolve()
                  }
                )
              })
            })
          })
        })
      })
    })

    describe('when the token has a v1_user_id and email', function () {
      beforeEach(function (ctx) {
        ctx.user.overleaf = { id: 184 }
        ctx.OneTimeTokenHandler.promises.peekValueFromToken.resolves({
          data: {
            v1_user_id: ctx.user.overleaf.id,
            email: ctx.email,
          },
        })
        ctx.AuthenticationManager.promises.setUserPassword
          .withArgs(ctx.user, ctx.password)
          .resolves(true)
        ctx.OneTimeTokenHandler.expireToken = sinon.stub().callsArgWith(2, null)
      })

      describe('when no user is reset with this email', function () {
        beforeEach(function (ctx) {
          ctx.UserGetter.getUserByMainEmail
            .withArgs(ctx.email)
            .yields(null, null)
        })

        it('should return reset == false', async function (ctx) {
          await new Promise(resolve => {
            ctx.PasswordResetHandler.setNewUserPassword(
              ctx.token,
              ctx.password,
              ctx.auditLog,
              (err, result) => {
                const { reset } = result
                expect(err).to.not.exist
                expect(reset).to.be.false
                expect(ctx.OneTimeTokenHandler.expireToken.called).to.equal(
                  false
                )
                resolve()
              }
            )
          })
        })
      })

      describe("when the email and user don't match", function () {
        beforeEach(function (ctx) {
          ctx.UserGetter.getUserByMainEmail.withArgs(ctx.email).yields(null, {
            _id: ctx.user._id,
            email: ctx.email,
            overleaf: { id: 'not-the-same' },
          })
        })

        it('should return reset == false', async function (ctx) {
          await new Promise(resolve => {
            ctx.PasswordResetHandler.setNewUserPassword(
              ctx.token,
              ctx.password,
              ctx.auditLog,
              (err, result) => {
                const { reset } = result
                expect(err).to.not.exist
                expect(reset).to.be.false
                expect(ctx.OneTimeTokenHandler.expireToken.called).to.equal(
                  false
                )
                resolve()
              }
            )
          })
        })
      })

      describe('when the email and user match', function () {
        beforeEach(function (ctx) {
          ctx.UserGetter.promises.getUserByMainEmail.resolves(ctx.user)
        })

        it('should return reset == true and the user id', async function (ctx) {
          await new Promise(resolve => {
            ctx.PasswordResetHandler.setNewUserPassword(
              ctx.token,
              ctx.password,
              ctx.auditLog,
              (err, result) => {
                const { reset, userId } = result
                expect(err).to.not.exist
                expect(reset).to.be.true
                expect(userId).to.equal(ctx.user._id)
                expect(ctx.OneTimeTokenHandler.expireToken.called).to.equal(
                  true
                )
                resolve()
              }
            )
          })
        })
      })
    })
  })

  describe('getUserForPasswordResetToken', function () {
    beforeEach(function (ctx) {
      ctx.OneTimeTokenHandler.promises.peekValueFromToken.resolves({
        data: {
          user_id: ctx.user._id,
          email: ctx.email,
        },
        remainingPeeks: 1,
      })

      ctx.UserGetter.promises.getUserByMainEmail.resolves({
        _id: ctx.user._id,
        email: ctx.email,
      })
    })

    it('should returns errors from user permissions', async function (ctx) {
      let error
      const err = new Error('nope')
      ctx.PermissionsManager.promises.assertUserPermissions.rejects(err)
      try {
        await ctx.PasswordResetHandler.promises.getUserForPasswordResetToken(
          'abc123'
        )
      } catch (e) {
        error = e
      }
      expect(error).to.deep.equal(error)
    })

    it('returns user when user has permissions and remaining peaks', async function (ctx) {
      const result =
        await ctx.PasswordResetHandler.promises.getUserForPasswordResetToken(
          'abc123'
        )
      expect(result).to.deep.equal({
        user: { _id: ctx.user._id, email: ctx.email },
        remainingPeeks: 1,
      })
    })
  })
})
