import { beforeEach, describe, it, expect, vi } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import Settings from '@overleaf/settings'

const ObjectId = mongodb.ObjectId

const MODULE_PATH = `${import.meta.dirname}/../../../../app/src/Features/Project/ProjectListController`

// Mock AnalyticsManager as it isn't used in these tests but causes the User model to be imported and redeclares queues
vi.mock('../../../../app/src/Features/Analytics/AnalyticsManager.mjs', () => {
  return {}
})

describe('ProjectListController', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = new ObjectId('abcdefabcdefabcdefabcdef')

    ctx.user = {
      _id: new ObjectId('123456123456123456123456'),
      email: 'test@overleaf.com',
      first_name: 'bjkdsjfk',
      features: {},
      emails: [{ email: 'test@overleaf.com' }],
      lastActive: new Date(2),
      signUpDate: new Date(1),
      lastLoginIp: '111.111.111.112',
      ace: {
        syntaxValidation: true,
        pdfViewer: 'pdfjs',
        spellCheckLanguage: 'en',
        autoPairDelimiters: true,
        autoComplete: true,
        fontSize: 12,
        theme: 'textmate',
        mode: 'none',
      },
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
      ...Settings,
      siteUrl: 'https://overleaf.com',
    }
    ctx.onboardingDataCollection = {
      companyDivisionDepartment: '',
      companyJobTitle: '',
      firstName: 'Dos',
      governmentJobTitle: '',
      institutionName: '',
      lastName: 'Mukasan',
      nonprofitDivisionDepartment: '',
      nonprofitJobTitle: '',
      otherJobTitle: '',
      primaryOccupation: 'company',
      role: 'conductor',
      subjectArea: 'music',
      updatedAt: '2025-09-04T12:12:21.628Z',
      usedLatex: 'occasionally',
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
    ctx.OnboardingDataCollectionModel = {
      findById: sinon.stub().resolves(ctx.onboardingDataCollection),
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
          managedGroupSubscriptions: [],
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

    vi.doMock('../../../../app/src/models/OnboardingDataCollection', () => ({
      OnboardingDataCollection: ctx.OnboardingDataCollectionModel,
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
        { _id: 1, lastUpdated: new Date(1), owner_ref: 'user-1' },
        {
          _id: 2,
          lastUpdated: new Date(2),
          owner_ref: 'user-2',
          lastUpdatedBy: 'user-1',
        },
      ]
      ctx.readAndWrite = [
        { _id: 5, lastUpdated: new Date(5), owner_ref: 'user-1' },
      ]
      ctx.readOnly = [{ _id: 3, lastUpdated: new Date(3), owner_ref: 'user-1' }]
      ctx.tokenReadAndWrite = [
        { _id: 6, lastUpdated: new Date(5), owner_ref: 'user-4' },
      ]
      ctx.tokenReadOnly = [
        { _id: 7, lastUpdated: new Date(4), owner_ref: 'user-5' },
      ]
      ctx.review = [{ _id: 8, lastUpdated: new Date(4), owner_ref: 'user-6' }]
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
      ctx.res.render = (pageName, opts) => {
        pageName.should.equal('project/list-react')
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    it('should invoke the session maintenance', async function (ctx) {
      ctx.Features.hasFeature.withArgs('saas').returns(true)
      ctx.res.render = () => {
        ctx.SplitTestSessionHandler.promises.sessionMaintenance.should.have.been.calledWith(
          ctx.req,
          ctx.user
        )
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    it('should send the tags', async function (ctx) {
      ctx.res.render = (pageName, opts) => {
        opts.tags.length.should.equal(ctx.tags.length)
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    it('should create trigger ip matcher notifications', async function (ctx) {
      ctx.settings.overleaf = true
      ctx.req.ip = '111.111.111.111'
      ctx.res.render = (pageName, opts) => {
        ctx.NotificationBuilder.promises.ipMatcherAffiliation.called.should.equal(
          true
        )
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    it('should send the projects', async function (ctx) {
      ctx.res.render = (pageName, opts) => {
        opts.prefetchedProjectsBlob.projects.length.should.equal(
          ctx.projects.length +
            ctx.readAndWrite.length +
            ctx.readOnly.length +
            ctx.tokenReadAndWrite.length +
            ctx.tokenReadOnly.length +
            ctx.review.length
        )
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    it('should send the user', async function (ctx) {
      ctx.res.render = (pageName, opts) => {
        opts.user.should.deep.equal(ctx.user)
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    it('should inject the users', async function (ctx) {
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
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    it("should send the user's best subscription when saas feature present", async function (ctx) {
      ctx.Features.hasFeature.withArgs('saas').returns(true)
      ctx.res.render = (pageName, opts) => {
        expect(opts.usersBestSubscription).to.deep.include({ type: 'free' })
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    it('should not return a best subscription without saas feature', async function (ctx) {
      ctx.Features.hasFeature.withArgs('saas').returns(false)
      ctx.res.render = (pageName, opts) => {
        expect(opts.usersBestSubscription).to.be.undefined
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    it('should show INR Banner for Indian users with free account', async function (ctx) {
      // usersBestSubscription is only available when saas feature is present
      ctx.Features.hasFeature.withArgs('saas').returns(true)
      ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
        {
          memberGroupSubscriptions: [],
          managedGroupSubscriptions: [],
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
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    it('should not show INR Banner for Indian users with premium account', async function (ctx) {
      // usersBestSubscription is only available when saas feature is present
      ctx.Features.hasFeature.withArgs('saas').returns(true)
      ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
        {
          memberGroupSubscriptions: [],
          managedGroupSubscriptions: [],
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
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    it('should redirect to domain capture page', async function (ctx) {
      ctx.Features.hasFeature.withArgs('saas').returns(true)
      ctx.SplitTestHandler.promises.getAssignment
        .withArgs(ctx.req, ctx.res, 'domain-capture-redirect')
        .resolves({ variant: 'enabled' })
      ctx.Modules.promises.hooks.fire
        .withArgs('findDomainCaptureGroupUserCouldBePartOf', ctx.user._id)
        .resolves([{ _id: new ObjectId(), managedUsersEnabled: true }])
      ctx.res.redirect = url => {
        url.should.equal('/domain-capture')
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    describe('when user linked to SSO', function () {
      const linkedEmail = 'picard@starfleet.com'
      const universityName = 'Starfleet'
      const notificationData = {
        email: linkedEmail,
        institutionName: universityName,
      }
      beforeEach(function (ctx) {
        ctx.Features.hasFeature.withArgs('saml').returns(true)
        ctx.req.session.saml = {
          institutionEmail: linkedEmail,
          linked: {
            universityName,
          },
        }
      })

      it('should render with Commons template when Commons was linked', async function (ctx) {
        ctx.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.equal([
            Object.assign(
              { templateKey: 'notification_institution_sso_linked' },
              notificationData
            ),
          ])
        }
        await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })

      describe('when via domain capture', function () {
        beforeEach(function (ctx) {
          ctx.req.session.saml.domainCaptureEnabled = true
        })

        it('should render with group template', async function (ctx) {
          ctx.res.render = (pageName, opts) => {
            expect(opts.notificationsInstitution).to.deep.equal([
              Object.assign(
                { templateKey: 'notification_group_sso_linked' },
                notificationData
              ),
            ])
          }
          await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })

        describe('user created via domain capture and group is managed', function () {
          beforeEach(function (ctx) {
            ctx.req.session.saml.userCreatedViaDomainCapture = true
          })
          it('should render with notification_group_sso_linked', async function (ctx) {
            ctx.res.render = (pageName, opts) => {
              expect(opts.notificationsInstitution).to.deep.equal([
                Object.assign(
                  {
                    templateKey: 'notification_group_sso_linked',
                  },
                  notificationData
                ),
              ])
            }
            await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
          })

          it('should render with notification_account_created_via_group_domain_capture_and_managed_users_enabled when managed user is enabled', async function (ctx) {
            ctx.req.session.saml.managedUsersEnabled = true
            ctx.res.render = (pageName, opts) => {
              expect(opts.notificationsInstitution).to.deep.equal([
                Object.assign(
                  {
                    templateKey:
                      'notification_account_created_via_group_domain_capture_and_managed_users_enabled',
                  },
                  notificationData
                ),
              ])
            }
            await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
          })
        })
      })
    })

    describe('With Institution SSO feature', function () {
      beforeEach(function (ctx) {
        ctx.institutionEmail = 'test@overleaf.com'
        ctx.institutionName = 'Overleaf'
        ctx.Features.hasFeature.withArgs('saml').returns(true)
        ctx.Features.hasFeature.withArgs('affiliations').returns(true)
        ctx.Features.hasFeature.withArgs('saas').returns(true)
      })
      it('should show institution SSO available notification for confirmed domains', async function (ctx) {
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
        await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
      it('should show a linked notification', async function (ctx) {
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
        await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
      it('should show a group linked notification when domain capture enabled', async function (ctx) {
        ctx.req.session.saml = {
          institutionEmail: ctx.institutionEmail,
          linked: {
            hasEntitlement: false,
            universityName: ctx.institutionName,
          },
          domainCaptureEnabled: true,
        }
        ctx.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.include({
            email: ctx.institutionEmail,
            institutionName: ctx.institutionName,
            templateKey: 'notification_group_sso_linked',
          })
        }
        await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
      it('should show a success notification when joining group via domain capture page', async function (ctx) {
        ctx.req.session.saml = {
          linkedGroup: true,
          universityName: ctx.institutionName,
          domainCaptureJoin: true,
        }
        ctx.res.render = (pageName, opts) => {
          expect(opts).to.deep.include({
            groupSsoSetupSuccess: true,
            joinedGroupName: ctx.institutionName,
            viaDomainCapture: true,
          })
        }
        await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
      it('should show a linked another email notification', async function (ctx) {
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
        await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })

      it('should show a notification when intent was to register via SSO but account existed', async function (ctx) {
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
        await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })

      it('should not show a register notification if the flow was abandoned', async function (ctx) {
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
        await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })

      it('should show error notification', async function (ctx) {
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
        await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })

      describe('for an unconfirmed domain for an SSO institution', function () {
        beforeEach(function (ctx) {
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
        })
        it('should not show institution SSO available notification', async function (ctx) {
          ctx.res.render = (pageName, opts) => {
            expect(opts.notificationsInstitution.length).to.equal(0)
          }
          await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
      })
      describe('when linking/logging in initiated on institution side', function () {
        it('should not show a linked another email notification', async function (ctx) {
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
          await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
      })
      describe('Institution with SSO beta testable', function () {
        beforeEach(function (ctx) {
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
        })
        it('should show institution SSO available notification when on a beta testing session', async function (ctx) {
          ctx.req.session.samlBeta = true
          ctx.res.render = (pageName, opts) => {
            expect(opts.notificationsInstitution).to.deep.include({
              email: 'beta@beta.com',
              institutionId: 2,
              institutionName: 'Beta University',
              templateKey: 'notification_institution_sso_available',
            })
          }
          await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
        it('should not show institution SSO available notification when not on a beta testing session', async function (ctx) {
          ctx.req.session.samlBeta = false
          ctx.res.render = (pageName, opts) => {
            expect(opts.notificationsInstitution).to.deep.not.include({
              email: 'test@overleaf.com',
              institutionId: 1,
              institutionName: 'Overleaf',
              templateKey: 'notification_institution_sso_available',
            })
          }
          await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
      })
      describe('group domain capture enabled for domain', function () {
        it('does not show institution SSO available notification', async function (ctx) {
          ctx.UserGetter.promises.getUserFullEmails.resolves([
            {
              email: 'test@overleaf.com',
              affiliation: {
                group: { domainCaptureEnabled: true },
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
            expect(opts.notificationsInstitution).to.deep.equal([])
          }
          await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
      })
    })

    describe('Without Institution SSO feature', function () {
      beforeEach(function (ctx) {
        ctx.Features.hasFeature.withArgs('saml').returns(false)
      })
      it('should not show institution sso available notification', async function (ctx) {
        ctx.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.not.include({
            email: 'test@overleaf.com',
            institutionId: 1,
            institutionName: 'Overleaf',
            templateKey: 'notification_institution_sso_available',
          })
        }
        await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
      })
    })

    describe('enterprise banner', function () {
      beforeEach(function (ctx) {
        ctx.Features.hasFeature.withArgs('saas').returns(true)
        ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
          { memberGroupSubscriptions: [], managedGroupSubscriptions: [] }
        )
        ctx.UserGetter.promises.getUserFullEmails.resolves([
          {
            email: 'test@test-domain.com',
          },
        ])
      })

      describe('normal enterprise banner', function () {
        it('shows banner', async function (ctx) {
          ctx.res.render = (pageName, opts) => {
            expect(opts.showGroupsAndEnterpriseBanner).to.be.true
          }
          await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })

        it('does not show banner if user is part of any affiliation', async function (ctx) {
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
          await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })

        it('does not show banner if user is part of any group subscription', async function (ctx) {
          ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails.resolves(
            { memberGroupSubscriptions: [{}] }
          )

          ctx.res.render = (pageName, opts) => {
            expect(opts.showGroupsAndEnterpriseBanner).to.be.false
          }
          await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })

        it('have a banner variant of "FOMO" or "on-premise"', async function (ctx) {
          ctx.res.render = (pageName, opts) => {
            expect(opts.groupsAndEnterpriseBannerVariant).to.be.oneOf([
              'FOMO',
              'on-premise',
            ])
          }
          await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
      })

      describe('US government enterprise banner', function () {
        it('does not show enterprise banner if US government enterprise banner is shown', async function (ctx) {
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
          await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
        })
      })
    })
  })

  describe('projectListReactPage with duplicate projects', function () {
    beforeEach(function (ctx) {
      ctx.projects = [
        { _id: 1, lastUpdated: new Date(1), owner_ref: 'user-1' },
        { _id: 2, lastUpdated: new Date(2), owner_ref: 'user-2' },
      ]
      ctx.readAndWrite = [
        { _id: 5, lastUpdated: new Date(5), owner_ref: 'user-1' },
      ]
      ctx.readOnly = [{ _id: 3, lastUpdated: new Date(3), owner_ref: 'user-1' }]
      ctx.tokenReadAndWrite = [
        { _id: 6, lastUpdated: new Date(5), owner_ref: 'user-4' },
      ]
      ctx.tokenReadOnly = [
        { _id: 6, lastUpdated: new Date(5), owner_ref: 'user-4' }, // Also in tokenReadAndWrite
        { _id: 7, lastUpdated: new Date(4), owner_ref: 'user-5' },
      ]
      ctx.review = [{ _id: 8, lastUpdated: new Date(5), owner_ref: 'user-6' }]
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
      ctx.res.render = (pageName, opts) => {
        pageName.should.equal('project/list-react')
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })

    it('should omit one of the projects', async function (ctx) {
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
      }
      await ctx.ProjectListController.projectListPage(ctx.req, ctx.res)
    })
  })
})
