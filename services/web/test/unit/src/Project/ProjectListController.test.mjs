import { expect, vi } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const ObjectId = mongodb.ObjectId

const MODULE_PATH = new URL(
  '../../../../app/src/Features/Project/ProjectListController',
  import.meta.url
).pathname

describe('ProjectListController', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = new ObjectId('abcdefabcdefabcdefabcdef')

    ctx.user = {
      _id: new ObjectId('123456123456123456123456'),
      email: 'test@overleaf.com',
      first_name: 'bjkdsjfk',
      features: {},
      emails: [{ email: 'test@overleaf.com' }],
      lastLoginIp: '111.111.111.112',
    }
    ctx.users = {
      'user-1': {
        first_name: 'James',
      },
      'user-2': {
        first_name: 'Henry',
      },
    }
    ctx.users[ctx.user._id] = ctx.user // Owner
    ctx.usersArr = Object.entries(ctx.users).map(([key, value]) => ({
      _id: key,
      ...value,
    }))
    ctx.tags = [
      { name: 1, project_ids: ['1', '2', '3'] },
      { name: 2, project_ids: ['a', '1'] },
      { name: 3, project_ids: ['a', 'b', 'c', 'd'] },
    ]
    ctx.notifications = [
      {
        _id: '1',
        user_id: '2',
        templateKey: '3',
        messageOpts: '4',
        key: '5',
      },
    ]
    ctx.settings = {
      siteUrl: 'https://overleaf.com',
    }
    ctx.TagsHandler = {
      promises: {
        getAllTags: sinon.stub().resolves(ctx.tags),
      },
    }
    ctx.NotificationsHandler = {
      promises: {
        getUserNotifications: sinon.stub().resolves(ctx.notifications),
      },
    }
    ctx.UserModel = {
      findById: sinon.stub().resolves(ctx.user),
    }
    ctx.UserPrimaryEmailCheckHandler = {
      requiresPrimaryEmailCheck: sinon.stub().returns(false),
    }
    ctx.ProjectGetter = {
      promises: {
        findAllUsersProjects: sinon.stub(),
      },
    }
    ctx.ProjectHelper = {
      isArchived: sinon.stub(),
      isTrashed: sinon.stub(),
    }
    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(ctx.user._id),
    }
    ctx.UserController = {
      logout: sinon.stub(),
    }
    ctx.UserGetter = {
      promises: {
        getUsers: sinon.stub().resolves(ctx.usersArr),
        getUserFullEmails: sinon.stub().resolves([]),
        getWritefullData: sinon.stub().resolves({ isPremium: true }),
      },
    }
    ctx.Features = {
      hasFeature: sinon.stub(),
    }
    ctx.Metrics = {
      inc: sinon.stub(),
    }
    ctx.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
        hasUserBeenAssignedToVariant: sinon.stub().resolves(false),
      },
    }
    ctx.SplitTestSessionHandler = {
      promises: {
        sessionMaintenance: sinon.stub().resolves(),
      },
    }
    ctx.SubscriptionViewModelBuilder = {
      promises: {
        getUsersSubscriptionDetails: sinon.stub().resolves({
          bestSubscription: { type: 'free' },
          individualSubscription: null,
          memberGroupSubscriptions: [],
        }),
      },
    }
    ctx.SurveyHandler = {
      promises: {
        getSurvey: sinon.stub().resolves({}),
      },
    }
    ctx.NotificationBuilder = {
      promises: {
        ipMatcherAffiliation: sinon.stub().returns({ create: sinon.stub() }),
      },
    }
    ctx.GeoIpLookup = {
      promises: {
        getCurrencyCode: sinon.stub().resolves({
          countryCode: 'US',
          currencyCode: 'USD',
        }),
      },
    }
    ctx.TutorialHandler = {
      getInactiveTutorials: sinon.stub().returns([]),
    }

    ctx.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves([]),
        },
      },
    }

    ctx.PermissionsManager = {
      promises: {
        checkUserPermissions: sinon.stub().resolves(true),
      },
    }

    ctx.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves({}),
      },
    }

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.Metrics,
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestSessionHandler',
      () => ({
        default: ctx.SplitTestSessionHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserController', () => ({
      default: ctx.UserController,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectHelper', () => ({
      default: ctx.ProjectHelper,
    }))

    vi.doMock('../../../../app/src/Features/Tags/TagsHandler', () => ({
      default: ctx.TagsHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsHandler',
      () => ({
        default: ctx.NotificationsHandler,
      })
    )

    vi.doMock('../../../../app/src/models/User', () => ({
      User: ctx.UserModel,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: ctx.Features,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionViewModelBuilder',
      () => ({
        default: ctx.SubscriptionViewModelBuilder,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    vi.doMock('../../../../app/src/Features/Survey/SurveyHandler', () => ({
      default: ctx.SurveyHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/User/UserPrimaryEmailCheckHandler',
      () => ({
        default: ctx.UserPrimaryEmailCheckHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsBuilder',
      () => ({
        default: ctx.NotificationBuilder,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/GeoIpLookup', () => ({
      default: ctx.GeoIpLookup,
    }))

    vi.doMock('../../../../app/src/Features/Tutorial/TutorialHandler', () => ({
      default: ctx.TutorialHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authorization/PermissionsManager',
      () => ({
        default: ctx.PermissionsManager,
      })
    )
    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    ctx.ProjectListController = (await import(MODULE_PATH)).default

    ctx.req = {
      query: {},
      params: {
        Project_id: ctx.project_id,
      },
      headers: {},
      session: {
        user: ctx.user,
      },
      body: {},
      i18n: {
        translate() {},
      },
    }
    ctx.res = {}
  })

  describe('projectListPage', function () {
    beforeEach(function (ctx) {
      ctx.projects = [
        { _id: 1, lastUpdated: 1, owner_ref: 'user-1' },
        {
          _id: 2,
          lastUpdated: 2,
          owner_ref: 'user-2',
          lastUpdatedBy: 'user-1',
        },
      ]
      ctx.readAndWrite = [{ _id: 5, lastUpdated: 5, owner_ref: 'user-1' }]
      ctx.readOnly = [{ _id: 3, lastUpdated: 3, owner_ref: 'user-1' }]
      ctx.tokenReadAndWrite = [{ _id: 6, lastUpdated: 5, owner_ref: 'user-4' }]
      ctx.tokenReadOnly = [{ _id: 7, lastUpdated: 4, owner_ref: 'user-5' }]
      ctx.review = [{ _id: 8, lastUpdated: 4, owner_ref: 'user-6' }]
      ctx.allProjects = {
        owned: ctx.projects,
        readAndWrite: ctx.readAndWrite,
        readOnly: ctx.readOnly,
        tokenReadAndWrite: ctx.tokenReadAndWrite,
        tokenReadOnly: ctx.tokenReadOnly,
        review: ctx.review,
      }

      ctx.ProjectGetter.promises.findAllUsersProjects.resolves(ctx.allProjects)
    })

    it('should render the project/list-react page', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          pageName.should.equal('project/list-react')
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    it('should invoke the session maintenance', async function (ctx) {
      await new Promise(resolve => {
        ctx.Features.hasFeature.withArgs('saas').returns(true)
        ctx.res.render = () => {
          ctx.SplitTestSessionHandler.promises.sessionMaintenance.should.have.been.calledWith(
            ctx.req,
            ctx.user
          )
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    it('should send the tags', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          opts.tags.length.should.equal(ctx.tags.length)
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    it('should create trigger ip matcher notifications', async function (ctx) {
      await new Promise(resolve => {
        ctx.settings.overleaf = true
        ctx.req.ip = '111.111.111.111'
        ctx.res.render = (pageName, opts) => {
          ctx.NotificationBuilder.promises.ipMatcherAffiliation.called.should.equal(
            true
          )
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    it('should send the projects', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          opts.prefetchedProjectsBlob.projects.length.should.equal(
            ctx.projects.length +
              ctx.readAndWrite.length +
              ctx.readOnly.length +
              ctx.tokenReadAndWrite.length +
              ctx.tokenReadOnly.length +
              ctx.review.length
          )
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    it('should send the user', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          opts.user.should.deep.equal(ctx.user)
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    it('should inject the users', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          const projects = opts.prefetchedProjectsBlob.projects

          projects
            .filter(p => p.id === '1')[0]
            .owner.firstName.should.equal(
              ctx.users[ctx.projects.filter(p => p._id === 1)[0].owner_ref]
                .first_name
            )
          projects
            .filter(p => p.id === '2')[0]
            .owner.firstName.should.equal(
              ctx.users[ctx.projects.filter(p => p._id === 2)[0].owner_ref]
                .first_name
            )
          projects
            .filter(p => p.id === '2')[0]
            .lastUpdatedBy.firstName.should.equal(
              ctx.users[ctx.projects.filter(p => p._id === 2)[0].lastUpdatedBy]
                .first_name
            )
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    it("should send the user's best subscription when saas feature present", async function (ctx) {
      await new Promise(resolve => {
        ctx.Features.hasFeature.withArgs('saas').returns(true)
        ctx.res.render = (pageName, opts) => {
          expect(opts.usersBestSubscription).to.deep.include({ type: 'free' })
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    it('should not return a best subscription without saas feature', async function (ctx) {
      await new Promise(resolve => {
        ctx.Features.hasFeature.withArgs('saas').returns(false)
        ctx.res.render = (pageName, opts) => {
          expect(opts.usersBestSubscription).to.be.undefined
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    it('should show INR Banner for Indian users with free account', async function (ctx) {
      await new Promise(resolve => {
        // usersBestSubscription is only available when saas feature is present
        ctx.Features.hasFeature.withArgs('saas').returns(true)
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: {
              type: 'free',
            },
          }
        )
        ctx.GeoIpLookup.promises.getCurrencyCode.resolves({
          countryCode: 'IN',
        })
        ctx.res.render = (pageName, opts) => {
          expect(opts.showInrGeoBanner).to.be.true
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    it('should not show INR Banner for Indian users with premium account', async function (ctx) {
      await new Promise(resolve => {
        // usersBestSubscription is only available when saas feature is present
        ctx.Features.hasFeature.withArgs('saas').returns(true)
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          {
            bestSubscription: {
              type: 'individual',
            },
          }
        )
        ctx.GeoIpLookup.promises.getCurrencyCode.resolves({
          countryCode: 'IN',
        })
        ctx.res.render = (pageName, opts) => {
          expect(opts.showInrGeoBanner).to.be.false
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    describe('With Institution SSO feature', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.institutionEmail = 'test@overleaf.com'
          ctx.institutionName = 'Overleaf'
          ctx.Features.hasFeature.withArgs('saml').returns(true)
          ctx.Features.hasFeature.withArgs('affiliations').returns(true)
          ctx.Features.hasFeature.withArgs('saas').returns(true)
          resolve()
        })
      })
      it('should show institution SSO available notification for confirmed domains', function (ctx) {
        ctx.UserGetter.promises.getUserFullEmails.resolves([
          {
            email: 'test@overleaf.com',
            affiliation: {
              institution: {
                id: 1,
                confirmed: true,
                name: 'Overleaf',
                ssoBeta: false,
                ssoEnabled: true,
              },
            },
          },
        ])
        ctx.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.include({
            email: ctx.institutionEmail,
            institutionId: 1,
            institutionName: ctx.institutionName,
            templateKey: 'notification_institution_sso_available',
          })
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
      it('should show a linked notification', function (ctx) {
        ctx.req.session.saml = {
          institutionEmail: ctx.institutionEmail,
          linked: {
            hasEntitlement: false,
            universityName: ctx.institutionName,
          },
        }
        ctx.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.include({
            email: ctx.institutionEmail,
            institutionName: ctx.institutionName,
            templateKey: 'notification_institution_sso_linked',
          })
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
      it('should show a linked another email notification', function (ctx) {
        // when they request to link an email but the institution returns
        // a different email
        ctx.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.include({
            institutionEmail: ctx.institutionEmail,
            requestedEmail: 'requested@overleaf.com',
            templateKey: 'notification_institution_sso_non_canonical',
          })
        }
        ctx.req.session.saml = {
          emailNonCanonical: ctx.institutionEmail,
          institutionEmail: ctx.institutionEmail,
          requestedEmail: 'requested@overleaf.com',
          linked: {
            hasEntitlement: false,
            universityName: ctx.institutionName,
          },
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })

      it('should show a notification when intent was to register via SSO but account existed', function (ctx) {
        ctx.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.include({
            email: ctx.institutionEmail,
            templateKey: 'notification_institution_sso_already_registered',
          })
        }
        ctx.req.session.saml = {
          institutionEmail: ctx.institutionEmail,
          linked: {
            hasEntitlement: false,
            universityName: 'Overleaf',
          },
          registerIntercept: {
            id: 1,
            name: 'Example University',
          },
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })

      it('should not show a register notification if the flow was abandoned', function (ctx) {
        // could initially start to register with an SSO email and then
        // abandon flow and login with an existing non-institution SSO email
        ctx.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.not.include({
            email: 'test@overleaf.com',
            templateKey: 'notification_institution_sso_already_registered',
          })
        }
        ctx.req.session.saml = {
          registerIntercept: {
            id: 1,
            name: 'Example University',
          },
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })

      it('should show error notification', function (ctx) {
        ctx.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution.length).to.equal(1)
          expect(opts.notificationsInstitution[0].templateKey).to.equal(
            'notification_institution_sso_error'
          )
          expect(opts.notificationsInstitution[0].error).to.be.instanceof(
            Errors.SAMLAlreadyLinkedError
          )
        }
        ctx.req.session.saml = {
          institutionEmail: ctx.institutionEmail,
          error: new Errors.SAMLAlreadyLinkedError(),
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })

      describe('for an unconfirmed domain for an SSO institution', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.UserGetter.promises.getUserFullEmails.resolves([
              {
                email: 'test@overleaf-uncofirmed.com',
                affiliation: {
                  institution: {
                    id: 1,
                    confirmed: false,
                    name: 'Overleaf',
                    ssoBeta: false,
                    ssoEnabled: true,
                  },
                },
              },
            ])
            resolve()
          })
        })
        it('should not show institution SSO available notification', function (ctx) {
          ctx.res.render = (pageName, opts) => {
            expect(opts.notificationsInstitution.length).to.equal(0)
          }
          ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
      })
      describe('when linking/logging in initiated on institution side', function () {
        it('should not show a linked another email notification', function (ctx) {
          // this is only used when initated on Overleaf,
          // because we keep track of the requested email they tried to link
          ctx.res.render = (pageName, opts) => {
            expect(opts.notificationsInstitution).to.not.deep.include({
              institutionEmail: ctx.institutionEmail,
              requestedEmail: undefined,
              templateKey: 'notification_institution_sso_non_canonical',
            })
          }
          ctx.req.session.saml = {
            emailNonCanonical: ctx.institutionEmail,
            institutionEmail: ctx.institutionEmail,
            linked: {
              hasEntitlement: false,
              universityName: ctx.institutionName,
            },
          }
          ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
      })
      describe('Institution with SSO beta testable', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.UserGetter.promises.getUserFullEmails.resolves([
              {
                email: 'beta@beta.com',
                affiliation: {
                  institution: {
                    id: 2,
                    confirmed: true,
                    name: 'Beta University',
                    ssoBeta: true,
                    ssoEnabled: false,
                  },
                },
              },
            ])
            resolve()
          })
        })
        it('should show institution SSO available notification when on a beta testing session', function (ctx) {
          ctx.req.session.samlBeta = true
          ctx.res.render = (pageName, opts) => {
            expect(opts.notificationsInstitution).to.deep.include({
              email: 'beta@beta.com',
              institutionId: 2,
              institutionName: 'Beta University',
              templateKey: 'notification_institution_sso_available',
            })
          }
          ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
        it('should not show institution SSO available notification when not on a beta testing session', function (ctx) {
          ctx.req.session.samlBeta = false
          ctx.res.render = (pageName, opts) => {
            expect(opts.notificationsInstitution).to.deep.not.include({
              email: 'test@overleaf.com',
              institutionId: 1,
              institutionName: 'Overleaf',
              templateKey: 'notification_institution_sso_available',
            })
          }
          ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
      })
    })

    describe('Without Institution SSO feature', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.Features.hasFeature.withArgs('saml').returns(false)
          resolve()
        })
      })
      it('should not show institution sso available notification', function (ctx) {
        ctx.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.not.include({
            email: 'test@overleaf.com',
            institutionId: 1,
            institutionName: 'Overleaf',
            templateKey: 'notification_institution_sso_available',
          })
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    describe('enterprise banner', function () {
      beforeEach(function (ctx) {
        ctx.Features.hasFeature.withArgs('saas').returns(true)
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          { memberGroupSubscriptions: [] }
        )
        ctx.UserGetter.promises.getUserFullEmails.resolves([
          {
            email: 'test@test-domain.com',
          },
        ])
      })

      describe('normal enterprise banner', function () {
        it('shows banner', function (ctx) {
          ctx.res.render = (pageName, opts) => {
            expect(opts.showGroupsAndEnterpriseBanner).to.be.true
          }
          ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })

        it('does not show banner if user is part of any affiliation', function (ctx) {
          ctx.UserGetter.promises.getUserFullEmails.resolves([
            {
              email: 'test@overleaf.com',
              affiliation: {
                licence: 'pro_plus',
                institution: {
                  id: 1,
                  confirmed: true,
                  name: 'Overleaf',
                  ssoBeta: false,
                  ssoEnabled: true,
                },
              },
            },
          ])

          ctx.res.render = (pageName, opts) => {
            expect(opts.showGroupsAndEnterpriseBanner).to.be.false
          }
          ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })

        it('does not show banner if user is part of any group subscription', function (ctx) {
          ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
            { memberGroupSubscriptions: [{}] }
          )

          ctx.res.render = (pageName, opts) => {
            expect(opts.showGroupsAndEnterpriseBanner).to.be.false
          }
          ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })

        it('have a banner variant of "FOMO" or "on-premise"', function (ctx) {
          ctx.res.render = (pageName, opts) => {
            expect(opts.groupsAndEnterpriseBannerVariant).to.be.oneOf([
              'FOMO',
              'on-premise',
            ])
          }
          ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
      })

      describe('US government enterprise banner', function () {
        it('does not show enterprise banner if US government enterprise banner is shown', function (ctx) {
          const emails = [
            {
              email: 'test@test.mil',
              confirmedAt: new Date('2024-01-01'),
            },
          ]

          ctx.UserGetter.promises.getUserFullEmails.resolves(emails)
          ctx.Modules.promises.hooks.fire
            .withArgs('getUSGovBanner', emails, false, [])
            .resolves([
              {
                showUSGovBanner: true,
                usGovBannerVariant: 'variant',
              },
            ])
          ctx.res.render = (pageName, opts) => {
            expect(opts.showGroupsAndEnterpriseBanner).to.be.false
            expect(opts.showUSGovBanner).to.be.true
          }
          ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
      })
    })
  })

  describe('projectListReactPage with duplicate projects', function () {
    beforeEach(function (ctx) {
      ctx.projects = [
        { _id: 1, lastUpdated: 1, owner_ref: 'user-1' },
        { _id: 2, lastUpdated: 2, owner_ref: 'user-2' },
      ]
      ctx.readAndWrite = [{ _id: 5, lastUpdated: 5, owner_ref: 'user-1' }]
      ctx.readOnly = [{ _id: 3, lastUpdated: 3, owner_ref: 'user-1' }]
      ctx.tokenReadAndWrite = [{ _id: 6, lastUpdated: 5, owner_ref: 'user-4' }]
      ctx.tokenReadOnly = [
        { _id: 6, lastUpdated: 5, owner_ref: 'user-4' }, // Also in tokenReadAndWrite
        { _id: 7, lastUpdated: 4, owner_ref: 'user-5' },
      ]
      ctx.review = [{ _id: 8, lastUpdated: 5, owner_ref: 'user-6' }]
      ctx.allProjects = {
        owned: ctx.projects,
        readAndWrite: ctx.readAndWrite,
        readOnly: ctx.readOnly,
        tokenReadAndWrite: ctx.tokenReadAndWrite,
        tokenReadOnly: ctx.tokenReadOnly,
        review: ctx.review,
      }

      ctx.ProjectGetter.promises.findAllUsersProjects.resolves(ctx.allProjects)
    })

    it('should render the project/list-react page', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          pageName.should.equal('project/list-react')
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    it('should omit one of the projects', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          opts.prefetchedProjectsBlob.projects.length.should.equal(
            ctx.projects.length +
              ctx.readAndWrite.length +
              ctx.readOnly.length +
              ctx.tokenReadAndWrite.length +
              ctx.tokenReadOnly.length +
              ctx.review.length -
              1
          )
          resolve()
        }
        ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })
  })
})
