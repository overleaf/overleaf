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
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/User/UserPagesController'
)
const { expect } = require('chai')

describe('UserPagesController', function() {
  beforeEach(function() {
    this.settings = {
      apis: {
        v1: {
          url: 'some.host',
          user: 'one',
          pass: 'two'
        }
      }
    }
    this.user = {
      _id: (this.user_id = 'kwjewkl'),
      features: {},
      email: 'joe@example.com',
      thirdPartyIdentifiers: [
        {
          providerId: 'google',
          externalUserId: 'testId'
        }
      ]
    }

    this.UserGetter = { getUser: sinon.stub() }
    this.UserSessionsManager = { getAllUserSessions: sinon.stub() }
    this.dropboxStatus = {}
    this.DropboxHandler = {
      getUserRegistrationStatus: sinon
        .stub()
        .callsArgWith(1, null, this.dropboxStatus)
    }
    this.ErrorController = { notFound: sinon.stub() }
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.user._id),
      getSessionUser: sinon.stub().returns(this.user),
      _getRedirectFromSession: sinon.stub(),
      setRedirectInSession: sinon.stub()
    }
    this.UserPagesController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        },
        './UserGetter': this.UserGetter,
        './UserSessionsManager': this.UserSessionsManager,
        '../Errors/ErrorController': this.ErrorController,
        '../Dropbox/DropboxHandler': this.DropboxHandler,
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        request: (this.request = sinon.stub())
      }
    })
    this.req = {
      query: {},
      session: {
        user: this.user
      }
    }
    return (this.res = {})
  })

  describe('registerPage', function() {
    it('should render the register page', function(done) {
      this.res.render = page => {
        page.should.equal('user/register')
        return done()
      }
      return this.UserPagesController.registerPage(this.req, this.res)
    })

    it('should set sharedProjectData', function(done) {
      this.req.query.project_name = 'myProject'
      this.req.query.user_first_name = 'user_first_name_here'

      this.res.render = (page, opts) => {
        opts.sharedProjectData.project_name.should.equal('myProject')
        opts.sharedProjectData.user_first_name.should.equal(
          'user_first_name_here'
        )
        return done()
      }
      return this.UserPagesController.registerPage(this.req, this.res)
    })

    it('should set newTemplateData', function(done) {
      this.req.session.templateData = { templateName: 'templateName' }

      this.res.render = (page, opts) => {
        opts.newTemplateData.templateName.should.equal('templateName')
        return done()
      }
      return this.UserPagesController.registerPage(this.req, this.res)
    })

    it('should not set the newTemplateData if there is nothing in the session', function(done) {
      this.res.render = (page, opts) => {
        assert.equal(opts.newTemplateData.templateName, undefined)
        return done()
      }
      return this.UserPagesController.registerPage(this.req, this.res)
    })
  })

  describe('loginForm', function() {
    it('should render the login page', function(done) {
      this.res.render = page => {
        page.should.equal('user/login')
        return done()
      }
      return this.UserPagesController.loginPage(this.req, this.res)
    })

    describe('when an explicit redirect is set via query string', function() {
      beforeEach(function() {
        this.AuthenticationController._getRedirectFromSession = sinon
          .stub()
          .returns(null)
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        return (this.req.query.redir = '/somewhere/in/particular')
      })

      it('should set a redirect', function(done) {
        this.res.render = page => {
          this.AuthenticationController.setRedirectInSession.callCount.should.equal(
            1
          )
          expect(
            this.AuthenticationController.setRedirectInSession.lastCall.args[1]
          ).to.equal(this.req.query.redir)
          return done()
        }
        return this.UserPagesController.loginPage(this.req, this.res)
      })
    })
  })

  describe('sessionsPage', function() {
    beforeEach(function() {
      return this.UserSessionsManager.getAllUserSessions.callsArgWith(
        2,
        null,
        []
      )
    })

    it('should render user/sessions', function(done) {
      this.res.render = function(page) {
        page.should.equal('user/sessions')
        return done()
      }
      return this.UserPagesController.sessionsPage(this.req, this.res)
    })

    it('should have called getAllUserSessions', function(done) {
      this.res.render = page => {
        this.UserSessionsManager.getAllUserSessions.callCount.should.equal(1)
        return done()
      }
      return this.UserPagesController.sessionsPage(this.req, this.res)
    })

    describe('when getAllUserSessions produces an error', function() {
      beforeEach(function() {
        return this.UserSessionsManager.getAllUserSessions.callsArgWith(
          2,
          new Error('woops')
        )
      })

      it('should call next with an error', function(done) {
        this.next = err => {
          assert(err !== null)
          assert(err instanceof Error)
          return done()
        }
        return this.UserPagesController.sessionsPage(
          this.req,
          this.res,
          this.next
        )
      })
    })
  })

  describe('settingsPage', function() {
    beforeEach(function() {
      this.request.get = sinon
        .stub()
        .callsArgWith(1, null, { statusCode: 200 }, { has_password: true })
      return (this.UserGetter.getUser = sinon
        .stub()
        .callsArgWith(1, null, this.user))
    })

    it('should render user/settings', function(done) {
      this.res.render = function(page) {
        page.should.equal('user/settings')
        return done()
      }
      return this.UserPagesController.settingsPage(this.req, this.res)
    })

    it('should send user', function(done) {
      this.res.render = (page, opts) => {
        opts.user.should.equal(this.user)
        return done()
      }
      return this.UserPagesController.settingsPage(this.req, this.res)
    })

    it("should set 'shouldAllowEditingDetails' to true", function(done) {
      this.res.render = (page, opts) => {
        opts.shouldAllowEditingDetails.should.equal(true)
        return done()
      }
      return this.UserPagesController.settingsPage(this.req, this.res)
    })

    it('should restructure thirdPartyIdentifiers data for template use', function(done) {
      const expectedResult = {
        google: 'testId'
      }
      this.res.render = (page, opts) => {
        expect(opts.thirdPartyIds).to.include(expectedResult)
        return done()
      }
      return this.UserPagesController.settingsPage(this.req, this.res)
    })

    describe('when ldap.updateUserDetailsOnLogin is true', function() {
      beforeEach(function() {
        return (this.settings.ldap = { updateUserDetailsOnLogin: true })
      })

      afterEach(function() {
        return delete this.settings.ldap
      })

      it('should set "shouldAllowEditingDetails" to false', function(done) {
        this.res.render = (page, opts) => {
          opts.shouldAllowEditingDetails.should.equal(false)
          return done()
        }
        return this.UserPagesController.settingsPage(this.req, this.res)
      })
    })

    describe('when saml.updateUserDetailsOnLogin is true', function() {
      beforeEach(function() {
        return (this.settings.saml = { updateUserDetailsOnLogin: true })
      })

      afterEach(function() {
        return delete this.settings.saml
      })

      it('should set "shouldAllowEditingDetails" to false', function(done) {
        this.res.render = (page, opts) => {
          opts.shouldAllowEditingDetails.should.equal(false)
          return done()
        }
        return this.UserPagesController.settingsPage(this.req, this.res)
      })
    })
  })

  describe('activateAccountPage', function() {
    beforeEach(function() {
      this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, this.user)
      this.req.query.user_id = this.user_id
      return (this.req.query.token = this.token = 'mock-token-123')
    })

    it('should 404 without a user_id', function(done) {
      delete this.req.query.user_id
      this.ErrorController.notFound = () => done()
      return this.UserPagesController.activateAccountPage(this.req, this.res)
    })

    it('should 404 without a token', function(done) {
      delete this.req.query.token
      this.ErrorController.notFound = () => done()
      return this.UserPagesController.activateAccountPage(this.req, this.res)
    })

    it('should 404 without a valid user_id', function(done) {
      this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
      this.ErrorController.notFound = () => done()
      return this.UserPagesController.activateAccountPage(this.req, this.res)
    })

    it('should redirect activated users to login', function(done) {
      this.user.loginCount = 1
      this.res.redirect = url => {
        this.UserGetter.getUser.calledWith(this.user_id).should.equal(true)
        url.should.equal(`/login?email=${encodeURIComponent(this.user.email)}`)
        return done()
      }
      return this.UserPagesController.activateAccountPage(this.req, this.res)
    })

    it('render the activation page if the user has not logged in before', function(done) {
      this.user.loginCount = 0
      this.res.render = (page, opts) => {
        page.should.equal('user/activate')
        opts.email.should.equal(this.user.email)
        opts.token.should.equal(this.token)
        return done()
      }
      return this.UserPagesController.activateAccountPage(this.req, this.res)
    })
  })
})
