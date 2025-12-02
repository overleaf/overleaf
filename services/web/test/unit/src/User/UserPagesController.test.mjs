import { expect, vi } from 'vitest'
import assert from 'node:assert'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.mjs'
import MockRequest from '../helpers/MockRequest.mjs'

const modulePath = '../../../../app/src/Features/User/UserPagesController'

describe('UserPagesController', function () {
  beforeEach(async function (ctx) {
    ctx.settings = {
      apis: {
        v1: {
          url: 'some.host',
          user: 'one',
          pass: 'two',
        },
      },
    }
    ctx.user = {
      _id: (ctx.user_id = 'kwjewkl'),
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
    ctx.adminEmail = 'group-admin-email@overleaf.com'
    ctx.subscriptionViewModel = {
      memberGroupSubscriptions: [],
    }

    ctx.UserGetter = {
      getUser: sinon.stub(),
      promises: { getUser: sinon.stub() },
    }
    ctx.UserSessionsManager = { getAllUserSessions: sinon.stub() }
    ctx.dropboxStatus = {}
    ctx.ErrorController = { notFound: sinon.stub() }
    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(ctx.user._id),
      getSessionUser: sinon.stub().returns(ctx.user),
    }
    ctx.NewsletterManager = {
      subscribed: sinon.stub().yields(),
    }
    ctx.AuthenticationController = {
      getRedirectFromSession: sinon.stub(),
      setRedirectInSession: sinon.stub(),
    }
    ctx.Features = {
      hasFeature: sinon.stub().returns(false),
    }
    ctx.PersonalAccessTokenManager = {
      listTokens: sinon.stub().returns([]),
    }
    ctx.SubscriptionLocator = {
      promises: {
        getAdminEmail: sinon.stub().returns(ctx.adminEmail),
        getMemberSubscriptions: sinon.stub().resolves(),
      },
    }
    ctx.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().returns('default'),
      },
    }
    ctx.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves(),
        },
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/User/UserSessionsManager', () => ({
      default: ctx.UserSessionsManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/Newsletter/NewsletterManager',
      () => ({
        default: ctx.NewsletterManager,
      })
    )

    vi.doMock('../../../../app/src/Features/Errors/ErrorController', () => ({
      default: ctx.ErrorController,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationController',
      () => ({
        default: ctx.AuthenticationController,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: ctx.Features,
    }))

    vi.doMock(
      '../../../../modules/oauth2-server/app/src/OAuthPersonalAccessTokenManager',
      () => ({
        default: ctx.PersonalAccessTokenManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))
    ctx.request = sinon.stub()
    vi.doMock('request', () => ({
      default: ctx.request,
    }))

    ctx.UserPagesController = (await import(modulePath)).default
    ctx.req = new MockRequest(vi)
    ctx.req.capabilitySet = new Set()
    ctx.req.session.user = ctx.user
    ctx.res = new MockResponse(vi)
  })

  describe('registerPage', function () {
    it('should render the register page', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.res.renderedTemplate.should.equal('user/register')
          resolve()
        }
        ctx.UserPagesController.registerPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should set sharedProjectData', async function (ctx) {
      ctx.req.session.sharedProjectData = {
        project_name: 'myProject',
        user_first_name: 'user_first_name_here',
      }
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.res.renderedVariables.sharedProjectData.project_name.should.equal(
            'myProject'
          )
          ctx.res.renderedVariables.sharedProjectData.user_first_name.should.equal(
            'user_first_name_here'
          )
          resolve()
        }
        ctx.UserPagesController.registerPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should set newTemplateData', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.req.session.templateData = { templateName: 'templateName' }

        ctx.res.callback = () => {
          ctx.res.renderedVariables.newTemplateData.templateName.should.equal(
            'templateName'
          )
          resolve()
        }
        ctx.UserPagesController.registerPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should not set the newTemplateData if there is nothing in the session', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          assert.equal(
            ctx.res.renderedVariables.newTemplateData.templateName,
            undefined
          )
          resolve()
        }
        ctx.UserPagesController.registerPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })
  })

  describe('loginForm', function () {
    it('should render the login page', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.res.renderedTemplate.should.equal('user/login')
          resolve()
        }
        ctx.UserPagesController.loginPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    describe('when an explicit redirect is set via query string', function () {
      beforeEach(function (ctx) {
        ctx.AuthenticationController.getRedirectFromSession = sinon
          .stub()
          .returns(null)
        ctx.AuthenticationController.setRedirectInSession = sinon.stub()
        ctx.req.query.redir = '/somewhere/in/particular'
      })

      it('should set a redirect', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.res.callback = page => {
            ctx.AuthenticationController.setRedirectInSession.callCount.should.equal(
              1
            )
            expect(
              ctx.AuthenticationController.setRedirectInSession.lastCall.args[1]
            ).to.equal(ctx.req.query.redir)
            resolve()
          }
          ctx.UserPagesController.loginPage(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })
    })
  })

  describe('sessionsPage', function () {
    beforeEach(function (ctx) {
      ctx.UserSessionsManager.getAllUserSessions.callsArgWith(2, null, [])
    })

    it('should render user/sessions', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.res.renderedTemplate.should.equal('user/sessions')
          resolve()
        }
        ctx.UserPagesController.sessionsPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should include current session data in the view', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          expect(ctx.res.renderedVariables.currentSession).to.deep.equal({
            ip_address: '1.1.1.1',
            session_created: 'timestamp',
          })
          resolve()
        }
        ctx.UserPagesController.sessionsPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should have called getAllUserSessions', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = page => {
          ctx.UserSessionsManager.getAllUserSessions.callCount.should.equal(1)
          resolve()
        }
        ctx.UserPagesController.sessionsPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    describe('when getAllUserSessions produces an error', function () {
      beforeEach(function (ctx) {
        ctx.UserSessionsManager.getAllUserSessions.callsArgWith(
          2,
          new Error('woops')
        )
      })

      it('should call next with an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.next = err => {
            assert(err !== null)
            assert(err instanceof Error)
            resolve()
          }
          ctx.UserPagesController.sessionsPage(ctx.req, ctx.res, ctx.next)
        })
      })
    })
  })

  describe('emailPreferencesPage', function () {
    beforeEach(function (ctx) {
      ctx.UserGetter.getUser = sinon.stub().yields(null, ctx.user)
    })

    it('render page with subscribed status', async function (ctx) {
      ctx.NewsletterManager.subscribed.yields(null, true)
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.res.renderedTemplate.should.equal('user/email-preferences')
          ctx.res.renderedVariables.title.should.equal('newsletter_info_title')
          ctx.res.renderedVariables.subscribed.should.equal(true)
          resolve()
        }
        ctx.UserPagesController.emailPreferencesPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('render page with unsubscribed status', async function (ctx) {
      ctx.NewsletterManager.subscribed.yields(null, false)
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.res.renderedTemplate.should.equal('user/email-preferences')
          ctx.res.renderedVariables.title.should.equal('newsletter_info_title')
          ctx.res.renderedVariables.subscribed.should.equal(false)
          resolve()
        }
        ctx.UserPagesController.emailPreferencesPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })
  })

  describe('settingsPage', function () {
    beforeEach(function (ctx) {
      ctx.request.get = sinon
        .stub()
        .callsArgWith(1, null, { statusCode: 200 }, { has_password: true })
      ctx.UserGetter.promises.getUser = sinon.stub().resolves(ctx.user)
    })

    it('should render user/settings', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.res.renderedTemplate.should.equal('user/settings')
          resolve()
        }
        ctx.UserPagesController.settingsPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should send user', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.res.renderedVariables.user.id.should.equal(ctx.user._id)
          ctx.res.renderedVariables.user.email.should.equal(ctx.user.email)
          resolve()
        }
        ctx.UserPagesController.settingsPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it("should set 'shouldAllowEditingDetails' to true", async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.res.renderedVariables.shouldAllowEditingDetails.should.equal(true)
          resolve()
        }
        ctx.UserPagesController.settingsPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should restructure thirdPartyIdentifiers data for template use', async function (ctx) {
      const expectedResult = {
        google: 'testId',
      }
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          expect(ctx.res.renderedVariables.thirdPartyIds).to.include(
            expectedResult
          )
          resolve()
        }
        ctx.UserPagesController.settingsPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it("should set and clear 'projectSyncSuccessMessage'", async function (ctx) {
      ctx.req.session.projectSyncSuccessMessage = 'Some Sync Success'
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.res.renderedVariables.projectSyncSuccessMessage.should.equal(
            'Some Sync Success'
          )
          expect(ctx.req.session.projectSyncSuccessMessage).to.not.exist
          resolve()
        }
        ctx.UserPagesController.settingsPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should cast refProviders to booleans', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          expect(ctx.res.renderedVariables.user.refProviders).to.deep.equal({
            mendeley: true,
            papers: true,
            zotero: true,
          })
          resolve()
        }
        ctx.UserPagesController.settingsPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should send the correct managed user admin email', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          expect(
            ctx.res.renderedVariables.currentManagedUserAdminEmail
          ).to.equal(ctx.adminEmail)
          resolve()
        }
        ctx.UserPagesController.settingsPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should send info for groups with SSO enabled', async function (ctx) {
      ctx.user.enrollment = {
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

      ctx.Modules.promises.hooks.fire
        .withArgs('getUserGroupsSSOEnrollmentStatus')
        .resolves([[group1, group2]])
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          expect(
            ctx.res.renderedVariables.memberOfSSOEnabledGroups
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
          resolve()
        }

        ctx.UserPagesController.settingsPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    describe('when ldap.updateUserDetailsOnLogin is true', function () {
      beforeEach(function (ctx) {
        ctx.settings.ldap = { updateUserDetailsOnLogin: true }
      })

      afterEach(function (ctx) {
        delete ctx.settings.ldap
      })

      it('should set "shouldAllowEditingDetails" to false', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.res.callback = () => {
            ctx.res.renderedVariables.shouldAllowEditingDetails.should.equal(
              false
            )
            resolve()
          }
          ctx.UserPagesController.settingsPage(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })
    })

    describe('when saml.updateUserDetailsOnLogin is true', function () {
      beforeEach(function (ctx) {
        ctx.settings.saml = { updateUserDetailsOnLogin: true }
      })

      afterEach(function (ctx) {
        delete ctx.settings.saml
      })

      it('should set "shouldAllowEditingDetails" to false', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.res.callback = () => {
            ctx.res.renderedVariables.shouldAllowEditingDetails.should.equal(
              false
            )
            resolve()
          }
          ctx.UserPagesController.settingsPage(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })
    })
  })
})
