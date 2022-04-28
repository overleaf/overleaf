const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const Errors = require('../../../../app/src/Features/Errors/Errors')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/Project/ProjectController'
)

describe('ProjectController', function () {
  beforeEach(function () {
    this.project_id = ObjectId('abcdefabcdefabcdefabcdef')

    this.user = {
      _id: ObjectId('123456123456123456123456'),
      email: 'test@overleaf.com',
      first_name: 'bjkdsjfk',
      features: {},
      emails: [{ email: 'test@overleaf.com' }],
    }
    this.settings = {
      apis: {
        chat: {
          url: 'chat.com',
        },
      },
      siteUrl: 'https://overleaf.com',
      algolia: {},
    }
    this.brandVariationDetails = {
      id: '12',
      active: true,
      brand_name: 'The journal',
      home_url: 'http://www.thejournal.com/',
      publish_menu_link_html: 'Submit your paper to the <em>The Journal</em>',
    }
    this.token = 'some-token'
    this.ProjectDeleter = {
      deleteProject: sinon.stub().callsArg(2),
      restoreProject: sinon.stub().callsArg(1),
      findArchivedProjects: sinon.stub(),
    }
    this.ProjectDuplicator = {
      duplicate: sinon.stub().callsArgWith(3, null, { _id: this.project_id }),
    }
    this.ProjectCreationHandler = {
      createExampleProject: sinon
        .stub()
        .callsArgWith(2, null, { _id: this.project_id }),
      createBasicProject: sinon
        .stub()
        .callsArgWith(2, null, { _id: this.project_id }),
    }
    this.SubscriptionLocator = { getUsersSubscription: sinon.stub() }
    this.LimitationsManager = {
      hasPaidSubscription: sinon.stub(),
      userIsMemberOfGroupSubscription: sinon
        .stub()
        .callsArgWith(1, null, false),
    }
    this.TagsHandler = { getAllTags: sinon.stub() }
    this.NotificationsHandler = { getUserNotifications: sinon.stub() }
    this.UserModel = { findById: sinon.stub(), updateOne: sinon.stub() }
    this.AuthorizationManager = {
      getPrivilegeLevelForProject: sinon.stub(),
      isRestrictedUser: sinon.stub().returns(false),
    }
    this.EditorController = { renameProject: sinon.stub() }
    this.InactiveProjectManager = { reactivateProjectIfRequired: sinon.stub() }
    this.ProjectUpdateHandler = { markAsOpened: sinon.stub() }
    this.ProjectGetter = {
      findAllUsersProjects: sinon.stub(),
      getProject: sinon.stub(),
    }
    this.ProjectHelper = {
      isArchived: sinon.stub(),
      isTrashed: sinon.stub(),
      isArchivedOrTrashed: sinon.stub(),
      getAllowedImagesForUser: sinon.stub().returns([]),
    }
    this.SessionManager = {
      getLoggedInUser: sinon.stub().callsArgWith(1, null, this.user),
      getLoggedInUserId: sinon.stub().returns(this.user._id),
      getSessionUser: sinon.stub().returns(this.user),
      isUserLoggedIn: sinon.stub().returns(true),
    }
    this.UserController = {
      logout: sinon.stub(),
    }
    this.TokenAccessHandler = {
      getRequestToken: sinon.stub().returns(this.token),
      protectTokens: sinon.stub(),
    }
    this.CollaboratorsGetter = {
      userIsTokenMember: sinon.stub().callsArgWith(2, null, false),
    }
    this.ProjectEntityHandler = {}
    this.NotificationBuilder = {
      ipMatcherAffiliation: sinon.stub().returns({ create: sinon.stub() }),
    }
    this.UserGetter = {
      getUserFullEmails: sinon.stub().yields(null, []),
      getUser: sinon
        .stub()
        .callsArgWith(2, null, { lastLoginIp: '192.170.18.2' }),
    }
    this.Features = {
      hasFeature: sinon.stub(),
    }
    this.FeaturesUpdater = {
      featuresEpochIsCurrent: sinon.stub().returns(true),
      refreshFeatures: sinon.stub().yields(null, this.user),
    }
    this.BrandVariationsHandler = {
      getBrandVariationById: sinon
        .stub()
        .callsArgWith(1, null, this.brandVariationDetails),
    }
    this.TpdsProjectFlusher = {
      flushProjectToTpdsIfNeeded: sinon.stub().yields(),
    }
    this.Metrics = {
      Timer: class {
        done() {}
      },
      inc: sinon.stub(),
    }
    this.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
      },
      getAssignment: sinon.stub().yields(null, { variant: 'default' }),
    }
    this.InstitutionsFeatures = {
      hasLicence: sinon.stub().callsArgWith(1, null, false),
    }

    this.ProjectController = SandboxedModule.require(MODULE_PATH, {
      requires: {
        mongodb: { ObjectId },
        '@overleaf/settings': this.settings,
        '@overleaf/metrics': this.Metrics,
        '../SplitTests/SplitTestHandler': this.SplitTestHandler,
        './ProjectDeleter': this.ProjectDeleter,
        './ProjectDuplicator': this.ProjectDuplicator,
        './ProjectCreationHandler': this.ProjectCreationHandler,
        '../Editor/EditorController': this.EditorController,
        '../User/UserController': this.UserController,
        './ProjectHelper': this.ProjectHelper,
        '../Subscription/SubscriptionLocator': this.SubscriptionLocator,
        '../Subscription/LimitationsManager': this.LimitationsManager,
        '../Tags/TagsHandler': this.TagsHandler,
        '../Notifications/NotificationsHandler': this.NotificationsHandler,
        '../../models/User': { User: this.UserModel },
        '../Authorization/AuthorizationManager': this.AuthorizationManager,
        '../InactiveData/InactiveProjectManager': this.InactiveProjectManager,
        './ProjectUpdateHandler': this.ProjectUpdateHandler,
        './ProjectGetter': this.ProjectGetter,
        './ProjectDetailsHandler': this.ProjectDetailsHandler,
        '../Authentication/SessionManager': this.SessionManager,
        '../TokenAccess/TokenAccessHandler': this.TokenAccessHandler,
        '../Collaborators/CollaboratorsGetter': this.CollaboratorsGetter,
        './ProjectEntityHandler': this.ProjectEntityHandler,
        '../../infrastructure/Features': this.Features,
        '../Subscription/FeaturesUpdater': this.FeaturesUpdater,
        '../Notifications/NotificationsBuilder': this.NotificationBuilder,
        '../User/UserGetter': this.UserGetter,
        '../BrandVariations/BrandVariationsHandler':
          this.BrandVariationsHandler,
        '../ThirdPartyDataStore/TpdsProjectFlusher': this.TpdsProjectFlusher,
        '../../models/Project': {},
        '../Analytics/AnalyticsManager': { recordEventForUser: () => {} },
        '../../infrastructure/Modules': {
          hooks: { fire: sinon.stub().yields(null, []) },
        },
        '../Spelling/SpellingHandler': {
          getUserDictionary: sinon.stub().yields(null, []),
        },
        '../Institutions/InstitutionsFeatures': this.InstitutionsFeatures,
      },
    })

    this.projectName = '£12321jkj9ujkljds'
    this.req = {
      query: {},
      params: {
        Project_id: this.project_id,
      },
      headers: {},
      connection: {
        remoteAddress: '192.170.18.1',
      },
      session: {
        user: this.user,
      },
      body: {
        projectName: this.projectName,
      },
      i18n: {
        translate() {},
      },
      ip: '192.170.18.1',
    }
    this.res = {
      locals: {
        jsPath: 'js path here',
      },
      setTimeout: sinon.stub(),
    }
  })

  describe('updateProjectSettings', function () {
    it('should update the name', function (done) {
      this.EditorController.renameProject = sinon.stub().callsArg(2)
      this.req.body = { name: (this.name = 'New name') }
      this.res.sendStatus = code => {
        this.EditorController.renameProject
          .calledWith(this.project_id, this.name)
          .should.equal(true)
        code.should.equal(204)
        done()
      }
      this.ProjectController.updateProjectSettings(this.req, this.res)
    })

    it('should update the compiler', function (done) {
      this.EditorController.setCompiler = sinon.stub().callsArg(2)
      this.req.body = { compiler: (this.compiler = 'pdflatex') }
      this.res.sendStatus = code => {
        this.EditorController.setCompiler
          .calledWith(this.project_id, this.compiler)
          .should.equal(true)
        code.should.equal(204)
        done()
      }
      this.ProjectController.updateProjectSettings(this.req, this.res)
    })

    it('should update the imageName', function (done) {
      this.EditorController.setImageName = sinon.stub().callsArg(2)
      this.req.body = { imageName: (this.imageName = 'texlive-1234.5') }
      this.res.sendStatus = code => {
        this.EditorController.setImageName
          .calledWith(this.project_id, this.imageName)
          .should.equal(true)
        code.should.equal(204)
        done()
      }
      this.ProjectController.updateProjectSettings(this.req, this.res)
    })

    it('should update the spell check language', function (done) {
      this.EditorController.setSpellCheckLanguage = sinon.stub().callsArg(2)
      this.req.body = { spellCheckLanguage: (this.languageCode = 'fr') }
      this.res.sendStatus = code => {
        this.EditorController.setSpellCheckLanguage
          .calledWith(this.project_id, this.languageCode)
          .should.equal(true)
        code.should.equal(204)
        done()
      }
      this.ProjectController.updateProjectSettings(this.req, this.res)
    })

    it('should update the root doc', function (done) {
      this.EditorController.setRootDoc = sinon.stub().callsArg(2)
      this.req.body = { rootDocId: (this.rootDocId = 'root-doc-id') }
      this.res.sendStatus = code => {
        this.EditorController.setRootDoc
          .calledWith(this.project_id, this.rootDocId)
          .should.equal(true)
        code.should.equal(204)
        done()
      }
      this.ProjectController.updateProjectSettings(this.req, this.res)
    })
  })

  describe('updateProjectAdminSettings', function () {
    it('should update the public access level', function (done) {
      this.EditorController.setPublicAccessLevel = sinon.stub().callsArg(2)
      this.req.body = {
        publicAccessLevel: (this.publicAccessLevel = 'readonly'),
      }
      this.res.sendStatus = code => {
        this.EditorController.setPublicAccessLevel
          .calledWith(this.project_id, this.publicAccessLevel)
          .should.equal(true)
        code.should.equal(204)
        done()
      }
      this.ProjectController.updateProjectAdminSettings(this.req, this.res)
    })
  })

  describe('deleteProject', function () {
    it('should call the project deleter', function (done) {
      this.res.sendStatus = code => {
        this.ProjectDeleter.deleteProject
          .calledWith(this.project_id, {
            deleterUser: this.user,
            ipAddress: this.req.ip,
          })
          .should.equal(true)
        code.should.equal(200)
        done()
      }
      this.ProjectController.deleteProject(this.req, this.res)
    })
  })

  describe('restoreProject', function () {
    it('should tell the project deleter', function (done) {
      this.res.sendStatus = code => {
        this.ProjectDeleter.restoreProject
          .calledWith(this.project_id)
          .should.equal(true)
        code.should.equal(200)
        done()
      }
      this.ProjectController.restoreProject(this.req, this.res)
    })
  })

  describe('cloneProject', function () {
    it('should call the project duplicator', function (done) {
      this.res.json = json => {
        this.ProjectDuplicator.duplicate
          .calledWith(this.user, this.project_id, this.projectName)
          .should.equal(true)
        json.project_id.should.equal(this.project_id)
        done()
      }
      this.ProjectController.cloneProject(this.req, this.res)
    })
  })

  describe('newProject', function () {
    it('should call the projectCreationHandler with createExampleProject', function (done) {
      this.req.body.template = 'example'
      this.res.json = json => {
        this.ProjectCreationHandler.createExampleProject
          .calledWith(this.user._id, this.projectName)
          .should.equal(true)
        this.ProjectCreationHandler.createBasicProject.called.should.equal(
          false
        )
        done()
      }
      this.ProjectController.newProject(this.req, this.res)
    })

    it('should call the projectCreationHandler with createBasicProject', function (done) {
      this.req.body.template = 'basic'
      this.res.json = json => {
        this.ProjectCreationHandler.createExampleProject.called.should.equal(
          false
        )
        this.ProjectCreationHandler.createBasicProject
          .calledWith(this.user._id, this.projectName)
          .should.equal(true)
        done()
      }
      this.ProjectController.newProject(this.req, this.res)
    })
  })

  describe('projectListPage', function () {
    beforeEach(function () {
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
      this.projects = [
        { _id: 1, lastUpdated: 1, owner_ref: 'user-1' },
        {
          _id: 2,
          lastUpdated: 2,
          owner_ref: 'user-2',
          lastUpdatedBy: 'user-1',
        },
      ]
      this.collabertions = [{ _id: 5, lastUpdated: 5, owner_ref: 'user-1' }]
      this.readOnly = [{ _id: 3, lastUpdated: 3, owner_ref: 'user-1' }]
      this.tokenReadAndWrite = [{ _id: 6, lastUpdated: 5, owner_ref: 'user-4' }]
      this.tokenReadOnly = [{ _id: 7, lastUpdated: 4, owner_ref: 'user-5' }]
      this.allProjects = {
        owned: this.projects,
        readAndWrite: this.collabertions,
        readOnly: this.readOnly,
        tokenReadAndWrite: this.tokenReadAndWrite,
        tokenReadOnly: this.tokenReadOnly,
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
      this.UserModel.findById = (id, fields, callback) => {
        callback(null, this.users[id])
      }
      this.UserGetter.getUser = (id, fields, callback) => {
        callback(null, this.users[id])
      }

      this.LimitationsManager.hasPaidSubscription.callsArgWith(1, null, false)
      this.TagsHandler.getAllTags.callsArgWith(1, null, this.tags)
      this.NotificationsHandler.getUserNotifications = sinon
        .stub()
        .callsArgWith(1, null, this.notifications, {})
      this.ProjectGetter.findAllUsersProjects.callsArgWith(
        2,
        null,
        this.allProjects
      )
    })

    it('should render the project/list page', function (done) {
      this.res.render = (pageName, opts) => {
        pageName.should.equal('project/list')
        done()
      }
      this.ProjectController.projectListPage(this.req, this.res)
    })

    it('should send the tags', function (done) {
      this.res.render = (pageName, opts) => {
        opts.tags.length.should.equal(this.tags.length)
        done()
      }
      this.ProjectController.projectListPage(this.req, this.res)
    })

    it('should create trigger ip matcher notifications', function (done) {
      this.settings.overleaf = true
      this.res.render = (pageName, opts) => {
        this.NotificationBuilder.ipMatcherAffiliation.called.should.equal(true)
        done()
      }
      this.ProjectController.projectListPage(this.req, this.res)
    })

    it('should send the projects', function (done) {
      this.res.render = (pageName, opts) => {
        opts.projects.length.should.equal(
          this.projects.length +
            this.collabertions.length +
            this.readOnly.length +
            this.tokenReadAndWrite.length +
            this.tokenReadOnly.length
        )
        done()
      }
      this.ProjectController.projectListPage(this.req, this.res)
    })

    it('should send the user', function (done) {
      this.res.render = (pageName, opts) => {
        opts.user.should.deep.equal(this.user)
        done()
      }
      this.ProjectController.projectListPage(this.req, this.res)
    })

    it('should inject the users', function (done) {
      this.res.render = (pageName, opts) => {
        opts.projects[0].owner.should.equal(
          this.users[this.projects[0].owner_ref]
        )
        opts.projects[1].owner.should.equal(
          this.users[this.projects[1].owner_ref]
        )
        opts.projects[1].lastUpdatedBy.should.equal(
          this.users[this.projects[1].lastUpdatedBy]
        )
        done()
      }
      this.ProjectController.projectListPage(this.req, this.res)
    })

    it('should send hasSubscription == false when no subscription', function (done) {
      this.res.render = (pageName, opts) => {
        opts.hasSubscription.should.equal(false)
        done()
      }
      this.ProjectController.projectListPage(this.req, this.res)
    })

    it('should send hasSubscription == true when there is a subscription', function (done) {
      this.LimitationsManager.hasPaidSubscription = sinon
        .stub()
        .callsArgWith(1, null, true)
      this.res.render = (pageName, opts) => {
        opts.hasSubscription.should.equal(true)
        done()
      }
      this.ProjectController.projectListPage(this.req, this.res)
    })

    describe('front widget', function (done) {
      beforeEach(function () {
        this.settings.overleaf = {
          front_chat_widget_room_id: 'chat-room-id',
        }
      })

      it('should show for paid users', function (done) {
        this.user.features.github = true
        this.user.features.dropbox = true
        this.res.render = (pageName, opts) => {
          opts.frontChatWidgetRoomId.should.equal(
            this.settings.overleaf.front_chat_widget_room_id
          )
          done()
        }
        this.ProjectController.projectListPage(this.req, this.res)
      })

      it('should show for sample users', function (done) {
        this.user._id = ObjectId('588f3ddae8ebc1bac07c9f00') // last two digits
        this.res.render = (pageName, opts) => {
          opts.frontChatWidgetRoomId.should.equal(
            this.settings.overleaf.front_chat_widget_room_id
          )
          done()
        }
        this.ProjectController.projectListPage(this.req, this.res)
      })

      it('should not show for non sample users', function (done) {
        this.user._id = ObjectId('588f3ddae8ebc1bac07c9fff') // last two digits
        this.res.render = (pageName, opts) => {
          expect(opts.frontChatWidgetRoomId).to.equal(undefined)
          done()
        }
        this.ProjectController.projectListPage(this.req, this.res)
      })
    })

    describe('persistent upgrade prompt', function () {
      describe('if the user has the default variant', function (done) {
        it('should not show', function (done) {
          this.res.render = (pageName, opts) => {
            expect(opts.showToolbarUpgradePrompt).to.equal(false)
            done()
          }
          this.ProjectController.projectListPage(this.req, this.res)
        })
      })

      describe('if the user has the persistent-upgrade variant', function (done) {
        beforeEach(function () {
          this.SplitTestHandler.getAssignment
            .withArgs(this.req, this.res, 'persistent-upgrade-prompt')
            .yields(null, { variant: 'persistent-upgrade' })
        })
        it('should show for a user without a subscription or only non-paid affiliations', function (done) {
          this.res.render = (pageName, opts) => {
            expect(opts.showToolbarUpgradePrompt).to.equal(true)
            done()
          }
          this.ProjectController.projectListPage(this.req, this.res)
        })
        it('should not show for a user with a subscription', function (done) {
          this.LimitationsManager.hasPaidSubscription = sinon
            .stub()
            .callsArgWith(1, null, true)
          this.res.render = (pageName, opts) => {
            expect(opts.showToolbarUpgradePrompt).to.equal(false)
            done()
          }
          this.ProjectController.projectListPage(this.req, this.res)
        })
        it('should not show for a user with an affiliated paid university', function (done) {
          const emailWithProAffiliation = {
            email: 'pro@example.com',
            emailHasInstitutionLicence: true,
          }
          this.UserGetter.getUserFullEmails = sinon
            .stub()
            .yields(null, [emailWithProAffiliation])
          this.res.render = (pageName, opts) => {
            expect(opts.showToolbarUpgradePrompt).to.equal(false)
            done()
          }
          this.ProjectController.projectListPage(this.req, this.res)
        })
      })
    })

    describe('With Institution SSO feature', function () {
      beforeEach(function (done) {
        this.institutionEmail = 'test@overleaf.com'
        this.institutionName = 'Overleaf'
        this.Features.hasFeature.withArgs('saml').returns(true)
        this.Features.hasFeature.withArgs('affiliations').returns(true)
        this.Features.hasFeature.withArgs('overleaf-integration').returns(true)
        done()
      })
      it('should show institution SSO available notification for confirmed domains', function () {
        this.UserGetter.getUserFullEmails.yields(null, [
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
        this.ProjectController.projectListPage(this.req, this.res)
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
        this.ProjectController.projectListPage(this.req, this.res)
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
        this.ProjectController.projectListPage(this.req, this.res)
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
        this.ProjectController.projectListPage(this.req, this.res)
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
        this.ProjectController.projectListPage(this.req, this.res)
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
        this.ProjectController.projectListPage(this.req, this.res)
      })

      describe('for an unconfirmed domain for an SSO institution', function () {
        beforeEach(function (done) {
          this.UserGetter.getUserFullEmails.yields(null, [
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
          this.ProjectController.projectListPage(this.req, this.res)
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
          this.ProjectController.projectListPage(this.req, this.res)
        })
      })
      describe('Institution with SSO beta testable', function () {
        beforeEach(function (done) {
          this.UserGetter.getUserFullEmails.yields(null, [
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
          this.ProjectController.projectListPage(this.req, this.res)
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
          this.ProjectController.projectListPage(this.req, this.res)
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
        this.ProjectController.projectListPage(this.req, this.res)
      })
    })
  })

  describe('projectListPage with duplicate projects', function () {
    beforeEach(function () {
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
      this.projects = [
        { _id: 1, lastUpdated: 1, owner_ref: 'user-1' },
        { _id: 2, lastUpdated: 2, owner_ref: 'user-2' },
      ]
      this.collabertions = [{ _id: 5, lastUpdated: 5, owner_ref: 'user-1' }]
      this.readOnly = [{ _id: 3, lastUpdated: 3, owner_ref: 'user-1' }]
      this.tokenReadAndWrite = [{ _id: 6, lastUpdated: 5, owner_ref: 'user-4' }]
      this.tokenReadOnly = [
        { _id: 6, lastUpdated: 5, owner_ref: 'user-4' }, // Also in tokenReadAndWrite
        { _id: 7, lastUpdated: 4, owner_ref: 'user-5' },
      ]
      this.allProjects = {
        owned: this.projects,
        readAndWrite: this.collabertions,
        readOnly: this.readOnly,
        tokenReadAndWrite: this.tokenReadAndWrite,
        tokenReadOnly: this.tokenReadOnly,
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
      this.UserModel.findById = (id, fields, callback) => {
        callback(null, this.users[id])
      }

      this.LimitationsManager.hasPaidSubscription.callsArgWith(1, null, false)
      this.TagsHandler.getAllTags.callsArgWith(1, null, this.tags)
      this.NotificationsHandler.getUserNotifications = sinon
        .stub()
        .callsArgWith(1, null, this.notifications, {})
      this.ProjectGetter.findAllUsersProjects.callsArgWith(
        2,
        null,
        this.allProjects
      )
    })

    it('should render the project/list page', function (done) {
      this.res.render = (pageName, opts) => {
        pageName.should.equal('project/list')
        done()
      }
      this.ProjectController.projectListPage(this.req, this.res)
    })

    it('should omit one of the projects', function (done) {
      this.res.render = (pageName, opts) => {
        opts.projects.length.should.equal(
          this.projects.length +
            this.collabertions.length +
            this.readOnly.length +
            this.tokenReadAndWrite.length +
            this.tokenReadOnly.length -
            1
        )
        done()
      }
      this.ProjectController.projectListPage(this.req, this.res)
    })
  })

  describe('renameProject', function () {
    beforeEach(function () {
      this.newProjectName = 'my supper great new project'
      this.req.body.newProjectName = this.newProjectName
    })

    it('should call the editor controller', function (done) {
      this.EditorController.renameProject.callsArgWith(2)
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.EditorController.renameProject
          .calledWith(this.project_id, this.newProjectName)
          .should.equal(true)
        done()
      }
      this.ProjectController.renameProject(this.req, this.res)
    })

    it('should send an error to next() if there is a problem', function (done) {
      let error
      this.EditorController.renameProject.callsArgWith(
        2,
        (error = new Error('problem'))
      )
      const next = e => {
        e.should.equal(error)
        done()
      }
      this.ProjectController.renameProject(this.req, this.res, next)
    })
  })

  describe('loadEditor', function () {
    beforeEach(function () {
      this.settings.editorIsOpen = true
      this.project = {
        name: 'my proj',
        _id: '213123kjlkj',
        owner_ref: '59fc84d5fbea77482d436e1b',
      }
      this.brandedProject = {
        name: 'my branded proj',
        _id: '3252332',
        owner_ref: '59fc84d5fbea77482d436e1b',
        brandVariationId: '12',
      }
      this.user = {
        _id: this.user._id,
        ace: {
          fontSize: 'massive',
          theme: 'sexy',
        },
        email: 'bob@bob.com',
        refProviders: {
          mendeley: { encrypted: 'aaaa' },
          zotero: { encrypted: 'bbbb' },
        },
      }
      this.ProjectGetter.getProject.callsArgWith(2, null, this.project)
      this.UserModel.findById.callsArgWith(2, null, this.user)
      this.SubscriptionLocator.getUsersSubscription.callsArgWith(1, null, {})
      this.AuthorizationManager.getPrivilegeLevelForProject.callsArgWith(
        3,
        null,
        'owner'
      )
      this.ProjectDeleter.unmarkAsDeletedByExternalSource = sinon.stub()
      this.InactiveProjectManager.reactivateProjectIfRequired.callsArgWith(1)
      this.ProjectUpdateHandler.markAsOpened.callsArgWith(1)
    })

    it('should render the project/editor page', function (done) {
      this.res.render = (pageName, opts) => {
        pageName.should.equal('project/editor')
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should add user', function (done) {
      this.res.render = (pageName, opts) => {
        opts.user.email.should.equal(this.user.email)
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should sanitize refProviders', function (done) {
      this.res.render = (_pageName, opts) => {
        expect(opts.user.refProviders).to.deep.equal({
          mendeley: true,
          zotero: true,
        })
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should add on userSettings', function (done) {
      this.res.render = (pageName, opts) => {
        opts.userSettings.fontSize.should.equal(this.user.ace.fontSize)
        opts.userSettings.editorTheme.should.equal(this.user.ace.theme)
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should add isRestrictedTokenMember', function (done) {
      this.res.render = (pageName, opts) => {
        opts.isRestrictedTokenMember.should.exist
        opts.isRestrictedTokenMember.should.equal(false)
        return done()
      }
      return this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should set isRestrictedTokenMember when appropriate', function (done) {
      this.AuthorizationManager.isRestrictedUser.returns(true)
      this.res.render = (pageName, opts) => {
        opts.isRestrictedTokenMember.should.exist
        opts.isRestrictedTokenMember.should.equal(true)
        return done()
      }
      return this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should render the closed page if the editor is closed', function (done) {
      this.settings.editorIsOpen = false
      this.res.render = (pageName, opts) => {
        pageName.should.equal('general/closed')
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should not render the page if the project can not be accessed', function (done) {
      this.AuthorizationManager.getPrivilegeLevelForProject = sinon
        .stub()
        .callsArgWith(3, null, null)
      this.res.sendStatus = (resCode, opts) => {
        resCode.should.equal(401)
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should reactivateProjectIfRequired', function (done) {
      this.res.render = (pageName, opts) => {
        this.InactiveProjectManager.reactivateProjectIfRequired
          .calledWith(this.project_id)
          .should.equal(true)
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should mark user as active', function (done) {
      this.res.render = (pageName, opts) => {
        expect(this.UserModel.updateOne).to.have.been.calledOnce
        expect(this.UserModel.updateOne.args[0][0]).to.deep.equal({
          _id: ObjectId(this.user._id),
        })
        expect(this.UserModel.updateOne.args[0][1].$set.lastActive).to.exist
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should mark project as opened', function (done) {
      this.res.render = (pageName, opts) => {
        this.ProjectUpdateHandler.markAsOpened
          .calledWith(this.project_id)
          .should.equal(true)
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should call the brand variations handler for branded projects', function (done) {
      this.ProjectGetter.getProject.callsArgWith(2, null, this.brandedProject)
      this.res.render = (pageName, opts) => {
        this.BrandVariationsHandler.getBrandVariationById
          .calledWith()
          .should.equal(true)
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should not call the brand variations handler for unbranded projects', function (done) {
      this.res.render = (pageName, opts) => {
        this.BrandVariationsHandler.getBrandVariationById.called.should.equal(
          false
        )
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should expose the brand variation details as locals for branded projects', function (done) {
      this.ProjectGetter.getProject.callsArgWith(2, null, this.brandedProject)
      this.res.render = (pageName, opts) => {
        opts.brandVariation.should.deep.equal(this.brandVariationDetails)
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('flushes the project to TPDS if a flush is pending', function (done) {
      this.res.render = () => {
        this.TpdsProjectFlusher.flushProjectToTpdsIfNeeded.should.have.been.calledWith(
          this.project_id
        )
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    it('should refresh the user features if the epoch is outdated', function (done) {
      this.FeaturesUpdater.featuresEpochIsCurrent = sinon.stub().returns(false)
      this.res.render = () => {
        this.FeaturesUpdater.refreshFeatures.should.have.been.calledWith(
          this.user._id,
          'load-editor'
        )
        done()
      }
      this.ProjectController.loadEditor(this.req, this.res)
    })

    describe('pdf caching feature flags', function () {
      function expectBandwidthTrackingEnabled() {
        it('should track pdf bandwidth', function (done) {
          this.res.render = (pageName, opts) => {
            expect(opts.trackPdfDownload).to.equal(true)
            done()
          }
          this.ProjectController.loadEditor(this.req, this.res)
        })
      }
      function expectPDFCachingEnabled() {
        it('should enable pdf caching', function (done) {
          this.res.render = (pageName, opts) => {
            expect(opts.enablePdfCaching).to.equal(true)
            done()
          }
          this.ProjectController.loadEditor(this.req, this.res)
        })
      }
      function expectBandwidthTrackingDisabled() {
        it('should not track pdf bandwidth', function (done) {
          this.res.render = (pageName, opts) => {
            expect(opts.trackPdfDownload).to.equal(false)
            done()
          }
          this.ProjectController.loadEditor(this.req, this.res)
        })
      }
      function expectPDFCachingDisabled() {
        it('should disable pdf caching', function (done) {
          this.res.render = (pageName, opts) => {
            expect(opts.enablePdfCaching).to.equal(false)
            done()
          }
          this.ProjectController.loadEditor(this.req, this.res)
        })
      }

      beforeEach(function () {
        this.settings.enablePdfCaching = true
      })

      describe('during opt-in only', function () {
        describe('with no query', function () {
          expectBandwidthTrackingDisabled()
          expectPDFCachingDisabled()
        })

        describe('with enable_pdf_caching=false', function () {
          beforeEach(function () {
            this.req.query.enable_pdf_caching = 'false'
          })
          expectBandwidthTrackingDisabled()
          expectPDFCachingDisabled()
        })

        describe('with enable_pdf_caching=true', function () {
          beforeEach(function () {
            this.req.query.enable_pdf_caching = 'true'
          })
          expectBandwidthTrackingEnabled()
          expectPDFCachingEnabled()
        })
      })
    })

    describe('wsUrl', function () {
      function checkLoadEditorWsMetric(metric) {
        it(`should inc metric ${metric}`, function (done) {
          this.res.render = () => {
            this.Metrics.inc.calledWith(metric).should.equal(true)
            done()
          }
          this.ProjectController.loadEditor(this.req, this.res)
        })
      }
      function checkWsFallback(isBeta, isV2) {
        describe('with ws=fallback', function () {
          beforeEach(function () {
            this.req.query = {}
            this.req.query.ws = 'fallback'
          })
          it('should unset the wsUrl', function (done) {
            this.res.render = (pageName, opts) => {
              ;(opts.wsUrl || '/socket.io').should.equal('/socket.io')
              done()
            }
            this.ProjectController.loadEditor(this.req, this.res)
          })
          checkLoadEditorWsMetric(
            `load-editor-ws${isBeta ? '-beta' : ''}${
              isV2 ? '-v2' : ''
            }-fallback`
          )
        })
      }

      beforeEach(function () {
        this.settings.wsUrl = '/other.socket.io'
      })
      it('should set the custom wsUrl', function (done) {
        this.res.render = (pageName, opts) => {
          opts.wsUrl.should.equal('/other.socket.io')
          done()
        }
        this.ProjectController.loadEditor(this.req, this.res)
      })
      checkLoadEditorWsMetric('load-editor-ws')
      checkWsFallback(false)

      describe('beta program', function () {
        beforeEach(function () {
          this.settings.wsUrlBeta = '/beta.socket.io'
        })
        describe('for a normal user', function () {
          it('should set the normal custom wsUrl', function (done) {
            this.res.render = (pageName, opts) => {
              opts.wsUrl.should.equal('/other.socket.io')
              done()
            }
            this.ProjectController.loadEditor(this.req, this.res)
          })
          checkLoadEditorWsMetric('load-editor-ws')
          checkWsFallback(false)
        })

        describe('for a beta user', function () {
          beforeEach(function () {
            this.user.betaProgram = true
          })
          it('should set the beta wsUrl', function (done) {
            this.res.render = (pageName, opts) => {
              opts.wsUrl.should.equal('/beta.socket.io')
              done()
            }
            this.ProjectController.loadEditor(this.req, this.res)
          })
          checkLoadEditorWsMetric('load-editor-ws-beta')
          checkWsFallback(true)
        })
      })

      describe('v2-rollout', function () {
        beforeEach(function () {
          this.settings.wsUrlBeta = '/beta.socket.io'
          this.settings.wsUrlV2 = '/socket.io.v2'
        })

        function checkNonMatch() {
          it('should set the normal custom wsUrl', function (done) {
            this.res.render = (pageName, opts) => {
              opts.wsUrl.should.equal('/other.socket.io')
              done()
            }
            this.ProjectController.loadEditor(this.req, this.res)
          })
          checkLoadEditorWsMetric('load-editor-ws')
          checkWsFallback(false)
        }
        function checkMatch() {
          it('should set the v2 wsUrl', function (done) {
            this.res.render = (pageName, opts) => {
              opts.wsUrl.should.equal('/socket.io.v2')
              done()
            }
            this.ProjectController.loadEditor(this.req, this.res)
          })
          checkLoadEditorWsMetric('load-editor-ws-v2')
          checkWsFallback(false, true)
        }
        function checkForBetaUser() {
          describe('for a beta user', function () {
            beforeEach(function () {
              this.user.betaProgram = true
            })
            it('should set the beta wsUrl', function (done) {
              this.res.render = (pageName, opts) => {
                opts.wsUrl.should.equal('/beta.socket.io')
                done()
              }
              this.ProjectController.loadEditor(this.req, this.res)
            })
            checkLoadEditorWsMetric('load-editor-ws-beta')
            checkWsFallback(true)
          })
        }

        describe('when the roll out percentage is 0', function () {
          beforeEach(function () {
            this.settings.wsUrlV2Percentage = 0
          })
          describe('when the projectId does not match (0)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(0)
            })
            checkNonMatch()
          })
          describe('when the projectId does not match (42)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(42)
            })
            checkNonMatch()
          })
          checkForBetaUser()
        })
        describe('when the roll out percentage is 1', function () {
          beforeEach(function () {
            this.settings.wsUrlV2Percentage = 1
          })
          describe('when the projectId matches (0)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(0)
            })
            checkMatch()
            checkForBetaUser()
          })
          describe('when the projectId does not match (1)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(1)
            })
            checkNonMatch()
            checkForBetaUser()
          })
          describe('when the projectId does not match (42)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(42)
            })
            checkNonMatch()
          })
        })
        describe('when the roll out percentage is 10', function () {
          beforeEach(function () {
            this.settings.wsUrlV2Percentage = 10
          })
          describe('when the projectId matches (0)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(0)
            })
            checkMatch()
          })
          describe('when the projectId matches (9)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(9)
            })
            checkMatch()
            checkForBetaUser()
          })
          describe('when the projectId does not match (10)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(10)
            })
            checkNonMatch()
          })
          describe('when the projectId does not match (42)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(42)
            })
            checkNonMatch()
            checkForBetaUser()
          })
        })
        describe('when the roll out percentage is 100', function () {
          beforeEach(function () {
            this.settings.wsUrlV2Percentage = 100
          })
          describe('when the projectId matches (0)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(0)
            })
            checkMatch()
            checkForBetaUser()
          })
          describe('when the projectId matches (10)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(10)
            })
            checkMatch()
          })
          describe('when the projectId matches (42)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(42)
            })
            checkMatch()
          })
          describe('when the projectId matches (99)', function () {
            beforeEach(function () {
              this.req.params.Project_id = ObjectId.createFromTime(99)
            })
            checkMatch()
          })
        })
      })
    })

    describe('feature flags', function () {
      describe('showPdfDetach', function () {
        describe('showPdfDetach=false', function () {
          it('should be false by default', function (done) {
            this.res.render = (pageName, opts) => {
              expect(opts.showPdfDetach).to.be.false
              done()
            }
            this.ProjectController.loadEditor(this.req, this.res)
          })

          it('should be false when the split test is enabled and ?pdf_detach=false', function (done) {
            this.res.render = (pageName, opts) => {
              expect(opts.showPdfDetach).to.be.false
              done()
            }
            this.SplitTestHandler.getAssignment
              .withArgs(this.req, this.res, 'pdf-detach')
              .yields(null, { variant: 'enabled' })
            this.req.query.pdf_detach = 'false'
            this.ProjectController.loadEditor(this.req, this.res)
          })
        })

        describe('showPdfDetach=true', function () {
          it('should be true when ?pdf_detach=true', function (done) {
            this.res.render = (pageName, opts) => {
              expect(opts.showPdfDetach).to.be.true
              done()
            }
            this.req.query.pdf_detach = 'true'
            this.ProjectController.loadEditor(this.req, this.res)
          })

          it('should be true for alpha group', function (done) {
            this.res.render = (pageName, opts) => {
              expect(opts.showPdfDetach).to.be.true
              done()
            }
            this.SplitTestHandler.getAssignment
              .withArgs(this.req, this.res, 'pdf-detach')
              .yields(null, { variant: 'enabled' })
            this.ProjectController.loadEditor(this.req, this.res)
          })
        })
      })
    })

    describe('persistent upgrade prompt', function () {
      beforeEach(function () {
        // default to without a subscription
        this.SubscriptionLocator.getUsersSubscription = sinon
          .stub()
          .callsArgWith(1, null, null)
      })
      describe('if the user has the default variant', function (done) {
        it('should not show', function (done) {
          this.res.render = (pageName, opts) => {
            expect(opts.showHeaderUpgradePrompt).to.equal(false)
            done()
          }
          this.ProjectController.loadEditor(this.req, this.res)
        })
      })

      describe('if the user has the persistent-upgrade variant', function (done) {
        beforeEach(function () {
          this.SplitTestHandler.getAssignment
            .withArgs(this.req, this.res, 'persistent-upgrade-prompt')
            .yields(null, { variant: 'persistent-upgrade' })
        })
        it('should show for a user without a subscription or only non-paid affiliations', function (done) {
          this.res.render = (pageName, opts) => {
            expect(opts.showHeaderUpgradePrompt).to.equal(true)
            done()
          }
          this.ProjectController.loadEditor(this.req, this.res)
        })
        it('should not show for a user with a personal subscription', function (done) {
          this.SubscriptionLocator.getUsersSubscription = sinon
            .stub()
            .callsArgWith(1, null, {})
          this.res.render = (pageName, opts) => {
            expect(opts.showHeaderUpgradePrompt).to.equal(false)
            done()
          }
          this.ProjectController.loadEditor(this.req, this.res)
        })
        it('should not show for a user who is a member of a group subscription', function (done) {
          this.LimitationsManager.userIsMemberOfGroupSubscription = sinon
            .stub()
            .callsArgWith(1, null, true)
          this.res.render = (pageName, opts) => {
            expect(opts.showHeaderUpgradePrompt).to.equal(false)
            done()
          }
          this.ProjectController.loadEditor(this.req, this.res)
        })
        it('should not show for a user with an affiliated paid university', function (done) {
          this.InstitutionsFeatures.hasLicence = sinon
            .stub()
            .callsArgWith(1, null, true)
          this.res.render = (pageName, opts) => {
            expect(opts.showHeaderUpgradePrompt).to.equal(false)
            done()
          }
          this.ProjectController.loadEditor(this.req, this.res)
        })
      })
    })
  })

  describe('userProjectsJson', function () {
    beforeEach(function (done) {
      const projects = [
        {
          archived: true,
          trashed: true,
          id: 'a',
          name: 'A',
          accessLevel: 'a',
          somethingElse: 1,
        },
        {
          archived: false,
          id: 'b',
          name: 'B',
          accessLevel: 'b',
          somethingElse: 1,
        },
        {
          archived: false,
          trashed: true,
          id: 'c',
          name: 'C',
          accessLevel: 'c',
          somethingElse: 1,
        },
        {
          archived: false,
          trashed: false,
          id: 'd',
          name: 'D',
          accessLevel: 'd',
          somethingElse: 1,
        },
      ]

      this.ProjectHelper.isArchivedOrTrashed
        .withArgs(projects[0], this.user._id)
        .returns(true)
      this.ProjectHelper.isArchivedOrTrashed
        .withArgs(projects[1], this.user._id)
        .returns(false)
      this.ProjectHelper.isArchivedOrTrashed
        .withArgs(projects[2], this.user._id)
        .returns(true)
      this.ProjectHelper.isArchivedOrTrashed
        .withArgs(projects[3], this.user._id)
        .returns(false)

      this.ProjectGetter.findAllUsersProjects = sinon
        .stub()
        .callsArgWith(2, null, [])
      this.ProjectController._buildProjectList = sinon.stub().returns(projects)
      this.SessionManager.getLoggedInUserId = sinon
        .stub()
        .returns(this.user._id)
      done()
    })

    it('should produce a list of projects', function (done) {
      this.res.json = data => {
        expect(data).to.deep.equal({
          projects: [
            { _id: 'b', name: 'B', accessLevel: 'b' },
            { _id: 'd', name: 'D', accessLevel: 'd' },
          ],
        })
        done()
      }
      this.ProjectController.userProjectsJson(this.req, this.res, this.next)
    })
  })

  describe('projectEntitiesJson', function () {
    beforeEach(function () {
      this.SessionManager.getLoggedInUserId = sinon.stub().returns('abc')
      this.req.params = { Project_id: 'abcd' }
      this.project = { _id: 'abcd' }
      this.docs = [
        { path: '/things/b.txt', doc: true },
        { path: '/main.tex', doc: true },
      ]
      this.files = [{ path: '/things/a.txt' }]
      this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(1, null, this.project)
      this.ProjectEntityHandler.getAllEntitiesFromProject = sinon
        .stub()
        .returns({ docs: this.docs, files: this.files })
    })

    it('should produce a list of entities', function (done) {
      this.res.json = data => {
        expect(data).to.deep.equal({
          project_id: 'abcd',
          entities: [
            { path: '/main.tex', type: 'doc' },
            { path: '/things/a.txt', type: 'file' },
            { path: '/things/b.txt', type: 'doc' },
          ],
        })
        expect(this.ProjectGetter.getProject.callCount).to.equal(1)
        expect(
          this.ProjectEntityHandler.getAllEntitiesFromProject.callCount
        ).to.equal(1)
        done()
      }
      this.ProjectController.projectEntitiesJson(this.req, this.res, this.next)
    })
  })

  describe('_buildProjectViewModel', function () {
    beforeEach(function () {
      this.ProjectHelper.isArchived.returns(false)
      this.ProjectHelper.isTrashed.returns(false)

      this.project = {
        _id: 'abcd',
        name: 'netsenits',
        lastUpdated: 1,
        lastUpdatedBy: 2,
        publicAccesLevel: 'private',
        archived: false,
        owner_ref: 'defg',
        tokens: {
          readAndWrite: '1abcd',
          readAndWritePrefix: '1',
          readOnly: 'neiotsranteoia',
        },
      }
    })

    describe('project not being archived or trashed', function () {
      it('should produce a model of the project', function () {
        const result = this.ProjectController._buildProjectViewModel(
          this.project,
          'readAndWrite',
          'owner',
          this.user._id
        )
        expect(result).to.exist
        expect(result).to.be.an('object')
        expect(result).to.deep.equal({
          id: 'abcd',
          name: 'netsenits',
          lastUpdated: 1,
          lastUpdatedBy: 2,
          publicAccessLevel: 'private',
          accessLevel: 'readAndWrite',
          source: 'owner',
          archived: false,
          trashed: false,
          owner_ref: 'defg',
          isV1Project: false,
        })
      })
    })

    describe('project being simultaneously archived and trashed', function () {
      beforeEach(function () {
        this.ProjectHelper.isArchived.returns(true)
        this.ProjectHelper.isTrashed.returns(true)
      })

      it('should produce a model of the project', function () {
        const result = this.ProjectController._buildProjectViewModel(
          this.project,
          'readAndWrite',
          'owner',
          this.user._id
        )
        expect(result).to.exist
        expect(result).to.be.an('object')
        expect(result).to.deep.equal({
          id: 'abcd',
          name: 'netsenits',
          lastUpdated: 1,
          lastUpdatedBy: 2,
          publicAccessLevel: 'private',
          accessLevel: 'readAndWrite',
          source: 'owner',
          archived: true,
          trashed: false,
          owner_ref: 'defg',
          isV1Project: false,
        })
      })
    })

    describe('when token-read-only access', function () {
      it('should redact the owner and last-updated data', function () {
        const result = this.ProjectController._buildProjectViewModel(
          this.project,
          'readOnly',
          'token',
          this.user._id
        )
        expect(result).to.exist
        expect(result).to.be.an('object')
        expect(result).to.deep.equal({
          id: 'abcd',
          name: 'netsenits',
          lastUpdated: 1,
          lastUpdatedBy: null,
          publicAccessLevel: 'private',
          accessLevel: 'readOnly',
          source: 'token',
          archived: false,
          trashed: false,
          owner_ref: null,
          isV1Project: false,
        })
      })
    })
  })
  describe('_isInPercentageRollout', function () {
    before(function () {
      this.ids = [
        '5a05cd7621f9fe22be131740',
        '5a05cd7821f9fe22be131741',
        '5a05cd7921f9fe22be131742',
        '5a05cd7a21f9fe22be131743',
        '5a05cd7b21f9fe22be131744',
        '5a05cd7c21f9fe22be131745',
        '5a05cd7d21f9fe22be131746',
        '5a05cd7e21f9fe22be131747',
        '5a05cd7f21f9fe22be131748',
        '5a05cd8021f9fe22be131749',
        '5a05cd8021f9fe22be13174a',
        '5a05cd8121f9fe22be13174b',
        '5a05cd8221f9fe22be13174c',
        '5a05cd8221f9fe22be13174d',
        '5a05cd8321f9fe22be13174e',
        '5a05cd8321f9fe22be13174f',
        '5a05cd8421f9fe22be131750',
        '5a05cd8421f9fe22be131751',
        '5a05cd8421f9fe22be131752',
        '5a05cd8521f9fe22be131753',
      ]
    })

    it('should produce the expected results', function () {
      expect(
        this.ids.map(i =>
          this.ProjectController._isInPercentageRollout('abcd', i, 50)
        )
      ).to.deep.equal([
        false,
        false,
        false,
        false,
        false,
        false,
        true,
        false,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        true,
        false,
        true,
      ])
      expect(
        this.ids.map(i =>
          this.ProjectController._isInPercentageRollout('efgh', i, 50)
        )
      ).to.deep.equal([
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        true,
        false,
        false,
        true,
        true,
        true,
        false,
        true,
        false,
        true,
        true,
        false,
        false,
      ])
    })
  })
})
