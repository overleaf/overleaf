import esmock from 'esmock'
import sinon from 'sinon'
import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const ObjectId = mongodb.ObjectId

const MODULE_PATH = new URL(
  '../../../../app/src/Features/Project/ProjectListController',
  import.meta.url
).pathname

describe('ProjectListController', function () {
  beforeEach(async function () {
    this.project_id = new ObjectId('abcdefabcdefabcdefabcdef')

    this.user = {
      _id: new ObjectId('123456123456123456123456'),
      email: 'test@overleaf.com',
      first_name: 'bjkdsjfk',
      features: {},
      emails: [{ email: 'test@overleaf.com' }],
      lastLoginIp: '111.111.111.112',
    }
    this.users = {
      'user-1': {
        first_name: 'James',
      },
      'user-2': {
        first_name: 'Henry',
      },
    }
    this.users[this.user._id] = this.user // Owner
    this.usersArr = Object.entries(this.users).map(([key, value]) => ({
      _id: key,
      ...value,
    }))
    this.tags = [
      { name: 1, project_ids: ['1', '2', '3'] },
      { name: 2, project_ids: ['a', '1'] },
      { name: 3, project_ids: ['a', 'b', 'c', 'd'] },
    ]
    this.notifications = [
      {
        _id: '1',
        user_id: '2',
        templateKey: '3',
        messageOpts: '4',
        key: '5',
      },
    ]
    this.settings = {
      siteUrl: 'https://overleaf.com',
    }
    this.LimitationsManager = {
      promises: {
        userIsMemberOfGroupSubscription: sinon.stub().resolves(false),
      },
    }
    this.TagsHandler = {
      promises: {
        getAllTags: sinon.stub().resolves(this.tags),
      },
    }
    this.NotificationsHandler = {
      promises: {
        getUserNotifications: sinon.stub().resolves(this.notifications),
      },
    }
    this.UserModel = {
      findById: sinon.stub().resolves(this.user),
    }
    this.UserPrimaryEmailCheckHandler = {
      requiresPrimaryEmailCheck: sinon.stub().returns(false),
    }
    this.ProjectGetter = {
      promises: {
        findAllUsersProjects: sinon.stub(),
      },
    }
    this.ProjectHelper = {
      isArchived: sinon.stub(),
      isTrashed: sinon.stub(),
    }
    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(this.user._id),
    }
    this.UserController = {
      logout: sinon.stub(),
    }
    this.UserGetter = {
      promises: {
        getUsers: sinon.stub().resolves(this.usersArr),
        getUserFullEmails: sinon.stub().resolves([]),
      },
    }
    this.Features = {
      hasFeature: sinon.stub(),
    }
    this.Metrics = {
      inc: sinon.stub(),
    }
    this.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
      },
    }
    this.SplitTestSessionHandler = {
      promises: {
        sessionMaintenance: sinon.stub().resolves(),
      },
    }
    this.SubscriptionViewModelBuilder = {
      promises: {
        getBestSubscription: sinon.stub().resolves({ type: 'free' }),
      },
    }
    this.SurveyHandler = {
      promises: {
        getSurvey: sinon.stub().resolves({}),
      },
    }
    this.NotificationBuilder = {
      promises: {
        ipMatcherAffiliation: sinon.stub().returns({ create: sinon.stub() }),
      },
    }
    this.SubscriptionLocator = {
      promises: {
        getUserSubscription: sinon.stub().resolves({}),
      },
    }
    this.GeoIpLookup = {
      promises: {
        getCurrencyCode: sinon.stub().resolves({
          countryCode: 'US',
          currencyCode: 'USD',
        }),
      },
    }
    this.TutorialHandler = {
      getInactiveTutorials: sinon.stub().returns([]),
    }

    this.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves([]),
        },
      },
    }

    this.ProjectListController = await esmock.strict(MODULE_PATH, {
      'mongodb-legacy': { ObjectId },
      '@overleaf/settings': this.settings,
      '@overleaf/metrics': this.Metrics,
      '../../../../app/src/Features/SplitTests/SplitTestHandler':
        this.SplitTestHandler,
      '../../../../app/src/Features/SplitTests/SplitTestSessionHandler':
        this.SplitTestSessionHandler,
      '../../../../app/src/Features/User/UserController': this.UserController,
      '../../../../app/src/Features/Project/ProjectHelper': this.ProjectHelper,
      '../../../../app/src/Features/Subscription/LimitationsManager':
        this.LimitationsManager,
      '../../../../app/src/Features/Tags/TagsHandler': this.TagsHandler,
      '../../../../app/src/Features/Notifications/NotificationsHandler':
        this.NotificationsHandler,
      '../../../../app/src/models/User': { User: this.UserModel },
      '../../../../app/src/Features/Project/ProjectGetter': this.ProjectGetter,
      '../../../../app/src/Features/Authentication/SessionManager':
        this.SessionManager,
      '../../../../app/src/infrastructure/Features': this.Features,
      '../../../../app/src/Features/User/UserGetter': this.UserGetter,
      '../../../../app/src/Features/Subscription/SubscriptionViewModelBuilder':
        this.SubscriptionViewModelBuilder,
      '../../../../app/src/infrastructure/Modules': this.Modules,
      '../../../../app/src/Features/Survey/SurveyHandler': this.SurveyHandler,
      '../../../../app/src/Features/User/UserPrimaryEmailCheckHandler':
        this.UserPrimaryEmailCheckHandler,
      '../../../../app/src/Features/Notifications/NotificationsBuilder':
        this.NotificationBuilder,
      '../../../../app/src/Features/Subscription/SubscriptionLocator':
        this.SubscriptionLocator,
      '../../../../app/src/infrastructure/GeoIpLookup': this.GeoIpLookup,
      '../../../../app/src/Features/Tutorial/TutorialHandler':
        this.TutorialHandler,
    })

    this.req = {
      query: {},
      params: {
        Project_id: this.project_id,
      },
      headers: {},
      session: {
        user: this.user,
      },
      body: {},
      i18n: {
        translate() {},
      },
    }
    this.res = {}
  })

  describe('projectListPage', function () {
    beforeEach(function () {
      this.projects = [
        { _id: 1, lastUpdated: 1, owner_ref: 'user-1' },
        {
          _id: 2,
          lastUpdated: 2,
          owner_ref: 'user-2',
          lastUpdatedBy: 'user-1',
        },
      ]
      this.readAndWrite = [{ _id: 5, lastUpdated: 5, owner_ref: 'user-1' }]
      this.readOnly = [{ _id: 3, lastUpdated: 3, owner_ref: 'user-1' }]
      this.tokenReadAndWrite = [{ _id: 6, lastUpdated: 5, owner_ref: 'user-4' }]
      this.tokenReadOnly = [{ _id: 7, lastUpdated: 4, owner_ref: 'user-5' }]
      this.review = [{ _id: 8, lastUpdated: 4, owner_ref: 'user-6' }]
      this.allProjects = {
        owned: this.projects,
        readAndWrite: this.readAndWrite,
        readOnly: this.readOnly,
        tokenReadAndWrite: this.tokenReadAndWrite,
        tokenReadOnly: this.tokenReadOnly,
        review: this.review,
      }

      this.ProjectGetter.promises.findAllUsersProjects.resolves(
        this.allProjects
      )
    })

    it('should render the project/list-react page', function (done) {
      this.res.render = (pageName, opts) => {
        pageName.should.equal('project/list-react')
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })

    it('should invoke the session maintenance', function (done) {
      this.Features.hasFeature.withArgs('saas').returns(true)
      this.res.render = () => {
        this.SplitTestSessionHandler.promises.sessionMaintenance.should.have.been.calledWith(
          this.req,
          this.user
        )
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })

    it('should send the tags', function (done) {
      this.res.render = (pageName, opts) => {
        opts.tags.length.should.equal(this.tags.length)
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })

    it('should create trigger ip matcher notifications', function (done) {
      this.settings.overleaf = true
      this.req.ip = '111.111.111.111'
      this.res.render = (pageName, opts) => {
        this.NotificationBuilder.promises.ipMatcherAffiliation.called.should.equal(
          true
        )
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })

    it('should send the projects', function (done) {
      this.res.render = (pageName, opts) => {
        opts.prefetchedProjectsBlob.projects.length.should.equal(
          this.projects.length +
            this.readAndWrite.length +
            this.readOnly.length +
            this.tokenReadAndWrite.length +
            this.tokenReadOnly.length +
            this.review.length
        )
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })

    it('should send the user', function (done) {
      this.res.render = (pageName, opts) => {
        opts.user.should.deep.equal(this.user)
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })

    it('should inject the users', function (done) {
      this.res.render = (pageName, opts) => {
        const projects = opts.prefetchedProjectsBlob.projects

        projects
          .filter(p => p.id === '1')[0]
          .owner.firstName.should.equal(
            this.users[this.projects.filter(p => p._id === 1)[0].owner_ref]
              .first_name
          )
        projects
          .filter(p => p.id === '2')[0]
          .owner.firstName.should.equal(
            this.users[this.projects.filter(p => p._id === 2)[0].owner_ref]
              .first_name
          )
        projects
          .filter(p => p.id === '2')[0]
          .lastUpdatedBy.firstName.should.equal(
            this.users[this.projects.filter(p => p._id === 2)[0].lastUpdatedBy]
              .first_name
          )
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })

    it("should send the user's best subscription when saas feature present", function (done) {
      this.Features.hasFeature.withArgs('saas').returns(true)
      this.res.render = (pageName, opts) => {
        expect(opts.usersBestSubscription).to.deep.include({ type: 'free' })
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })

    it('should not return a best subscription without saas feature', function (done) {
      this.Features.hasFeature.withArgs('saas').returns(false)
      this.res.render = (pageName, opts) => {
        expect(opts.usersBestSubscription).to.be.undefined
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })

    it('should show INR Banner for Indian users with free account', function (done) {
      // usersBestSubscription is only available when saas feature is present
      this.Features.hasFeature.withArgs('saas').returns(true)
      this.SubscriptionViewModelBuilder.promises.getBestSubscription.resolves({
        type: 'free',
      })
      this.GeoIpLookup.promises.getCurrencyCode.resolves({
        countryCode: 'IN',
      })
      this.res.render = (pageName, opts) => {
        expect(opts.showInrGeoBanner).to.be.true
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })

    it('should not show INR Banner for Indian users with premium account', function (done) {
      // usersBestSubscription is only available when saas feature is present
      this.Features.hasFeature.withArgs('saas').returns(true)
      this.SubscriptionViewModelBuilder.promises.getBestSubscription.resolves({
        type: 'individual',
      })
      this.GeoIpLookup.promises.getCurrencyCode.resolves({
        countryCode: 'IN',
      })
      this.res.render = (pageName, opts) => {
        expect(opts.showInrGeoBanner).to.be.false
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })

    describe('With Institution SSO feature', function () {
      beforeEach(function (done) {
        this.institutionEmail = 'test@overleaf.com'
        this.institutionName = 'Overleaf'
        this.Features.hasFeature.withArgs('saml').returns(true)
        this.Features.hasFeature.withArgs('affiliations').returns(true)
        this.Features.hasFeature.withArgs('saas').returns(true)
        done()
      })
      it('should show institution SSO available notification for confirmed domains', function () {
        this.UserGetter.promises.getUserFullEmails.resolves([
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
        this.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.include({
            email: this.institutionEmail,
            institutionId: 1,
            institutionName: this.institutionName,
            templateKey: 'notification_institution_sso_available',
          })
        }
        this.ProjectListController.projectListPage(this.req, this.res)
      })
      it('should show a linked notification', function () {
        this.req.session.saml = {
          institutionEmail: this.institutionEmail,
          linked: {
            hasEntitlement: false,
            universityName: this.institutionName,
          },
        }
        this.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.include({
            email: this.institutionEmail,
            institutionName: this.institutionName,
            templateKey: 'notification_institution_sso_linked',
          })
        }
        this.ProjectListController.projectListPage(this.req, this.res)
      })
      it('should show a linked another email notification', function () {
        // when they request to link an email but the institution returns
        // a different email
        this.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.include({
            institutionEmail: this.institutionEmail,
            requestedEmail: 'requested@overleaf.com',
            templateKey: 'notification_institution_sso_non_canonical',
          })
        }
        this.req.session.saml = {
          emailNonCanonical: this.institutionEmail,
          institutionEmail: this.institutionEmail,
          requestedEmail: 'requested@overleaf.com',
          linked: {
            hasEntitlement: false,
            universityName: this.institutionName,
          },
        }
        this.ProjectListController.projectListPage(this.req, this.res)
      })

      it('should show a notification when intent was to register via SSO but account existed', function () {
        this.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.include({
            email: this.institutionEmail,
            templateKey: 'notification_institution_sso_already_registered',
          })
        }
        this.req.session.saml = {
          institutionEmail: this.institutionEmail,
          linked: {
            hasEntitlement: false,
            universityName: 'Overleaf',
          },
          registerIntercept: {
            id: 1,
            name: 'Example University',
          },
        }
        this.ProjectListController.projectListPage(this.req, this.res)
      })

      it('should not show a register notification if the flow was abandoned', function () {
        // could initially start to register with an SSO email and then
        // abandon flow and login with an existing non-institution SSO email
        this.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.not.include({
            email: 'test@overleaf.com',
            templateKey: 'notification_institution_sso_already_registered',
          })
        }
        this.req.session.saml = {
          registerIntercept: {
            id: 1,
            name: 'Example University',
          },
        }
        this.ProjectListController.projectListPage(this.req, this.res)
      })

      it('should show error notification', function () {
        this.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution.length).to.equal(1)
          expect(opts.notificationsInstitution[0].templateKey).to.equal(
            'notification_institution_sso_error'
          )
          expect(opts.notificationsInstitution[0].error).to.be.instanceof(
            Errors.SAMLAlreadyLinkedError
          )
        }
        this.req.session.saml = {
          institutionEmail: this.institutionEmail,
          error: new Errors.SAMLAlreadyLinkedError(),
        }
        this.ProjectListController.projectListPage(this.req, this.res)
      })

      describe('for an unconfirmed domain for an SSO institution', function () {
        beforeEach(function (done) {
          this.UserGetter.promises.getUserFullEmails.resolves([
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
          done()
        })
        it('should not show institution SSO available notification', function () {
          this.res.render = (pageName, opts) => {
            expect(opts.notificationsInstitution.length).to.equal(0)
          }
          this.ProjectListController.projectListPage(this.req, this.res)
        })
      })
      describe('when linking/logging in initiated on institution side', function () {
        it('should not show a linked another email notification', function () {
          // this is only used when initated on Overleaf,
          // because we keep track of the requested email they tried to link
          this.res.render = (pageName, opts) => {
            expect(opts.notificationsInstitution).to.not.deep.include({
              institutionEmail: this.institutionEmail,
              requestedEmail: undefined,
              templateKey: 'notification_institution_sso_non_canonical',
            })
          }
          this.req.session.saml = {
            emailNonCanonical: this.institutionEmail,
            institutionEmail: this.institutionEmail,
            linked: {
              hasEntitlement: false,
              universityName: this.institutionName,
            },
          }
          this.ProjectListController.projectListPage(this.req, this.res)
        })
      })
      describe('Institution with SSO beta testable', function () {
        beforeEach(function (done) {
          this.UserGetter.promises.getUserFullEmails.resolves([
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
          done()
        })
        it('should show institution SSO available notification when on a beta testing session', function () {
          this.req.session.samlBeta = true
          this.res.render = (pageName, opts) => {
            expect(opts.notificationsInstitution).to.deep.include({
              email: 'beta@beta.com',
              institutionId: 2,
              institutionName: 'Beta University',
              templateKey: 'notification_institution_sso_available',
            })
          }
          this.ProjectListController.projectListPage(this.req, this.res)
        })
        it('should not show institution SSO available notification when not on a beta testing session', function () {
          this.req.session.samlBeta = false
          this.res.render = (pageName, opts) => {
            expect(opts.notificationsInstitution).to.deep.not.include({
              email: 'test@overleaf.com',
              institutionId: 1,
              institutionName: 'Overleaf',
              templateKey: 'notification_institution_sso_available',
            })
          }
          this.ProjectListController.projectListPage(this.req, this.res)
        })
      })
    })

    describe('Without Institution SSO feature', function () {
      beforeEach(function (done) {
        this.Features.hasFeature.withArgs('saml').returns(false)
        done()
      })
      it('should not show institution sso available notification', function () {
        this.res.render = (pageName, opts) => {
          expect(opts.notificationsInstitution).to.deep.not.include({
            email: 'test@overleaf.com',
            institutionId: 1,
            institutionName: 'Overleaf',
            templateKey: 'notification_institution_sso_available',
          })
        }
        this.ProjectListController.projectListPage(this.req, this.res)
      })
    })

    describe('enterprise banner', function () {
      beforeEach(function (done) {
        this.Features.hasFeature.withArgs('saas').returns(true)
        this.LimitationsManager.promises.userIsMemberOfGroupSubscription.resolves(
          { isMember: false }
        )
        this.UserGetter.promises.getUserFullEmails.resolves([
          {
            email: 'test@test-domain.com',
          },
        ])

        done()
      })

      describe('normal enterprise banner', function () {
        it('shows banner', function () {
          this.res.render = (pageName, opts) => {
            expect(opts.showGroupsAndEnterpriseBanner).to.be.true
          }
          this.ProjectListController.projectListPage(this.req, this.res)
        })

        it('does not show banner if user is part of any affiliation', function () {
          this.UserGetter.promises.getUserFullEmails.resolves([
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

          this.res.render = (pageName, opts) => {
            expect(opts.showGroupsAndEnterpriseBanner).to.be.false
          }
          this.ProjectListController.projectListPage(this.req, this.res)
        })

        it('does not show banner if user is part of any group subscription', function () {
          this.LimitationsManager.promises.userIsMemberOfGroupSubscription.resolves(
            { isMember: true }
          )

          this.res.render = (pageName, opts) => {
            expect(opts.showGroupsAndEnterpriseBanner).to.be.false
          }
          this.ProjectListController.projectListPage(this.req, this.res)
        })

        it('have a banner variant of "FOMO" or "on-premise"', function () {
          this.res.render = (pageName, opts) => {
            expect(opts.groupsAndEnterpriseBannerVariant).to.be.oneOf([
              'FOMO',
              'on-premise',
            ])
          }
          this.ProjectListController.projectListPage(this.req, this.res)
        })
      })

      describe('US government enterprise banner', function () {
        it('does not show enterprise banner if US government enterprise banner is shown', function () {
          const emails = [
            {
              email: 'test@test.mil',
              confirmedAt: new Date('2024-01-01'),
            },
          ]

          this.UserGetter.promises.getUserFullEmails.resolves(emails)
          this.Modules.promises.hooks.fire
            .withArgs('getUSGovBanner', emails, false, false)
            .resolves([
              {
                showUSGovBanner: true,
                usGovBannerVariant: 'variant',
              },
            ])
          this.res.render = (pageName, opts) => {
            expect(opts.showGroupsAndEnterpriseBanner).to.be.false
            expect(opts.showUSGovBanner).to.be.true
          }
          this.ProjectListController.projectListPage(this.req, this.res)
        })
      })
    })
  })

  describe('projectListReactPage with duplicate projects', function () {
    beforeEach(function () {
      this.projects = [
        { _id: 1, lastUpdated: 1, owner_ref: 'user-1' },
        { _id: 2, lastUpdated: 2, owner_ref: 'user-2' },
      ]
      this.readAndWrite = [{ _id: 5, lastUpdated: 5, owner_ref: 'user-1' }]
      this.readOnly = [{ _id: 3, lastUpdated: 3, owner_ref: 'user-1' }]
      this.tokenReadAndWrite = [{ _id: 6, lastUpdated: 5, owner_ref: 'user-4' }]
      this.tokenReadOnly = [
        { _id: 6, lastUpdated: 5, owner_ref: 'user-4' }, // Also in tokenReadAndWrite
        { _id: 7, lastUpdated: 4, owner_ref: 'user-5' },
      ]
      this.review = [{ _id: 8, lastUpdated: 5, owner_ref: 'user-6' }]
      this.allProjects = {
        owned: this.projects,
        readAndWrite: this.readAndWrite,
        readOnly: this.readOnly,
        tokenReadAndWrite: this.tokenReadAndWrite,
        tokenReadOnly: this.tokenReadOnly,
        review: this.review,
      }

      this.ProjectGetter.promises.findAllUsersProjects.resolves(
        this.allProjects
      )
    })

    it('should render the project/list-react page', function (done) {
      this.res.render = (pageName, opts) => {
        pageName.should.equal('project/list-react')
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })

    it('should omit one of the projects', function (done) {
      this.res.render = (pageName, opts) => {
        opts.prefetchedProjectsBlob.projects.length.should.equal(
          this.projects.length +
            this.readAndWrite.length +
            this.readOnly.length +
            this.tokenReadAndWrite.length +
            this.tokenReadOnly.length +
            this.review.length -
            1
        )
        done()
      }
      this.ProjectListController.projectListPage(this.req, this.res)
    })
  })
})
