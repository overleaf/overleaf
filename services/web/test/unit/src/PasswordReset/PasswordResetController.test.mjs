import esmock from 'esmock'
import sinon from 'sinon'
import { expect } from 'chai'
import MockResponse from '../helpers/MockResponse.js'

const MODULE_PATH = new URL(
  '../../../../app/src/Features/PasswordReset/PasswordResetController.mjs',
  import.meta.url
).pathname

describe('PasswordResetController', function () {
  beforeEach(async function () {
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
        translate() {
          return '.'
        },
      },
      session: {},
      query: {},
    }
    this.res = new MockResponse()

    this.settings = {}
    this.PasswordResetHandler = {
      generateAndEmailResetToken: sinon.stub(),
      promises: {
        generateAndEmailResetToken: sinon.stub(),
        setNewUserPassword: sinon.stub().resolves({
          found: true,
          reset: true,
          userID: this.user_id,
          mustReconfirm: true,
        }),
        getUserForPasswordResetToken: sinon
          .stub()
          .withArgs(this.token)
          .resolves({
            user: { _id: this.user_id },
            remainingPeeks: 1,
          }),
      },
    }
    this.UserSessionsManager = {
      promises: {
        removeSessionsFromRedis: sinon.stub().resolves(),
      },
    }
    this.UserUpdater = {
      promises: {
        removeReconfirmFlag: sinon.stub().resolves(),
      },
    }
    this.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves('default'),
      },
    }
    this.PasswordResetController = await esmock.strict(MODULE_PATH, {
      '@overleaf/settings': this.settings,
      '../../../../app/src/Features/PasswordReset/PasswordResetHandler':
        this.PasswordResetHandler,
      '../../../../app/src/Features/Authentication/AuthenticationManager': {
        validatePassword: sinon.stub().returns(null),
      },
      '../../../../app/src/Features/Authentication/AuthenticationController':
        (this.AuthenticationController = {
          getLoggedInUserId: sinon.stub(),
          finishLogin: sinon.stub(),
          setAuditInfo: sinon.stub(),
        }),
      '../../../../app/src/Features/User/UserGetter': (this.UserGetter = {
        promises: {
          getUser: sinon.stub(),
        },
      }),
      '../../../../app/src/Features/User/UserSessionsManager':
        this.UserSessionsManager,
      '../../../../app/src/Features/User/UserUpdater': this.UserUpdater,
      '../../../../app/src/Features/SplitTests/SplitTestHandler':
        this.SplitTestHandler,
    })
  })

  describe('requestReset', function () {
    it('should tell the handler to process that email', function (done) {
      this.PasswordResetHandler.promises.generateAndEmailResetToken.resolves(
        'primary'
      )
      this.res.callback = () => {
        this.res.statusCode.should.equal(200)
        this.res.json.calledWith(sinon.match.has('message')).should.equal(true)
        expect(
          this.PasswordResetHandler.promises.generateAndEmailResetToken.lastCall
            .args[0]
        ).equal(this.email)
        done()
      }
      this.PasswordResetController.requestReset(this.req, this.res)
    })

    it('should send a 500 if there is an error', function (done) {
      this.PasswordResetHandler.promises.generateAndEmailResetToken.rejects(
        new Error('error')
      )
      this.PasswordResetController.requestReset(this.req, this.res, error => {
        expect(error).to.exist
        done()
      })
    })

    it("should send a 404 if the email doesn't exist", function (done) {
      this.PasswordResetHandler.promises.generateAndEmailResetToken.resolves(
        null
      )
      this.res.callback = () => {
        this.res.statusCode.should.equal(404)
        this.res.json.calledWith(sinon.match.has('message')).should.equal(true)
        done()
      }
      this.PasswordResetController.requestReset(this.req, this.res)
    })

    it('should send a 404 if the email is registered as a secondard email', function (done) {
      this.PasswordResetHandler.promises.generateAndEmailResetToken.resolves(
        'secondary'
      )
      this.res.callback = () => {
        this.res.statusCode.should.equal(404)
        this.res.json.calledWith(sinon.match.has('message')).should.equal(true)
        done()
      }
      this.PasswordResetController.requestReset(this.req, this.res)
    })

    it('should normalize the email address', function (done) {
      this.email = '  UPperCaseEMAILWithSpacesAround@example.Com '
      this.req.body.email = this.email
      this.PasswordResetHandler.promises.generateAndEmailResetToken.resolves(
        'primary'
      )
      this.res.callback = () => {
        this.res.statusCode.should.equal(200)
        this.res.json.calledWith(sinon.match.has('message')).should.equal(true)
        done()
      }
      this.PasswordResetController.requestReset(this.req, this.res)
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
      this.res.status = code => {
        code.should.equal(404)
        return this.res
      }
      this.res.json = data => {
        data.message.key.should.equal('token-expired')
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
      this.res.status = code => {
        code.should.equal(500)
        return this.res
      }
      this.res.json = data => {
        expect(data.message).to.exist
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should return 400 (Bad Request) if there is no password', function (done) {
      this.req.body.password = ''
      this.res.status = code => {
        code.should.equal(400)
        return this.res
      }
      this.res.json = data => {
        data.message.key.should.equal('invalid-password')
        this.PasswordResetHandler.promises.setNewUserPassword.called.should.equal(
          false
        )
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should return 400 (Bad Request) if there is no passwordResetToken', function (done) {
      this.req.body.passwordResetToken = ''
      this.res.status = code => {
        code.should.equal(400)
        return this.res
      }
      this.res.json = data => {
        data.message.key.should.equal('invalid-password')
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
      this.res.status = code => {
        code.should.equal(400)
        return this.res
      }
      this.res.json = data => {
        data.message.key.should.equal('invalid-password')
        this.PasswordResetHandler.promises.setNewUserPassword.called.should.equal(
          true
        )
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should clear sessions', function (done) {
      this.res.sendStatus = code => {
        this.UserSessionsManager.promises.removeSessionsFromRedis.callCount.should.equal(
          1
        )
        done()
      }
      this.PasswordResetController.setNewUserPassword(this.req, this.res)
    })

    it('should call removeReconfirmFlag if user.must_reconfirm', function (done) {
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
        this.res.status = code => {
          code.should.equal(404)
          return this.res
        }
        this.res.json = data => {
          data.message.key.should.equal('token-expired')
          done()
        }
        this.PasswordResetController.setNewUserPassword(this.req, this.res)
      })
      it('should return 400 for InvalidPasswordError', function (done) {
        const anError = new Error('oops')
        anError.name = 'InvalidPasswordError'
        this.PasswordResetHandler.promises.setNewUserPassword.rejects(anError)
        this.res.status = code => {
          code.should.equal(400)
          return this.res
        }
        this.res.json = data => {
          data.message.key.should.equal('invalid-password')
          done()
        }
        this.PasswordResetController.setNewUserPassword(this.req, this.res)
      })
      it('should return 500 for other errors', function (done) {
        const anError = new Error('oops')
        this.PasswordResetHandler.promises.setNewUserPassword.rejects(anError)
        this.res.status = code => {
          code.should.equal(500)
          return this.res
        }
        this.res.json = data => {
          expect(data.message).to.exist
          done()
        }
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

    describe('with expired token in query', function () {
      beforeEach(function () {
        this.req.query.passwordResetToken = this.token
        this.PasswordResetHandler.promises.getUserForPasswordResetToken = sinon
          .stub()
          .withArgs(this.token)
          .resolves({ user: { _id: this.user_id }, remainingPeeks: 0 })
      })

      it('should redirect to the reset request page with an error message', function (done) {
        this.res.redirect = path => {
          path.should.equal('/user/password/reset?error=token_expired')
          this.req.session.should.not.have.property('resetToken')
          done()
        }
        this.res.render = (templatePath, options) => {
          done('should not render')
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
            options.passwordResetToken.should.equal(this.token)
            done()
          }
          this.PasswordResetController.renderSetPasswordForm(this.req, this.res)
        })

        it('should clear the req.session.resetToken', function (done) {
          this.res.render = (templatePath, options) => {
            this.req.session.should.not.have.property('resetToken')
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
