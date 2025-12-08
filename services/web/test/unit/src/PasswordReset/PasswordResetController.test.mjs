import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.mjs'

const MODULE_PATH =
  '../../../../app/src/Features/PasswordReset/PasswordResetController.mjs'

describe('PasswordResetController', function () {
  beforeEach(async function (ctx) {
    ctx.email = 'bob@bob.com'
    ctx.user_id = '507f1f77bcf86cd799439011'
    ctx.token = 'my security token that was emailed to me'
    ctx.password = 'my new password'
    ctx.req = {
      body: {
        email: ctx.email,
        passwordResetToken: ctx.token,
        password: ctx.password,
      },
      i18n: {
        translate() {
          return '.'
        },
      },
      session: {},
      query: {},
    }
    ctx.res = new MockResponse(vi)

    ctx.settings = {}
    ctx.PasswordResetHandler = {
      generateAndEmailResetToken: sinon.stub(),
      promises: {
        generateAndEmailResetToken: sinon.stub(),
        setNewUserPassword: sinon.stub().resolves({
          found: true,
          reset: true,
          userID: ctx.user_id,
          mustReconfirm: true,
        }),
        getUserForPasswordResetToken: sinon
          .stub()
          .withArgs(ctx.token)
          .resolves({
            user: { _id: ctx.user_id },
            remainingPeeks: 1,
          }),
      },
    }
    ctx.UserSessionsManager = {
      promises: {
        removeSessionsFromRedis: sinon.stub().resolves(),
      },
    }
    ctx.UserUpdater = {
      promises: {
        removeReconfirmFlag: sinon.stub().resolves(),
      },
    }
    ctx.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock(
      '../../../../app/src/Features/PasswordReset/PasswordResetHandler',
      () => ({
        default: ctx.PasswordResetHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationManager',
      () => ({
        default: {
          validatePassword: sinon.stub().returns(null),
        },
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationController',
      () => ({
        default: (ctx.AuthenticationController = {
          getLoggedInUserId: sinon.stub(),
          finishLogin: sinon.stub(),
          setAuditInfo: sinon.stub(),
        }),
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: (ctx.UserGetter = {
        promises: {
          getUser: sinon.stub(),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserSessionsManager', () => ({
      default: ctx.UserSessionsManager,
    }))

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: ctx.UserUpdater,
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    ctx.PasswordResetController = (await import(MODULE_PATH)).default
  })

  describe('requestReset', function () {
    it('should tell the handler to process that email', async function (ctx) {
      ctx.PasswordResetHandler.promises.generateAndEmailResetToken.resolves(
        'primary'
      )
      await ctx.PasswordResetController.requestReset(ctx.req, ctx.res)
      expect(ctx.res.statusCode).to.equal(200)
      expect(ctx.res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.anything() })
      )
      expect(
        ctx.PasswordResetHandler.promises.generateAndEmailResetToken.lastCall
          .args[0]
      ).equal(ctx.email)
    })

    it('should send a 500 if there is an error', async function (ctx) {
      await new Promise(resolve => {
        ctx.PasswordResetHandler.promises.generateAndEmailResetToken.rejects(
          new Error('error')
        )
        ctx.PasswordResetController.requestReset(ctx.req, ctx.res, error => {
          expect(error).to.exist
          resolve()
        })
      })
    })

    it("should send a 404 if the email doesn't exist", async function (ctx) {
      ctx.PasswordResetHandler.promises.generateAndEmailResetToken.resolves(
        null
      )

      await ctx.PasswordResetController.requestReset(ctx.req, ctx.res)
      expect(ctx.res.statusCode).to.equal(404)
      expect(ctx.res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.anything() })
      )
    })

    it('should send a 404 if the email is registered as a secondard email', async function (ctx) {
      ctx.PasswordResetHandler.promises.generateAndEmailResetToken.resolves(
        'secondary'
      )

      await ctx.PasswordResetController.requestReset(ctx.req, ctx.res)
      expect(ctx.res.statusCode).to.equal(404)
      expect(ctx.res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.anything() })
      )
    })

    it('should normalize the email address', async function (ctx) {
      ctx.email = '  UPperCaseEMAILWithSpacesAround@example.Com '
      ctx.req.body.email = ctx.email
      ctx.PasswordResetHandler.promises.generateAndEmailResetToken.resolves(
        'primary'
      )

      await ctx.PasswordResetController.requestReset(ctx.req, ctx.res)
      expect(ctx.res.statusCode).to.equal(200)
      expect(ctx.res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.anything() })
      )
    })
  })

  describe('setNewUserPassword', function () {
    beforeEach(function (ctx) {
      ctx.req.session.resetToken = ctx.token
    })

    it('should tell the user handler to reset the password', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.sendStatus = code => {
          code.should.equal(200)
          ctx.PasswordResetHandler.promises.setNewUserPassword
            .calledWith(ctx.token, ctx.password)
            .should.equal(true)
          resolve()
        }
        ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
      })
    })

    it('should preserve spaces in the password', async function (ctx) {
      await new Promise(resolve => {
        ctx.password = ctx.req.body.password = ' oh! clever! spaces around!   '
        ctx.res.sendStatus = code => {
          code.should.equal(200)
          ctx.PasswordResetHandler.promises.setNewUserPassword.should.have.been.calledWith(
            ctx.token,
            ctx.password
          )
          resolve()
        }
        ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
      })
    })

    it('should send 404 if the token was not found', async function (ctx) {
      await new Promise(resolve => {
        ctx.PasswordResetHandler.promises.setNewUserPassword.resolves({
          found: false,
          reset: false,
          userId: ctx.user_id,
        })
        ctx.res.status = code => {
          code.should.equal(404)
          return ctx.res
        }
        ctx.res.json = data => {
          data.message.key.should.equal('token-expired')
          resolve()
        }
        ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
      })
    })

    it('should return 500 if not reset', async function (ctx) {
      await new Promise(resolve => {
        ctx.PasswordResetHandler.promises.setNewUserPassword.resolves({
          found: true,
          reset: false,
          userId: ctx.user_id,
        })
        ctx.res.status = code => {
          code.should.equal(500)
          return ctx.res
        }
        ctx.res.json = data => {
          expect(data.message).to.exist
          resolve()
        }
        ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
      })
    })

    it('should return 400 (Bad Request) if there is no password', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body.password = ''
        ctx.res.status = code => {
          code.should.equal(400)
          return ctx.res
        }
        ctx.res.json = data => {
          data.message.key.should.equal('invalid-password')
          ctx.PasswordResetHandler.promises.setNewUserPassword.called.should.equal(
            false
          )
          resolve()
        }
        ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
      })
    })

    it('should return 400 (Bad Request) if there is no passwordResetToken', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body.passwordResetToken = ''
        ctx.res.status = code => {
          code.should.equal(400)
          return ctx.res
        }
        ctx.res.json = data => {
          data.message.key.should.equal('invalid-password')
          ctx.PasswordResetHandler.promises.setNewUserPassword.called.should.equal(
            false
          )
          resolve()
        }
        ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
      })
    })

    it('should return 400 (Bad Request) if the password is invalid', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body.password = 'correct horse battery staple'
        const err = new Error('bad')
        err.name = 'InvalidPasswordError'
        ctx.PasswordResetHandler.promises.setNewUserPassword.rejects(err)
        ctx.res.status = code => {
          code.should.equal(400)
          return ctx.res
        }
        ctx.res.json = data => {
          data.message.key.should.equal('invalid-password')
          ctx.PasswordResetHandler.promises.setNewUserPassword.called.should.equal(
            true
          )
          resolve()
        }
        ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
      })
    })

    it('should clear sessions', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.sendStatus = code => {
          ctx.UserSessionsManager.promises.removeSessionsFromRedis.callCount.should.equal(
            1
          )
          resolve()
        }
        ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
      })
    })

    it('should call removeReconfirmFlag if user.must_reconfirm', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.sendStatus = code => {
          ctx.UserUpdater.promises.removeReconfirmFlag.callCount.should.equal(1)
          resolve()
        }
        ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
      })
    })

    describe('catch errors', function () {
      it('should return 404 for NotFoundError', async function (ctx) {
        await new Promise(resolve => {
          const anError = new Error('oops')
          anError.name = 'NotFoundError'
          ctx.PasswordResetHandler.promises.setNewUserPassword.rejects(anError)
          ctx.res.status = code => {
            code.should.equal(404)
            return ctx.res
          }
          ctx.res.json = data => {
            data.message.key.should.equal('token-expired')
            resolve()
          }
          ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
        })
      })
      it('should return 400 for InvalidPasswordError', async function (ctx) {
        await new Promise(resolve => {
          const anError = new Error('oops')
          anError.name = 'InvalidPasswordError'
          ctx.PasswordResetHandler.promises.setNewUserPassword.rejects(anError)
          ctx.res.status = code => {
            code.should.equal(400)
            return ctx.res
          }
          ctx.res.json = data => {
            data.message.key.should.equal('invalid-password')
            resolve()
          }
          ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
        })
      })
      it('should return 500 for other errors', async function (ctx) {
        await new Promise(resolve => {
          const anError = new Error('oops')
          ctx.PasswordResetHandler.promises.setNewUserPassword.rejects(anError)
          ctx.res.status = code => {
            code.should.equal(500)
            return ctx.res
          }
          ctx.res.json = data => {
            expect(data.message).to.exist
            resolve()
          }
          ctx.res.sendStatus = code => {
            code.should.equal(500)
            resolve()
          }
          ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
        })
      })
    })

    describe('when doLoginAfterPasswordReset is set', function () {
      beforeEach(function (ctx) {
        ctx.user = {
          _id: ctx.userId,
          email: 'joe@example.com',
        }
        ctx.UserGetter.promises.getUser.resolves(ctx.user)
        ctx.req.session.doLoginAfterPasswordReset = 'true'
      })

      it('should login user', async function (ctx) {
        await new Promise(resolve => {
          ctx.AuthenticationController.finishLogin.callsFake((...args) => {
            expect(args[0]).to.equal(ctx.user)
            resolve()
          })
          ctx.PasswordResetController.setNewUserPassword(ctx.req, ctx.res)
        })
      })
    })
  })

  describe('renderSetPasswordForm', function () {
    describe('with token in query-string', function () {
      beforeEach(function (ctx) {
        ctx.req.query.passwordResetToken = ctx.token
        ctx.req.query.email = 'test@example.com'
      })

      it('should set session.resetToken and redirect', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.session.should.not.have.property('resetToken')
          ctx.res.redirect = path => {
            path.should.equal('/user/password/set?email=test%40example.com')
            ctx.req.session.resetToken.should.equal(ctx.token)
            resolve()
          }
          ctx.PasswordResetController.renderSetPasswordForm(ctx.req, ctx.res)
        })
      })
    })

    describe('with expired token in query', function () {
      beforeEach(function (ctx) {
        ctx.req.query.email = 'test@example.com'
        ctx.req.query.passwordResetToken = ctx.token
        ctx.PasswordResetHandler.promises.getUserForPasswordResetToken = sinon
          .stub()
          .withArgs(ctx.token)
          .resolves({ user: { _id: ctx.user_id }, remainingPeeks: 0 })
      })

      it('should redirect to the reset request page with an error message', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.res.redirect = path => {
            path.should.equal('/user/password/reset?error=token_expired')
            ctx.req.session.should.not.have.property('resetToken')
            resolve()
          }
          ctx.res.render = (templatePath, options) => {
            reject(new Error('should not render'))
          }
          ctx.PasswordResetController.renderSetPasswordForm(ctx.req, ctx.res)
        })
      })
    })

    describe('with token and email in query-string', function () {
      beforeEach(function (ctx) {
        ctx.req.query.passwordResetToken = ctx.token
        ctx.req.query.email = 'foo@bar.com'
      })

      it('should set session.resetToken and redirect with email', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.session.should.not.have.property('resetToken')
          ctx.res.redirect = path => {
            path.should.equal('/user/password/set?email=foo%40bar.com')
            ctx.req.session.resetToken.should.equal(ctx.token)
            resolve()
          }
          ctx.PasswordResetController.renderSetPasswordForm(ctx.req, ctx.res)
        })
      })
    })

    describe('with token and invalid email in query-string', function () {
      beforeEach(function (ctx) {
        ctx.req.query.passwordResetToken = ctx.token
        ctx.req.query.email = 'not-an-email'
      })

      it('should set session.resetToken and redirect without email', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.session.should.not.have.property('resetToken')
          ctx.res.redirect = path => {
            path.should.equal('/user/password/set')
            ctx.req.session.resetToken.should.equal(ctx.token)
            resolve()
          }
          ctx.PasswordResetController.renderSetPasswordForm(ctx.req, ctx.res)
        })
      })
    })

    describe('with token and non-string email in query-string', function () {
      beforeEach(function (ctx) {
        ctx.req.query.passwordResetToken = ctx.token
        ctx.req.query.email = { foo: 'bar' }
      })

      it('should call next with an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.session.should.not.have.property('resetToken')
          const next = error => {
            expect(error).to.exist
            resolve()
          }
          ctx.PasswordResetController.renderSetPasswordForm(
            ctx.req,
            ctx.res,
            next
          )
        })
      })
    })

    describe('without a token in query-string', function () {
      describe('with token in session', function () {
        beforeEach(function (ctx) {
          ctx.req.session.resetToken = ctx.token
          ctx.req.query.email = 'test@example.com'
        })

        it('should render the page, passing the reset token', async function (ctx) {
          await new Promise(resolve => {
            ctx.res.render = (templatePath, options) => {
              options.passwordResetToken.should.equal(ctx.token)
              resolve()
            }
            ctx.PasswordResetController.renderSetPasswordForm(ctx.req, ctx.res)
          })
        })

        it('should clear the req.session.resetToken', async function (ctx) {
          await new Promise(resolve => {
            ctx.res.render = (templatePath, options) => {
              ctx.req.session.should.not.have.property('resetToken')
              resolve()
            }
            ctx.PasswordResetController.renderSetPasswordForm(ctx.req, ctx.res)
          })
        })
      })

      describe('without a token in session', function () {
        it('should redirect to the reset request page', async function (ctx) {
          await new Promise(resolve => {
            ctx.res.redirect = path => {
              path.should.equal('/user/password/reset')
              ctx.req.session.should.not.have.property('resetToken')
              resolve()
            }
            ctx.req.query.email = 'test@example.com'
            ctx.PasswordResetController.renderSetPasswordForm(ctx.req, ctx.res)
          })
        })
      })
    })
  })
})
