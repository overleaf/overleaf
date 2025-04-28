import esmock from 'esmock'
import assert from 'assert'
import sinon from 'sinon'
import { expect } from 'chai'
import MockResponse from '../helpers/MockResponse.js'
import MockRequest from '../helpers/MockRequest.js'

const modulePath = new URL(
  '../../../../app/src/Features/User/UserPagesController',
  import.meta.url
).pathname

describe('UserPagesController', function () {
  beforeEach(async function () {
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
        mendeley: { encrypted: 'aaaa' },
        zotero: { encrypted: 'bbbb' },
        papers: { encrypted: 'cccc' },
      },
    }
    this.adminEmail = 'group-admin-email@overleaf.com'
    this.subscriptionViewModel = {
      memberGroupSubscriptions: [],
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
      getRedirectFromSession: sinon.stub(),
      setRedirectInSession: sinon.stub(),
    }
    this.Features = {
      hasFeature: sinon.stub().returns(false),
    }
    this.PersonalAccessTokenManager = {
      listTokens: sinon.stub().returns([]),
    }
    this.SubscriptionLocator = {
      promises: {
        getAdminEmail: sinon.stub().returns(this.adminEmail),
        getMemberSubscriptions: sinon.stub().resolves(),
      },
    }
    this.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().returns('default'),
      },
    }
    this.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves(),
        },
      },
    }
    this.UserPagesController = await esmock.strict(modulePath, {
      '@overleaf/settings': this.settings,
      '../../../../app/src/Features/User/UserGetter': this.UserGetter,
      '../../../../app/src/Features/User/UserSessionsManager':
        this.UserSessionsManager,
      '../../../../app/src/Features/Newsletter/NewsletterManager':
        this.NewsletterManager,
      '../../../../app/src/Features/Errors/ErrorController':
        this.ErrorController,
      '../../../../app/src/Features/Authentication/AuthenticationController':
        this.AuthenticationController,
      '../../../../app/src/Features/Subscription/SubscriptionLocator':
        this.SubscriptionLocator,
      '../../../../app/src/infrastructure/Features': this.Features,
      '../../../../modules/oauth2-server/app/src/OAuthPersonalAccessTokenManager':
        this.PersonalAccessTokenManager,
      '../../../../app/src/Features/Authentication/SessionManager':
        this.SessionManager,
      '../../../../app/src/Features/SplitTests/SplitTestHandler':
        this.SplitTestHandler,
      '../../../../app/src/infrastructure/Modules': this.Modules,
      request: (this.request = sinon.stub()),
    })
    this.req = new MockRequest()
    this.req.session.user = this.user
    this.res = new MockResponse()
  })

  describe('registerPage', function () {
    it('should render the register page', function (done) {
      this.res.callback = () => {
        this.res.renderedTemplate.should.equal('user/register')
        done()
      }
      this.UserPagesController.registerPage(this.req, this.res, done)
    })

    it('should set sharedProjectData', function (done) {
      this.req.session.sharedProjectData = {
        project_name: 'myProject',
        user_first_name: 'user_first_name_here',
      }

      this.res.callback = () => {
        this.res.renderedVariables.sharedProjectData.project_name.should.equal(
          'myProject'
        )
        this.res.renderedVariables.sharedProjectData.user_first_name.should.equal(
          'user_first_name_here'
        )
        done()
      }
      this.UserPagesController.registerPage(this.req, this.res, done)
    })

    it('should set newTemplateData', function (done) {
      this.req.session.templateData = { templateName: 'templateName' }

      this.res.callback = () => {
        this.res.renderedVariables.newTemplateData.templateName.should.equal(
          'templateName'
        )
        done()
      }
      this.UserPagesController.registerPage(this.req, this.res, done)
    })

    it('should not set the newTemplateData if there is nothing in the session', function (done) {
      this.res.callback = () => {
        assert.equal(
          this.res.renderedVariables.newTemplateData.templateName,
          undefined
        )
        done()
      }
      this.UserPagesController.registerPage(this.req, this.res, done)
    })
  })

  describe('loginForm', function () {
    it('should render the login page', function (done) {
      this.res.callback = () => {
        this.res.renderedTemplate.should.equal('user/login')
        done()
      }
      this.UserPagesController.loginPage(this.req, this.res, done)
    })

    describe('when an explicit redirect is set via query string', function () {
      beforeEach(function () {
        this.AuthenticationController.getRedirectFromSession = sinon
          .stub()
          .returns(null)
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.req.query.redir = '/somewhere/in/particular'
      })

      it('should set a redirect', function (done) {
        this.res.callback = page => {
          this.AuthenticationController.setRedirectInSession.callCount.should.equal(
            1
          )
          expect(
            this.AuthenticationController.setRedirectInSession.lastCall.args[1]
          ).to.equal(this.req.query.redir)
          done()
        }
        this.UserPagesController.loginPage(this.req, this.res, done)
      })
    })
  })

  describe('sessionsPage', function () {
    beforeEach(function () {
      this.UserSessionsManager.getAllUserSessions.callsArgWith(2, null, [])
    })

    it('should render user/sessions', function (done) {
      this.res.callback = () => {
        this.res.renderedTemplate.should.equal('user/sessions')
        done()
      }
      this.UserPagesController.sessionsPage(this.req, this.res, done)
    })

    it('should include current session data in the view', function (done) {
      this.res.callback = () => {
        expect(this.res.renderedVariables.currentSession).to.deep.equal({
          ip_address: '1.1.1.1',
          session_created: 'timestamp',
        })
        done()
      }
      this.UserPagesController.sessionsPage(this.req, this.res, done)
    })

    it('should have called getAllUserSessions', function (done) {
      this.res.callback = page => {
        this.UserSessionsManager.getAllUserSessions.callCount.should.equal(1)
        done()
      }
      this.UserPagesController.sessionsPage(this.req, this.res, done)
    })

    describe('when getAllUserSessions produces an error', function () {
      beforeEach(function () {
        this.UserSessionsManager.getAllUserSessions.callsArgWith(
          2,
          new Error('woops')
        )
      })

      it('should call next with an error', function (done) {
        this.next = err => {
          assert(err !== null)
          assert(err instanceof Error)
          done()
        }
        this.UserPagesController.sessionsPage(this.req, this.res, this.next)
      })
    })
  })

  describe('emailPreferencesPage', function () {
    beforeEach(function () {
      this.UserGetter.getUser = sinon.stub().yields(null, this.user)
    })

    it('render page with subscribed status', function (done) {
      this.NewsletterManager.subscribed.yields(null, true)
      this.res.callback = () => {
        this.res.renderedTemplate.should.equal('user/email-preferences')
        this.res.renderedVariables.title.should.equal('newsletter_info_title')
        this.res.renderedVariables.subscribed.should.equal(true)
        done()
      }
      this.UserPagesController.emailPreferencesPage(this.req, this.res, done)
    })

    it('render page with unsubscribed status', function (done) {
      this.NewsletterManager.subscribed.yields(null, false)
      this.res.callback = () => {
        this.res.renderedTemplate.should.equal('user/email-preferences')
        this.res.renderedVariables.title.should.equal('newsletter_info_title')
        this.res.renderedVariables.subscribed.should.equal(false)
        done()
      }
      this.UserPagesController.emailPreferencesPage(this.req, this.res, done)
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
      this.res.callback = () => {
        this.res.renderedTemplate.should.equal('user/settings')
        done()
      }
      this.UserPagesController.settingsPage(this.req, this.res, done)
    })

    it('should send user', function (done) {
      this.res.callback = () => {
        this.res.renderedVariables.user.id.should.equal(this.user._id)
        this.res.renderedVariables.user.email.should.equal(this.user.email)
        done()
      }
      this.UserPagesController.settingsPage(this.req, this.res, done)
    })

    it("should set 'shouldAllowEditingDetails' to true", function (done) {
      this.res.callback = () => {
        this.res.renderedVariables.shouldAllowEditingDetails.should.equal(true)
        done()
      }
      this.UserPagesController.settingsPage(this.req, this.res, done)
    })

    it('should restructure thirdPartyIdentifiers data for template use', function (done) {
      const expectedResult = {
        google: 'testId',
      }
      this.res.callback = () => {
        expect(this.res.renderedVariables.thirdPartyIds).to.include(
          expectedResult
        )
        done()
      }
      this.UserPagesController.settingsPage(this.req, this.res, done)
    })

    it("should set and clear 'projectSyncSuccessMessage'", function (done) {
      this.req.session.projectSyncSuccessMessage = 'Some Sync Success'
      this.res.callback = () => {
        this.res.renderedVariables.projectSyncSuccessMessage.should.equal(
          'Some Sync Success'
        )
        expect(this.req.session.projectSyncSuccessMessage).to.not.exist
        done()
      }
      this.UserPagesController.settingsPage(this.req, this.res, done)
    })

    it('should cast refProviders to booleans', function (done) {
      this.res.callback = () => {
        expect(this.res.renderedVariables.user.refProviders).to.deep.equal({
          mendeley: true,
          papers: true,
          zotero: true,
        })
        done()
      }
      this.UserPagesController.settingsPage(this.req, this.res, done)
    })

    it('should send the correct managed user admin email', function (done) {
      this.res.callback = () => {
        expect(
          this.res.renderedVariables.currentManagedUserAdminEmail
        ).to.equal(this.adminEmail)
        done()
      }
      this.UserPagesController.settingsPage(this.req, this.res, done)
    })

    it('should send info for groups with SSO enabled', function (done) {
      this.user.enrollment = {
        sso: [
          {
            groupId: 'abc123abc123',
            primary: true,
            linkedAt: new Date(),
          },
        ],
      }
      const group1 = {
        _id: 'abc123abc123',
        teamName: 'Group SSO Rulz',
        admin_id: {
          email: 'admin.email@ssolove.com',
        },
        linked: true,
      }
      const group2 = {
        _id: 'def456def456',
        admin_id: {
          email: 'someone.else@noname.co.uk',
        },
        linked: false,
      }

      this.Modules.promises.hooks.fire
        .withArgs('getUserGroupsSSOEnrollmentStatus')
        .resolves([[group1, group2]])

      this.res.callback = () => {
        expect(
          this.res.renderedVariables.memberOfSSOEnabledGroups
        ).to.deep.equal([
          {
            groupId: 'abc123abc123',
            groupName: 'Group SSO Rulz',
            adminEmail: 'admin.email@ssolove.com',
            linked: true,
          },
          {
            groupId: 'def456def456',
            groupName: undefined,
            adminEmail: 'someone.else@noname.co.uk',
            linked: false,
          },
        ])
        done()
      }

      this.UserPagesController.settingsPage(this.req, this.res, done)
    })

    describe('when ldap.updateUserDetailsOnLogin is true', function () {
      beforeEach(function () {
        this.settings.ldap = { updateUserDetailsOnLogin: true }
      })

      afterEach(function () {
        delete this.settings.ldap
      })

      it('should set "shouldAllowEditingDetails" to false', function (done) {
        this.res.callback = () => {
          this.res.renderedVariables.shouldAllowEditingDetails.should.equal(
            false
          )
          done()
        }
        this.UserPagesController.settingsPage(this.req, this.res, done)
      })
    })

    describe('when saml.updateUserDetailsOnLogin is true', function () {
      beforeEach(function () {
        this.settings.saml = { updateUserDetailsOnLogin: true }
      })

      afterEach(function () {
        delete this.settings.saml
      })

      it('should set "shouldAllowEditingDetails" to false', function (done) {
        this.res.callback = () => {
          this.res.renderedVariables.shouldAllowEditingDetails.should.equal(
            false
          )
          done()
        }
        this.UserPagesController.settingsPage(this.req, this.res, done)
      })
    })
  })
})
