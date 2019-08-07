/* eslint-disable
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
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/Features/User/UserController.js'
const SandboxedModule = require('sandboxed-module')
const events = require('events')
const MockResponse = require('../helpers/MockResponse')
const MockRequest = require('../helpers/MockRequest')
const { ObjectId } = require('mongojs')
const assert = require('assert')
const OError = require('@overleaf/o-error')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const HttpErrors = require('@overleaf/o-error/http')

describe('UserController', function() {
  beforeEach(function() {
    this.user_id = '323123'

    this.user = {
      _id: this.user_id,
      save: sinon.stub().callsArgWith(0),
      ace: {}
    }

    this.req = {
      user: {},
      session: {
        destroy() {},
        user: {
          _id: this.user_id,
          email: 'old@something.com'
        }
      },
      body: {},
      i18n: {
        translate: text => text
      }
    }

    this.UserDeleter = { deleteUser: sinon.stub().yields() }
    this.UserGetter = { getUser: sinon.stub().callsArgWith(1, null, this.user) }
    this.User = { findById: sinon.stub().callsArgWith(1, null, this.user) }
    this.NewsLetterManager = { unsubscribe: sinon.stub().callsArgWith(1) }
    this.UserRegistrationHandler = { registerNewUser: sinon.stub() }
    this.AuthenticationController = {
      establishUserSession: sinon.stub().callsArg(2),
      getLoggedInUserId: sinon.stub().returns(this.user._id),
      getSessionUser: sinon.stub().returns(this.req.session.user),
      setInSessionUser: sinon.stub()
    }
    this.AuthenticationManager = {
      authenticate: sinon.stub(),
      setUserPassword: sinon.stub(),
      validatePassword: sinon.stub()
    }
    this.ReferalAllocator = { allocate: sinon.stub() }
    this.SubscriptionDomainHandler = { autoAllocate: sinon.stub() }
    this.UserUpdater = { changeEmailAddress: sinon.stub() }
    this.settings = { siteUrl: 'sharelatex.example.com' }
    this.UserHandler = { populateTeamInvites: sinon.stub().callsArgWith(1) }
    this.UserSessionsManager = {
      trackSession: sinon.stub(),
      untrackSession: sinon.stub(),
      revokeAllUserSessions: sinon.stub().callsArgWith(2, null)
    }
    this.SudoModeHandler = { clearSudoMode: sinon.stub() }
    this.UserController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './UserGetter': this.UserGetter,
        './UserDeleter': this.UserDeleter,
        './UserUpdater': this.UserUpdater,
        '../../models/User': {
          User: this.User
        },
        '../Newsletter/NewsletterManager': this.NewsLetterManager,
        './UserRegistrationHandler': this.UserRegistrationHandler,
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        '../Authentication/AuthenticationManager': this.AuthenticationManager,
        '../Referal/ReferalAllocator': this.ReferalAllocator,
        '../Subscription/SubscriptionDomainHandler': this
          .SubscriptionDomainHandler,
        './UserHandler': this.UserHandler,
        './UserSessionsManager': this.UserSessionsManager,
        '../SudoMode/SudoModeHandler': this.SudoModeHandler,
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        },
        'metrics-sharelatex': {
          inc() {}
        },
        '../Errors/Errors': Errors,
        '@overleaf/o-error/http': HttpErrors,
        '../Email/EmailHandler': { sendEmail: sinon.stub() }
      }
    })

    this.res = {
      send: sinon.stub(),
      status: sinon.stub(),
      sendStatus: sinon.stub(),
      json: sinon.stub()
    }
    this.res.status.returns(this.res)
    this.next = sinon.stub()
    this.callback = sinon.stub()
  })

  describe('tryDeleteUser', function() {
    beforeEach(function() {
      this.req.body.password = 'wat'
      this.req.logout = sinon.stub()
      this.req.session.destroy = sinon.stub().callsArgWith(0, null)
      this.AuthenticationController.getLoggedInUserId = sinon
        .stub()
        .returns(this.user._id)
      this.AuthenticationManager.authenticate = sinon
        .stub()
        .callsArgWith(2, null, this.user)
    })

    it('should send 200', function(done) {
      this.res.sendStatus = code => {
        code.should.equal(200)
        return done()
      }
      return this.UserController.tryDeleteUser(this.req, this.res, this.next)
    })

    it('should try to authenticate user', function(done) {
      this.res.sendStatus = code => {
        this.AuthenticationManager.authenticate.callCount.should.equal(1)
        this.AuthenticationManager.authenticate
          .calledWith({ _id: this.user._id }, this.req.body.password)
          .should.equal(true)
        return done()
      }
      return this.UserController.tryDeleteUser(this.req, this.res, this.next)
    })

    it('should delete the user', function(done) {
      this.res.sendStatus = code => {
        this.UserDeleter.deleteUser.callCount.should.equal(1)
        this.UserDeleter.deleteUser.calledWith(this.user._id).should.equal(true)
        return done()
      }
      return this.UserController.tryDeleteUser(this.req, this.res, this.next)
    })

    describe('when no password is supplied', function() {
      beforeEach(function() {
        return (this.req.body.password = '')
      })

      it('should return 403', function(done) {
        this.res.sendStatus = code => {
          code.should.equal(403)
          return done()
        }
        return this.UserController.tryDeleteUser(this.req, this.res, this.next)
      })
    })

    describe('when authenticate produces an error', function() {
      beforeEach(function() {
        return (this.AuthenticationManager.authenticate = sinon
          .stub()
          .callsArgWith(2, new Error('woops')))
      })

      it('should call next with an error', function(done) {
        this.next = err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        }
        return this.UserController.tryDeleteUser(this.req, this.res, this.next)
      })
    })

    describe('when authenticate does not produce a user', function() {
      beforeEach(function() {
        return (this.AuthenticationManager.authenticate = sinon
          .stub()
          .callsArgWith(2, null, null))
      })

      it('should return 403', function(done) {
        this.res.sendStatus = code => {
          code.should.equal(403)
          return done()
        }
        return this.UserController.tryDeleteUser(this.req, this.res, this.next)
      })
    })

    describe('when deleteUser produces an error', function() {
      beforeEach(function() {
        return (this.UserDeleter.deleteUser = sinon
          .stub()
          .yields(new Error('woops')))
      })

      it('should call next with an error', function(done) {
        this.next = err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        }
        return this.UserController.tryDeleteUser(this.req, this.res, this.next)
      })
    })

    describe('when deleteUser produces a known error', function() {
      beforeEach(function() {
        return (this.UserDeleter.deleteUser = sinon
          .stub()
          .yields(new Errors.SubscriptionAdminDeletionError()))
      })

      it('should return a json error', function(done) {
        this.UserController.tryDeleteUser(this.req, null, error => {
          expect(error).to.be.instanceof(HttpErrors.UnprocessableEntityError)
          expect(
            OError.hasCauseInstanceOf(
              error,
              Errors.SubscriptionAdminDeletionError
            )
          ).to.be.true
          done()
        })
      })
    })

    describe('when session.destroy produces an error', function() {
      beforeEach(function() {
        return (this.req.session.destroy = sinon
          .stub()
          .callsArgWith(0, new Error('woops')))
      })

      it('should call next with an error', function(done) {
        this.next = err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        }
        return this.UserController.tryDeleteUser(this.req, this.res, this.next)
      })
    })
  })

  describe('unsubscribe', function() {
    it('should send the user to unsubscribe', function(done) {
      this.res.send = code => {
        this.NewsLetterManager.unsubscribe
          .calledWith(this.user)
          .should.equal(true)
        return done()
      }
      return this.UserController.unsubscribe(this.req, this.res)
    })
  })

  describe('updateUserSettings', function() {
    beforeEach(function() {
      this.newEmail = 'hello@world.com'
      return (this.req.externalAuthenticationSystemUsed = sinon
        .stub()
        .returns(false))
    })

    it('should call save', function(done) {
      this.req.body = {}
      this.res.sendStatus = code => {
        this.user.save.called.should.equal(true)
        return done()
      }
      return this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should set the first name', function(done) {
      this.req.body = { first_name: 'bobby  ' }
      this.res.sendStatus = code => {
        this.user.first_name.should.equal('bobby')
        return done()
      }
      return this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should set the role', function(done) {
      this.req.body = { role: 'student' }
      this.res.sendStatus = code => {
        this.user.role.should.equal('student')
        return done()
      }
      return this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should set the institution', function(done) {
      this.req.body = { institution: 'MIT' }
      this.res.sendStatus = code => {
        this.user.institution.should.equal('MIT')
        return done()
      }
      return this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should set some props on ace', function(done) {
      this.req.body = { editorTheme: 'something' }
      this.res.sendStatus = code => {
        this.user.ace.theme.should.equal('something')
        return done()
      }
      return this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should set the overall theme', function(done) {
      this.req.body = { overallTheme: 'green-ish' }
      this.res.sendStatus = code => {
        this.user.ace.overallTheme.should.equal('green-ish')
        return done()
      }
      return this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should send an error if the email is 0 len', function(done) {
      this.req.body.email = ''
      this.res.sendStatus = function(code) {
        code.should.equal(400)
        return done()
      }
      return this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should send an error if the email does not contain an @', function(done) {
      this.req.body.email = 'bob at something dot com'
      this.res.sendStatus = function(code) {
        code.should.equal(400)
        return done()
      }
      return this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should call the user updater with the new email and user _id', function(done) {
      this.req.body.email = this.newEmail.toUpperCase()
      this.UserUpdater.changeEmailAddress.callsArgWith(2)
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.UserUpdater.changeEmailAddress
          .calledWith(this.user_id, this.newEmail)
          .should.equal(true)
        return done()
      }
      return this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should update the email on the session', function(done) {
      this.req.body.email = this.newEmail.toUpperCase()
      this.UserUpdater.changeEmailAddress.callsArgWith(2)
      let callcount = 0
      this.User.findById = (id, cb) => {
        if (++callcount === 2) {
          this.user.email = this.newEmail
        }
        return cb(null, this.user)
      }
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.AuthenticationController.setInSessionUser
          .calledWith(this.req, {
            email: this.newEmail,
            first_name: undefined,
            last_name: undefined
          })
          .should.equal(true)
        return done()
      }
      return this.UserController.updateUserSettings(this.req, this.res)
    })

    it('should call populateTeamInvites', function(done) {
      this.req.body.email = this.newEmail.toUpperCase()
      this.UserUpdater.changeEmailAddress.callsArgWith(2)
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.UserHandler.populateTeamInvites
          .calledWith(this.user)
          .should.equal(true)
        return done()
      }
      return this.UserController.updateUserSettings(this.req, this.res)
    })

    describe('when using an external auth source', function() {
      beforeEach(function() {
        this.UserUpdater.changeEmailAddress.callsArgWith(2)
        this.newEmail = 'someone23@example.com'
        return (this.req.externalAuthenticationSystemUsed = sinon
          .stub()
          .returns(true))
      })

      it('should not set a new email', function(done) {
        this.req.body.email = this.newEmail
        this.res.sendStatus = code => {
          code.should.equal(200)
          this.UserUpdater.changeEmailAddress
            .calledWith(this.user_id, this.newEmail)
            .should.equal(false)
          return done()
        }
        return this.UserController.updateUserSettings(this.req, this.res)
      })
    })
  })

  describe('logout', function() {
    it('should destroy the session', function(done) {
      this.req.session.destroy = sinon.stub().callsArgWith(0)
      this.res.redirect = url => {
        url.should.equal('/login')
        this.req.session.destroy.called.should.equal(true)
        return done()
      }

      return this.UserController.logout(this.req, this.res)
    })

    it('should clear sudo-mode', function(done) {
      this.req.session.destroy = sinon.stub().callsArgWith(0)
      this.SudoModeHandler.clearSudoMode = sinon.stub()
      this.res.redirect = url => {
        url.should.equal('/login')
        this.SudoModeHandler.clearSudoMode.callCount.should.equal(1)
        this.SudoModeHandler.clearSudoMode
          .calledWith(this.user._id)
          .should.equal(true)
        return done()
      }

      return this.UserController.logout(this.req, this.res)
    })
  })

  describe('register', function() {
    beforeEach(function() {
      this.UserRegistrationHandler.registerNewUserAndSendActivationEmail = sinon
        .stub()
        .callsArgWith(1, null, this.user, (this.url = 'mock/url'))
      this.req.body.email = this.user.email = this.email = 'email@example.com'
      return this.UserController.register(this.req, this.res)
    })

    it('should register the user and send them an email', function() {
      return this.UserRegistrationHandler.registerNewUserAndSendActivationEmail
        .calledWith(this.email)
        .should.equal(true)
    })

    it('should return the user and activation url', function() {
      return this.res.json
        .calledWith({
          email: this.email,
          setNewPasswordUrl: this.url
        })
        .should.equal(true)
    })
  })

  describe('clearSessions', function() {
    it('should call revokeAllUserSessions', function(done) {
      this.UserController.clearSessions(this.req, this.res)
      this.UserSessionsManager.revokeAllUserSessions.callCount.should.equal(1)
      return done()
    })

    it('send a 201 response', function(done) {
      this.res.sendStatus = status => {
        status.should.equal(201)
        return done()
      }
      return this.UserController.clearSessions(this.req, this.res)
    })

    describe('when revokeAllUserSessions produces an error', function() {
      it('should call next with an error', function(done) {
        this.UserSessionsManager.revokeAllUserSessions.callsArgWith(
          2,
          new Error('woops')
        )
        const next = err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        }
        return this.UserController.clearSessions(this.req, this.res, next)
      })
    })
  })

  describe('changePassword', function() {
    it('should check the old password is the current one at the moment', function() {
      this.AuthenticationManager.authenticate.yields()
      this.req.body = { currentPassword: 'oldpasshere' }
      this.UserController.changePassword(this.req, this.res, this.callback)
      this.AuthenticationManager.authenticate.should.have.been.calledWith(
        { _id: this.user._id },
        'oldpasshere'
      )
      this.AuthenticationManager.setUserPassword.callCount.should.equal(0)
    })

    it('it should not set the new password if they do not match', function() {
      this.AuthenticationManager.authenticate.yields(null, {})
      this.req.body = {
        newPassword1: '1',
        newPassword2: '2'
      }
      this.UserController.changePassword(this.req, this.res, this.callback)
      this.res.status.should.have.been.calledWith(400)
      this.AuthenticationManager.setUserPassword.callCount.should.equal(0)
    })

    it('should set the new password if they do match', function() {
      this.AuthenticationManager.authenticate.yields(null, this.user)
      this.AuthenticationManager.setUserPassword.yields()
      this.req.body = {
        newPassword1: 'newpass',
        newPassword2: 'newpass'
      }
      this.UserController.changePassword(this.req, this.res, this.callback)
      this.AuthenticationManager.setUserPassword.should.have.been.calledWith(
        this.user._id,
        'newpass'
      )
    })

    it('it should not set the new password if it is invalid', function() {
      this.AuthenticationManager.validatePassword = sinon
        .stub()
        .returns({ message: 'validation-error' })
      this.AuthenticationManager.authenticate.yields(null, {})
      this.req.body = {
        newPassword1: 'newpass',
        newPassword2: 'newpass'
      }
      this.UserController.changePassword(this.req, this.res, this.callback)
      this.AuthenticationManager.setUserPassword.callCount.should.equal(0)
      this.res.status.should.have.been.calledWith(400)
      this.res.json.should.have.been.calledWith({
        message: {
          type: 'error',
          text: 'validation-error'
        }
      })
    })
  })
})
