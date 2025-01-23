const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/User/UserController.js'
const SandboxedModule = require('sandboxed-module')
const OError = require('@overleaf/o-error')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('UserController', function () {
  beforeEach(function () {
    this.user_id = '323123'

    this.user = {
      _id: this.user_id,
      email: 'email@overleaf.com',
      save: sinon.stub().resolves(),
      ace: {},
    }

    this.req = {
      user: {},
      session: {
        destroy() {},
        user: {
          _id: this.user_id,
          email: 'old@something.com',
        },
        analyticsId: this.user_id,
      },
      sessionID: '123',
      body: {},
      i18n: {
        translate: text => text,
      },
      ip: '0:0:0:0',
      query: {},
      headers: {},
      logger: {
        addFields: sinon.stub(),
      },
    }

    this.UserDeleter = { promises: { deleteUser: sinon.stub().resolves() } }

    this.UserGetter = {
      promises: { getUser: sinon.stub().resolves(this.user) },
    }

    this.User = {
      findById: sinon
        .stub()
        .returns({ exec: sinon.stub().resolves(this.user) }),
    }

    this.NewsLetterManager = {
      promises: {
        subscribe: sinon.stub().resolves(),
        unsubscribe: sinon.stub().resolves(),
      },
    }

    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(this.user._id),
      getSessionUser: sinon.stub().returns(this.req.session.user),
      setInSessionUser: sinon.stub(),
    }

    this.AuthenticationManager = {
      promises: {
        authenticate: sinon.stub(),
        setUserPassword: sinon.stub(),
      },
      getMessageForInvalidPasswordError: sinon
        .stub()
        .returns({ type: 'error', key: 'some-key' }),
    }

    this.UserUpdater = {
      promises: {
        changeEmailAddress: sinon.stub().resolves(),
        confirmEmail: sinon.stub().resolves(),
        addAffiliationForNewUser: sinon.stub().resolves(),
      },
    }

    this.settings = { siteUrl: 'overleaf.example.com' }

    this.UserHandler = {
      promises: { populateTeamInvites: sinon.stub().resolves() },
    }

    this.UserSessionsManager = {
      promises: {
        getAllUserSessions: sinon.stub().resolves(),
        removeSessionsFromRedis: sinon.stub().resolves(),
        untrackSession: sinon.stub().resolves(),
      },
    }

    this.HttpErrorHandler = {
      badRequest: sinon.stub(),
      conflict: sinon.stub(),
      unprocessableEntity: sinon.stub(),
      legacyInternal: sinon.stub(),
    }

    this.UrlHelper = {
      getSafeRedirectPath: sinon.stub(),
    }
    this.UrlHelper.getSafeRedirectPath
      .withArgs('https://evil.com')
      .returns(undefined)
    this.UrlHelper.getSafeRedirectPath.returnsArg(0)

    this.Features = {
      hasFeature: sinon.stub(),
    }

    this.UserAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }

    this.RequestContentTypeDetection = {
      acceptsJson: sinon.stub().returns(false),
    }

    this.EmailHandler = {
      promises: { sendEmail: sinon.stub().resolves() },
    }

    this.OneTimeTokenHandler = {
      promises: { expireAllTokensForUser: sinon.stub().resolves() },
    }

    this.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves(),
        },
      },
    }

    this.UserController = SandboxedModule.require(modulePath, {
      requires: {
        '../Helpers/UrlHelper': this.UrlHelper,
        './UserGetter': this.UserGetter,
        './UserDeleter': this.UserDeleter,
        './UserUpdater': this.UserUpdater,
        '../../models/User': { User: this.User },
        '../Newsletter/NewsletterManager': this.NewsLetterManager,
        '../Authentication/AuthenticationController':
          this.AuthenticationController,
        '../Authentication/SessionManager': this.SessionManager,
        '../Authentication/AuthenticationManager': this.AuthenticationManager,
        '../../infrastructure/Features': this.Features,
        './UserAuditLogHandler': this.UserAuditLogHandler,
        './UserHandler': this.UserHandler,
        './UserSessionsManager': this.UserSessionsManager,
        '../Errors/HttpErrorHandler': this.HttpErrorHandler,
        '@overleaf/settings': this.settings,
        '@overleaf/o-error': OError,
        '../Email/EmailHandler': this.EmailHandler,
        '../Security/OneTimeTokenHandler': this.OneTimeTokenHandler,
        '../../infrastructure/RequestContentTypeDetection':
          this.RequestContentTypeDetection,
        '../../infrastructure/Modules': this.Modules,
      },
    })

    this.res = {
      send: sinon.stub(),
      status: sinon.stub(),
      sendStatus: sinon.stub(),
      json: sinon.stub(),
    }
    this.res.status.returns(this.res)
    this.next = sinon.stub()
    this.callback = sinon.stub()
  })

  describe('tryDeleteUser', function () {
    beforeEach(function () {
      this.req.body.password = 'wat'
      this.req.logout = sinon.stub().yields()
      this.req.session.destroy = sinon.stub().yields()
      this.SessionManager.getLoggedInUserId = sinon
        .stub()
        .returns(this.user._id)
      this.AuthenticationManager.promises.authenticate.resolves({
        user: this.user,
      })
    })

    it('should send 200', function (done) {
      this.res.sendStatus = code => {
        code.should.equal(200)
        done()
      }
      this.UserController.tryDeleteUser(this.req, this.res, this.next)
    })

    it('should try to authenticate user', function (done) {
      this.res.sendStatus = code => {
        this.AuthenticationManager.promises.authenticate.should.have.been
          .calledOnce
        this.AuthenticationManager.promises.authenticate.should.have.been.calledWith(
          { _id: this.user._id },
          this.req.body.password
        )
        done()
      }
      this.UserController.tryDeleteUser(this.req, this.res, this.next)
    })

    it('should delete the user', function (done) {
      this.res.sendStatus = code => {
        this.UserDeleter.promises.deleteUser.should.have.been.calledOnce
        this.UserDeleter.promises.deleteUser.should.have.been.calledWith(
          this.user._id
        )
        done()
      }
      this.UserController.tryDeleteUser(this.req, this.res, this.next)
    })

    it('should call hook to try to delete v1 account', function (done) {
      this.res.sendStatus = code => {
        expect(this.Modules.promises.hooks.fire).to.have.been.calledWith(
          'tryDeleteV1Account',
          this.user
        )
        done()
      }
      this.UserController.tryDeleteUser(this.req, this.res, this.next)
    })

    describe('when no password is supplied', function () {
      beforeEach(function () {
        this.req.body.password = ''
      })

      it('should return 403', function (done) {
        this.res.sendStatus = code => {
          code.should.equal(403)
          done()
        }
        this.UserController.tryDeleteUser(this.req, this.res, this.next)
      })
    })

    describe('when authenticate produces an error', function () {
      beforeEach(function () {
        this.AuthenticationManager.promises.authenticate.rejects(
          new Error('woops')
        )
      })

      it('should call next with an error', function (done) {
        this.next = err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          done()
        }
        this.UserController.tryDeleteUser(this.req, this.res, this.next)
      })
    })

    describe('when authenticate does not produce a user', function () {
      beforeEach(function () {
        this.AuthenticationManager.promises.authenticate.resolves({
          user: null,
        })
      })

      it('should return 403', function (done) {
        this.res.sendStatus = code => {
          code.should.equal(403)
          done()
        }
        this.UserController.tryDeleteUser(this.req, this.res, this.next)
      })
    })

    describe('when deleteUser produces an error', function () {
      beforeEach(function () {
        this.UserDeleter.promises.deleteUser.rejects(new Error('woops'))
      })

      it('should call next with an error', function (done) {
        this.next = err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          done()
        }
        this.UserController.tryDeleteUser(this.req, this.res, this.next)
      })
    })

    describe('when deleteUser produces a known error', function () {
      beforeEach(function () {
        this.UserDeleter.promises.deleteUser.rejects(
          new Errors.SubscriptionAdminDeletionError()
        )
      })

      it('should return a HTTP Unprocessable Entity error', function (done) {
        this.HttpErrorHandler.unprocessableEntity = sinon.spy(
          (req, res, message, info) => {
            expect(req).to.exist
            expect(res).to.exist
            expect(message).to.equal('error while deleting user account')
            expect(info).to.deep.equal({
              error: 'SubscriptionAdminDeletionError',
            })
            done()
          }
        )
        this.UserController.tryDeleteUser(this.req, this.res)
      })
    })

    describe('when session.destroy produces an error', function () {
      beforeEach(function () {
        this.req.session.destroy = sinon
          .stub()
          .callsArgWith(0, new Error('woops'))
      })

      it('should call next with an error', function (done) {
        this.next = err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          done()
        }
        this.UserController.tryDeleteUser(this.req, this.res, this.next)
      })
    })
  })

  describe('subscribe', function () {
    it('should send the user to subscribe', function (done) {
      this.res.json = data => {
        expect(data.message).to.equal('thanks_settings_updated')
        this.NewsLetterManager.promises.subscribe.should.have.been.calledWith(
          this.user
        )
        done()
      }
      this.UserController.subscribe(this.req, this.res)
    })
  })

  describe('unsubscribe', function () {
    it('should send the user to unsubscribe', function (done) {
      this.res.json = data => {
        expect(data.message).to.equal('thanks_settings_updated')
        this.NewsLetterManager.promises.unsubscribe.should.have.been.calledWith(
          this.user
        )
        done()
      }
      this.UserController.unsubscribe(this.req, this.res, this.next)
    })
  })

  describe('updateUserSettings', function () {
    beforeEach(function () {
      this.auditLog = { initiatorId: this.user_id, ipAddress: this.req.ip }
      this.newEmail = 'hello@world.com'
      this.req.externalAuthenticationSystemUsed = sinon.stub().returns(false)
    })

    it('should call save', function (done) {
      this.req.body = {}
      this.res.sendStatus = code => {
        this.user.save.called.should.equal(true)
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res, this.next)
    })

    it('should set the first name', function (done) {
      this.req.body = { first_name: 'bobby  ' }
      this.res.sendStatus = code => {
        this.user.first_name.should.equal('bobby')
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should set the role', function (done) {
      this.req.body = { role: 'student' }
      this.res.sendStatus = code => {
        this.user.role.should.equal('student')
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should set the institution', function (done) {
      this.req.body = { institution: 'MIT' }
      this.res.sendStatus = code => {
        this.user.institution.should.equal('MIT')
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should set some props on ace', function (done) {
      this.req.body = { editorTheme: 'something' }
      this.res.sendStatus = code => {
        this.user.ace.theme.should.equal('something')
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should set the overall theme', function (done) {
      this.req.body = { overallTheme: 'green-ish' }
      this.res.sendStatus = code => {
        this.user.ace.overallTheme.should.equal('green-ish')
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should set referencesSearchMode to advanced', function (done) {
      this.req.body = { referencesSearchMode: 'advanced' }
      this.res.sendStatus = code => {
        this.user.ace.referencesSearchMode.should.equal('advanced')
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should set referencesSearchMode to simple', function (done) {
      this.req.body = { referencesSearchMode: 'simple' }
      this.res.sendStatus = code => {
        this.user.ace.referencesSearchMode.should.equal('simple')
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should not allow arbitrary referencesSearchMode', function (done) {
      this.req.body = { referencesSearchMode: 'foobar' }
      this.res.sendStatus = code => {
        this.user.ace.referencesSearchMode.should.equal('advanced')
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should send an error if the email is 0 len', function (done) {
      this.req.body.email = ''
      this.res.sendStatus = function (code) {
        code.should.equal(400)
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should send an error if the email does not contain an @', function (done) {
      this.req.body.email = 'bob at something dot com'
      this.res.sendStatus = function (code) {
        code.should.equal(400)
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should call the user updater with the new email and user _id', function (done) {
      this.req.body.email = this.newEmail.toUpperCase()
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.UserUpdater.promises.changeEmailAddress.should.have.been.calledWith(
          this.user_id,
          this.newEmail,
          this.auditLog
        )
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should update the email on the session', function (done) {
      this.req.body.email = this.newEmail.toUpperCase()
      let callcount = 0
      this.User.findById = id => ({
        exec: async () => {
          if (++callcount === 2) {
            this.user.email = this.newEmail
          }
          return this.user
        },
      })
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.SessionManager.setInSessionUser
          .calledWith(this.req.session, {
            email: this.newEmail,
            first_name: undefined,
            last_name: undefined,
          })
          .should.equal(true)
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should call populateTeamInvites', function (done) {
      this.req.body.email = this.newEmail.toUpperCase()
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.UserHandler.promises.populateTeamInvites.should.have.been.calledWith(
          this.user
        )
        done()
      }
      this.UserController.updateUserSettings(this.req, this.res)
    })

    describe('when changeEmailAddress yields an error', function () {
      it('should pass on an error and not send a success status', function (done) {
        this.req.body.email = this.newEmail.toUpperCase()
        this.UserUpdater.promises.changeEmailAddress.rejects(new OError())
        this.HttpErrorHandler.legacyInternal = sinon.spy(
          (req, res, message, error) => {
            expect(req).to.exist
            expect(req).to.exist
            message.should.equal('problem_changing_email_address')
            expect(error).to.be.instanceof(OError)
            done()
          }
        )
        this.UserController.updateUserSettings(this.req, this.res, this.next)
      })

      it('should call the HTTP conflict error handler when the email already exists', function (done) {
        this.HttpErrorHandler.conflict = sinon.spy((req, res, message) => {
          expect(req).to.exist
          expect(req).to.exist
          message.should.equal('email_already_registered')
          done()
        })
        this.req.body.email = this.newEmail.toUpperCase()
        this.UserUpdater.promises.changeEmailAddress.rejects(
          new Errors.EmailExistsError()
        )
        this.UserController.updateUserSettings(this.req, this.res)
      })
    })

    describe('when using an external auth source', function () {
      beforeEach(function () {
        this.newEmail = 'someone23@example.com'
        this.req.externalAuthenticationSystemUsed = sinon.stub().returns(true)
      })

      it('should not set a new email', function (done) {
        this.req.body.email = this.newEmail
        this.res.sendStatus = code => {
          code.should.equal(200)
          this.UserUpdater.promises.changeEmailAddress
            .calledWith(this.user_id, this.newEmail)
            .should.equal(false)
          done()
        }
        this.UserController.updateUserSettings(this.req, this.res)
      })
    })
  })

  describe('logout', function () {
    beforeEach(function () {
      this.RequestContentTypeDetection.acceptsJson.returns(false)
    })

    it('should destroy the session', function (done) {
      this.req.session.destroy = sinon.stub().callsArgWith(0)
      this.res.redirect = url => {
        url.should.equal('/login')
        this.req.session.destroy.called.should.equal(true)
        done()
      }

      this.UserController.logout(this.req, this.res)
    })

    it('should untrack session', function (done) {
      this.req.session.destroy = sinon.stub().callsArgWith(0)
      this.res.redirect = url => {
        url.should.equal('/login')
        this.UserSessionsManager.promises.untrackSession.should.have.been
          .calledOnce
        this.UserSessionsManager.promises.untrackSession.should.have.been.calledWith(
          sinon.match(this.req.user),
          this.req.sessionID
        )
        done()
      }

      this.UserController.logout(this.req, this.res)
    })

    it('should redirect after logout', function (done) {
      this.req.body.redirect = '/sso-login'
      this.req.session.destroy = sinon.stub().callsArgWith(0)
      this.res.redirect = url => {
        url.should.equal(this.req.body.redirect)
        done()
      }
      this.UserController.logout(this.req, this.res)
    })

    it('should redirect after logout, but not to evil.com', function (done) {
      this.req.body.redirect = 'https://evil.com'
      this.req.session.destroy = sinon.stub().callsArgWith(0)
      this.res.redirect = url => {
        url.should.equal('/login')
        done()
      }
      this.UserController.logout(this.req, this.res)
    })

    it('should redirect to login after logout when no redirect set', function (done) {
      this.req.session.destroy = sinon.stub().callsArgWith(0)
      this.res.redirect = url => {
        url.should.equal('/login')
        done()
      }
      this.UserController.logout(this.req, this.res)
    })

    it('should send json with redir property for json request', function (done) {
      this.RequestContentTypeDetection.acceptsJson.returns(true)
      this.req.session.destroy = sinon.stub().callsArgWith(0)
      this.res.status = code => {
        code.should.equal(200)
        return this.res
      }
      this.res.json = data => {
        data.redir.should.equal('/login')
        done()
      }
      this.UserController.logout(this.req, this.res)
    })
  })

  describe('clearSessions', function () {
    describe('success', function () {
      it('should call removeSessionsFromRedis', function (done) {
        this.res.sendStatus.callsFake(() => {
          this.UserSessionsManager.promises.removeSessionsFromRedis.should.have
            .been.calledOnce
          done()
        })
        this.UserController.clearSessions(this.req, this.res)
      })

      it('send a 201 response', function (done) {
        this.res.sendStatus.callsFake(status => {
          status.should.equal(201)
          done()
        })

        this.UserController.clearSessions(this.req, this.res)
      })

      it('sends a security alert email', function (done) {
        this.res.sendStatus.callsFake(status => {
          this.EmailHandler.promises.sendEmail.callCount.should.equal(1)
          const expectedArg = {
            to: this.user.email,
            actionDescribed: `active sessions were cleared on your account ${this.user.email}`,
            action: 'active sessions cleared',
          }
          const emailCall = this.EmailHandler.promises.sendEmail.lastCall
          expect(emailCall.args[0]).to.equal('securityAlert')
          expect(emailCall.args[1]).to.deep.equal(expectedArg)
          done()
        })

        this.UserController.clearSessions(this.req, this.res)
      })
    })

    describe('errors', function () {
      describe('when getAllUserSessions produces an error', function () {
        it('should return an error', function (done) {
          this.UserSessionsManager.promises.getAllUserSessions.rejects(
            new Error('woops')
          )
          this.UserController.clearSessions(this.req, this.res, error => {
            expect(error).to.be.instanceof(Error)
            done()
          })
        })
      })

      describe('when audit log addEntry produces an error', function () {
        it('should call next with an error', function (done) {
          this.UserAuditLogHandler.promises.addEntry.rejects(new Error('woops'))
          this.UserController.clearSessions(this.req, this.res, error => {
            expect(error).to.be.instanceof(Error)
            done()
          })
        })
      })

      describe('when removeSessionsFromRedis produces an error', function () {
        it('should call next with an error', function (done) {
          this.UserSessionsManager.promises.removeSessionsFromRedis.rejects(
            new Error('woops')
          )
          this.UserController.clearSessions(this.req, this.res, error => {
            expect(error).to.be.instanceof(Error)
            done()
          })
        })
      })

      describe('when EmailHandler produces an error', function () {
        const anError = new Error('oops')
        it('send a 201 response but log error', function (done) {
          this.EmailHandler.promises.sendEmail.rejects(anError)
          this.res.sendStatus.callsFake(status => {
            status.should.equal(201)
            this.logger.error.callCount.should.equal(1)
            const loggerCall = this.logger.error.getCall(0)
            expect(loggerCall.args[0]).to.deep.equal({
              error: anError,
              userId: this.user_id,
            })
            expect(loggerCall.args[1]).to.contain(
              'could not send security alert email when sessions cleared'
            )
            done()
          })
          this.UserController.clearSessions(this.req, this.res)
        })
      })
    })
  })

  describe('changePassword', function () {
    describe('success', function () {
      beforeEach(function () {
        this.AuthenticationManager.promises.authenticate.resolves({
          user: this.user,
        })
        this.AuthenticationManager.promises.setUserPassword.resolves()
        this.req.body = {
          newPassword1: 'newpass',
          newPassword2: 'newpass',
        }
      })
      it('should set the new password if they do match', function (done) {
        this.res.json.callsFake(() => {
          this.AuthenticationManager.promises.setUserPassword.should.have.been.calledWith(
            this.user,
            'newpass'
          )
          done()
        })
        this.UserController.changePassword(this.req, this.res)
      })

      it('should log the update', function (done) {
        this.res.json.callsFake(() => {
          this.UserAuditLogHandler.promises.addEntry.should.have.been.calledWith(
            this.user._id,
            'update-password',
            this.user._id,
            this.req.ip
          )
          this.AuthenticationManager.promises.setUserPassword.callCount.should.equal(
            1
          )
          done()
        })
        this.UserController.changePassword(this.req, this.res)
      })

      it('should send security alert email', function (done) {
        this.res.json.callsFake(() => {
          const expectedArg = {
            to: this.user.email,
            actionDescribed: `your password has been changed on your account ${this.user.email}`,
            action: 'password changed',
          }
          const emailCall = this.EmailHandler.promises.sendEmail.lastCall
          expect(emailCall.args[0]).to.equal('securityAlert')
          expect(emailCall.args[1]).to.deep.equal(expectedArg)
          done()
        })
        this.UserController.changePassword(this.req, this.res)
      })

      it('should expire password reset tokens', function (done) {
        this.res.json.callsFake(() => {
          this.OneTimeTokenHandler.promises.expireAllTokensForUser.should.have.been.calledWith(
            this.user._id,
            'password'
          )
          done()
        })
        this.UserController.changePassword(this.req, this.res)
      })
    })

    describe('errors', function () {
      it('should check the old password is the current one at the moment', function (done) {
        this.AuthenticationManager.promises.authenticate.resolves({})
        this.req.body = { currentPassword: 'oldpasshere' }
        this.HttpErrorHandler.badRequest.callsFake(() => {
          expect(this.HttpErrorHandler.badRequest).to.have.been.calledWith(
            this.req,
            this.res,
            'password_change_old_password_wrong'
          )
          this.AuthenticationManager.promises.authenticate.should.have.been.calledWith(
            { _id: this.user._id },
            'oldpasshere'
          )
          this.AuthenticationManager.promises.setUserPassword.callCount.should.equal(
            0
          )
          done()
        })
        this.UserController.changePassword(this.req, this.res)
      })

      it('it should not set the new password if they do not match', function (done) {
        this.AuthenticationManager.promises.authenticate.resolves({
          user: this.user,
        })
        this.req.body = {
          newPassword1: '1',
          newPassword2: '2',
        }
        this.HttpErrorHandler.badRequest.callsFake(() => {
          expect(this.HttpErrorHandler.badRequest).to.have.been.calledWith(
            this.req,
            this.res,
            'password_change_passwords_do_not_match'
          )
          this.AuthenticationManager.promises.setUserPassword.callCount.should.equal(
            0
          )
          done()
        })
        this.UserController.changePassword(this.req, this.res)
      })

      it('it should not set the new password if it is invalid', function (done) {
        // this.AuthenticationManager.validatePassword = sinon
        //   .stub()
        //   .returns({ message: 'validation-error' })
        const err = new Error('bad')
        err.name = 'InvalidPasswordError'
        const message = {
          type: 'error',
          key: 'some-message-key',
        }
        this.AuthenticationManager.getMessageForInvalidPasswordError.returns(
          message
        )
        this.AuthenticationManager.promises.setUserPassword.rejects(err)
        this.AuthenticationManager.promises.authenticate.resolves({
          user: this.user,
        })
        this.req.body = {
          newPassword1: 'newpass',
          newPassword2: 'newpass',
        }
        this.res.json.callsFake(result => {
          expect(result.message).to.deep.equal(message)
          this.AuthenticationManager.promises.setUserPassword.callCount.should.equal(
            1
          )
          done()
        })
        this.UserController.changePassword(this.req, this.res)
      })

      describe('UserAuditLogHandler error', function () {
        it('should return error and not update password', function (done) {
          this.UserAuditLogHandler.promises.addEntry.rejects(new Error('oops'))
          this.AuthenticationManager.promises.authenticate.resolves({
            user: this.user,
          })
          this.AuthenticationManager.promises.setUserPassword.resolves()
          this.req.body = {
            newPassword1: 'newpass',
            newPassword2: 'newpass',
          }

          this.UserController.changePassword(this.req, this.res, error => {
            expect(error).to.be.instanceof(Error)
            this.AuthenticationManager.promises.setUserPassword.callCount.should.equal(
              1
            )
            done()
          })
        })
      })

      describe('EmailHandler error', function () {
        const anError = new Error('oops')
        beforeEach(function () {
          this.AuthenticationManager.promises.authenticate.resolves({
            user: this.user,
          })
          this.AuthenticationManager.promises.setUserPassword.resolves()
          this.req.body = {
            newPassword1: 'newpass',
            newPassword2: 'newpass',
          }
          this.EmailHandler.promises.sendEmail.rejects(anError)
        })

        it('should not return error but should log it', function (done) {
          this.res.json.callsFake(result => {
            expect(result.message.type).to.equal('success')
            this.logger.error.callCount.should.equal(1)
            expect(this.logger.error).to.have.been.calledWithExactly(
              {
                error: anError,
                userId: this.user_id,
              },
              'could not send security alert email when password changed'
            )
            done()
          })
          this.UserController.changePassword(this.req, this.res)
        })
      })
    })
  })

  describe('ensureAffiliationMiddleware', function () {
    describe('without affiliations feature', function () {
      beforeEach(async function () {
        await this.UserController.ensureAffiliationMiddleware(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not run affiliation check', function () {
        expect(this.UserGetter.promises.getUser).to.not.have.been.called
        expect(this.UserUpdater.promises.confirmEmail).to.not.have.been.called
        expect(this.UserUpdater.promises.addAffiliationForNewUser).to.not.have
          .been.called
      })

      it('should not return an error', function () {
        expect(this.next).to.be.calledWith()
      })
    })

    describe('without ensureAffiliation query parameter', function () {
      beforeEach(async function () {
        this.Features.hasFeature.withArgs('affiliations').returns(true)
        await this.UserController.ensureAffiliationMiddleware(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not run middleware', function () {
        expect(this.UserGetter.promises.getUser).to.not.have.been.called
        expect(this.UserUpdater.promises.confirmEmail).to.not.have.been.called
        expect(this.UserUpdater.promises.addAffiliationForNewUser).to.not.have
          .been.called
      })

      it('should not return an error', function () {
        expect(this.next).to.be.calledWith()
      })
    })

    describe('no flagged email', function () {
      beforeEach(async function () {
        const email = 'unit-test@overleaf.com'
        this.user.email = email
        this.user.emails = [
          {
            email,
          },
        ]
        this.Features.hasFeature.withArgs('affiliations').returns(true)
        this.req.query.ensureAffiliation = true
        await this.UserController.ensureAffiliationMiddleware(
          this.req,
          this.res,
          this.next
        )
      })

      it('should get the user', function () {
        expect(this.UserGetter.promises.getUser).to.have.been.calledWith(
          this.user._id
        )
      })

      it('should not try to add affiliation or update user', function () {
        expect(this.UserUpdater.promises.addAffiliationForNewUser).to.not.have
          .been.called
      })

      it('should not return an error', function () {
        expect(this.next).to.be.calledWith()
      })
    })

    describe('flagged non-SSO email', function () {
      let emailFlagged
      beforeEach(async function () {
        emailFlagged = 'flagged@overleaf.com'
        this.user.email = emailFlagged
        this.user.emails = [
          {
            email: emailFlagged,
            affiliationUnchecked: true,
          },
        ]
        this.Features.hasFeature.withArgs('affiliations').returns(true)
        this.req.query.ensureAffiliation = true
        this.req.assertPermission = sinon.stub()
        await this.UserController.ensureAffiliationMiddleware(
          this.req,
          this.res,
          this.next
        )
      })

      it('should check the user has permission', function () {
        expect(this.req.assertPermission).to.have.been.calledWith(
          'add-affiliation'
        )
      })

      it('should unflag the emails but not confirm', function () {
        expect(
          this.UserUpdater.promises.addAffiliationForNewUser
        ).to.have.been.calledWith(this.user._id, emailFlagged)
        expect(
          this.UserUpdater.promises.confirmEmail
        ).to.not.have.been.calledWith(this.user._id, emailFlagged)
      })

      it('should not return an error', function () {
        expect(this.next).to.be.calledWith()
      })
    })

    describe('flagged SSO email', function () {
      let emailFlagged
      beforeEach(async function () {
        emailFlagged = 'flagged@overleaf.com'
        this.user.email = emailFlagged
        this.user.emails = [
          {
            email: emailFlagged,
            affiliationUnchecked: true,
            samlProviderId: '123',
          },
        ]
        this.Features.hasFeature.withArgs('affiliations').returns(true)
        this.req.query.ensureAffiliation = true
        this.req.assertPermission = sinon.stub()
        await this.UserController.ensureAffiliationMiddleware(
          this.req,
          this.res,
          this.next
        )
      })

      it('should check the user has permission', function () {
        expect(this.req.assertPermission).to.have.been.calledWith(
          'add-affiliation'
        )
      })

      it('should add affiliation to v1, unflag and confirm on v2', function () {
        expect(this.UserUpdater.promises.addAffiliationForNewUser).to.have.not
          .been.called
        expect(this.UserUpdater.promises.confirmEmail).to.have.been.calledWith(
          this.user._id,
          emailFlagged
        )
      })

      it('should not return an error', function () {
        expect(this.next).to.be.calledWith()
      })
    })

    describe('when v1 returns an error', function () {
      let emailFlagged
      beforeEach(async function () {
        this.UserUpdater.promises.addAffiliationForNewUser.rejects()
        emailFlagged = 'flagged@overleaf.com'
        this.user.email = emailFlagged
        this.user.emails = [
          {
            email: emailFlagged,
            affiliationUnchecked: true,
          },
        ]
        this.Features.hasFeature.withArgs('affiliations').returns(true)
        this.req.query.ensureAffiliation = true
        this.req.assertPermission = sinon.stub()
        await this.UserController.ensureAffiliationMiddleware(
          this.req,
          this.res,
          this.next
        )
      })

      it('should check the user has permission', function () {
        expect(this.req.assertPermission).to.have.been.calledWith(
          'add-affiliation'
        )
      })

      it('should return the error', function () {
        expect(this.next).to.be.calledWith(sinon.match.instanceOf(Error))
      })
    })

    describe('when user is not found', function () {
      beforeEach(async function () {
        this.UserGetter.promises.getUser.rejects(new Error('not found'))
        this.Features.hasFeature.withArgs('affiliations').returns(true)
        this.req.query.ensureAffiliation = true
        await this.UserController.ensureAffiliationMiddleware(
          this.req,
          this.res,
          this.next
        )
      })

      it('should return the error', function () {
        expect(this.next).to.be.calledWith(sinon.match.instanceOf(Error))
      })
    })
  })
})
