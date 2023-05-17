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
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/User/UserPagesController'
)
const { expect } = require('chai')

describe('UserPagesController', function () {
  beforeEach(function () {
    this.settings = {
      apis: {
        v1: {
          url: 'some.host',
          user: 'one',
          pass: 'two',
        },
      },
    }
    this.user = {
      _id: (this.user_id = 'kwjewkl'),
      features: {},
      email: 'joe@example.com',
      ip_address: '1.1.1.1',
      session_created: 'timestamp',
      thirdPartyIdentifiers: [
        {
          providerId: 'google',
          externalUserId: 'testId',
        },
      ],
      refProviders: {
        mendeley: true,
        zotero: true,
      },
    }

    this.UserGetter = {
      getUser: sinon.stub(),
      promises: { getUser: sinon.stub() },
    }
    this.UserSessionsManager = { getAllUserSessions: sinon.stub() }
    this.dropboxStatus = {}
    this.ErrorController = { notFound: sinon.stub() }
    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(this.user._id),
      getSessionUser: sinon.stub().returns(this.user),
    }
    this.NewsletterManager = {
      subscribed: sinon.stub().yields(),
    }
    this.AuthenticationController = {
      _getRedirectFromSession: sinon.stub(),
      setRedirectInSession: sinon.stub(),
    }
    this.Features = {
      hasFeature: sinon.stub().returns(false),
    }
    this.PersonalAccessTokenManager = {
      listTokens: sinon.stub().returns([]),
    }
    this.UserPagesController = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        './UserGetter': this.UserGetter,
        './UserSessionsManager': this.UserSessionsManager,
        '../Newsletter/NewsletterManager': this.NewsletterManager,
        '../Errors/ErrorController': this.ErrorController,
        '../Authentication/AuthenticationController':
          this.AuthenticationController,
        '../../infrastructure/Features': this.Features,
        '../../../../modules/oauth2-server/app/src/OAuthPersonalAccessTokenManager':
          this.PersonalAccessTokenManager,
        '../Authentication/SessionManager': this.SessionManager,
        request: (this.request = sinon.stub()),
      },
    })
    this.req = {
      query: {},
      session: {
        user: this.user,
      },
    }
    return (this.res = {})
  })

  describe('registerPage', function () {
    it('should render the register page', function (done) {
      this.res.render = page => {
        page.should.equal('user/register')
        return done()
      }
      return this.UserPagesController.registerPage(this.req, this.res)
    })

    it('should set sharedProjectData', function (done) {
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

    it('should set newTemplateData', function (done) {
      this.req.session.templateData = { templateName: 'templateName' }

      this.res.render = (page, opts) => {
        opts.newTemplateData.templateName.should.equal('templateName')
        return done()
      }
      return this.UserPagesController.registerPage(this.req, this.res)
    })

    it('should not set the newTemplateData if there is nothing in the session', function (done) {
      this.res.render = (page, opts) => {
        assert.equal(opts.newTemplateData.templateName, undefined)
        return done()
      }
      return this.UserPagesController.registerPage(this.req, this.res)
    })
  })

  describe('loginForm', function () {
    it('should render the login page', function (done) {
      this.res.render = page => {
        page.should.equal('user/login')
        return done()
      }
      return this.UserPagesController.loginPage(this.req, this.res)
    })

    describe('when an explicit redirect is set via query string', function () {
      beforeEach(function () {
        this.AuthenticationController._getRedirectFromSession = sinon
          .stub()
          .returns(null)
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        return (this.req.query.redir = '/somewhere/in/particular')
      })

      it('should set a redirect', function (done) {
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

  describe('sessionsPage', function () {
    beforeEach(function () {
      return this.UserSessionsManager.getAllUserSessions.callsArgWith(
        2,
        null,
        []
      )
    })

    it('should render user/sessions', function (done) {
      this.res.render = function (page) {
        page.should.equal('user/sessions')
        return done()
      }
      return this.UserPagesController.sessionsPage(this.req, this.res)
    })

    it('should include current session data in the view', function (done) {
      this.res.render = (page, opts) => {
        expect(opts.currentSession).to.deep.equal({
          ip_address: '1.1.1.1',
          session_created: 'timestamp',
        })
        return done()
      }
      return this.UserPagesController.sessionsPage(this.req, this.res)
    })

    it('should have called getAllUserSessions', function (done) {
      this.res.render = page => {
        this.UserSessionsManager.getAllUserSessions.callCount.should.equal(1)
        return done()
      }
      return this.UserPagesController.sessionsPage(this.req, this.res)
    })

    describe('when getAllUserSessions produces an error', function () {
      beforeEach(function () {
        return this.UserSessionsManager.getAllUserSessions.callsArgWith(
          2,
          new Error('woops')
        )
      })

      it('should call next with an error', function (done) {
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

  describe('emailPreferencesPage', function () {
    beforeEach(function () {
      this.UserGetter.getUser = sinon.stub().yields(null, this.user)
    })

    it('render page with subscribed status', function (done) {
      this.NewsletterManager.subscribed.yields(null, true)
      this.res.render = function (page, data) {
        page.should.equal('user/email-preferences')
        data.title.should.equal('newsletter_info_title')
        data.subscribed.should.equal(true)
        return done()
      }
      return this.UserPagesController.emailPreferencesPage(this.req, this.res)
    })

    it('render page with unsubscribed status', function (done) {
      this.NewsletterManager.subscribed.yields(null, false)
      this.res.render = function (page, data) {
        page.should.equal('user/email-preferences')
        data.title.should.equal('newsletter_info_title')
        data.subscribed.should.equal(false)
        return done()
      }
      return this.UserPagesController.emailPreferencesPage(this.req, this.res)
    })
  })

  describe('settingsPage', function () {
    beforeEach(function () {
      this.request.get = sinon
        .stub()
        .callsArgWith(1, null, { statusCode: 200 }, { has_password: true })
      this.UserGetter.promises.getUser = sinon.stub().resolves(this.user)
    })

    it('should render user/settings', function (done) {
      this.res.render = function (page) {
        page.should.equal('user/settings')
        return done()
      }
      return this.UserPagesController.settingsPage(this.req, this.res)
    })

    it('should send user', function (done) {
      this.res.render = (page, opts) => {
        opts.user.id.should.equal(this.user._id)
        opts.user.email.should.equal(this.user.email)
        return done()
      }
      return this.UserPagesController.settingsPage(this.req, this.res)
    })

    it("should set 'shouldAllowEditingDetails' to true", function (done) {
      this.res.render = (page, opts) => {
        opts.shouldAllowEditingDetails.should.equal(true)
        return done()
      }
      return this.UserPagesController.settingsPage(this.req, this.res)
    })

    it('should restructure thirdPartyIdentifiers data for template use', function (done) {
      const expectedResult = {
        google: 'testId',
      }
      this.res.render = (page, opts) => {
        expect(opts.thirdPartyIds).to.include(expectedResult)
        return done()
      }
      return this.UserPagesController.settingsPage(this.req, this.res)
    })

    it("should set and clear 'projectSyncSuccessMessage'", function (done) {
      this.req.session.projectSyncSuccessMessage = 'Some Sync Success'
      this.res.render = (page, opts) => {
        opts.projectSyncSuccessMessage.should.equal('Some Sync Success')
        expect(this.req.session.projectSyncSuccessMessage).to.not.exist
        return done()
      }
      return this.UserPagesController.settingsPage(this.req, this.res)
    })

    describe('when ldap.updateUserDetailsOnLogin is true', function () {
      beforeEach(function () {
        return (this.settings.ldap = { updateUserDetailsOnLogin: true })
      })

      afterEach(function () {
        return delete this.settings.ldap
      })

      it('should set "shouldAllowEditingDetails" to false', function (done) {
        this.res.render = (page, opts) => {
          opts.shouldAllowEditingDetails.should.equal(false)
          return done()
        }
        return this.UserPagesController.settingsPage(this.req, this.res)
      })
    })

    describe('when saml.updateUserDetailsOnLogin is true', function () {
      beforeEach(function () {
        return (this.settings.saml = { updateUserDetailsOnLogin: true })
      })

      afterEach(function () {
        return delete this.settings.saml
      })

      it('should set "shouldAllowEditingDetails" to false', function (done) {
        this.res.render = (page, opts) => {
          opts.shouldAllowEditingDetails.should.equal(false)
          return done()
        }
        return this.UserPagesController.settingsPage(this.req, this.res)
      })
    })
  })
})
