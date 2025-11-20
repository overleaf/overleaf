import { beforeEach, describe, it, vi, expect } from 'vitest'

import path from 'node:path'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
const { ObjectId } = mongodb

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Project/ProjectController'
)

describe('ProjectController', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = new ObjectId('abcdefabcdefabcdefabcdef')

    ctx.user = {
      _id: new ObjectId('123456123456123456123456'),
      email: 'test@overleaf.com',
      first_name: 'bjkdsjfk',
      features: {},
      emails: [{ email: 'test@overleaf.com' }],
    }
    ctx.settings = {
      apis: {
        chat: {
          url: 'chat.com',
        },
      },
      siteUrl: 'https://overleaf.com',
      algolia: {},
      plans: [],
      features: {},
      localizedPlanPricing: {
        USD: {
          collaborator: {
            monthly: 15,
            annual: 180,
            annualDividedByTwelve: 15,
            monthlyTimesTwelve: 180,
          },
        },
      },
    }
    ctx.brandVariationDetails = {
      id: '12',
      active: true,
      brand_name: 'The journal',
      home_url: 'http://www.thejournal.com/',
      publish_menu_link_html: 'Submit your paper to the <em>The Journal</em>',
    }
    ctx.token = 'some-token'
    ctx.ProjectDeleter = {
      promises: {
        deleteProject: sinon.stub().resolves(),
        restoreProject: sinon.stub().resolves(),
      },
      findArchivedProjects: sinon.stub(),
    }
    ctx.ProjectDuplicator = {
      promises: {
        duplicate: sinon.stub().resolves({ _id: ctx.project_id }),
      },
    }
    ctx.ProjectCreationHandler = {
      promises: {
        createExampleProject: sinon.stub().resolves({ _id: ctx.project_id }),
        createBasicProject: sinon.stub().resolves({ _id: ctx.project_id }),
      },
    }
    ctx.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(),
      },
    }
    ctx.SubscriptionController = {
      getRecommendedCurrency: sinon.stub().resolves({ currency: 'USD' }),
      promises: {
        getRecommendedCurrency: sinon.stub().resolves({ currency: 'USD' }),
      },
    }
    ctx.LimitationsManager = {
      hasPaidSubscription: sinon.stub(),
      promises: {
        userIsMemberOfGroupSubscription: sinon.stub().resolves(false),
      },
    }
    ctx.TagsHandler = {
      promises: {
        getTagsForProject: sinon.stub().resolves([
          {
            name: 'test',
            project_ids: [ctx.project_id],
          },
        ]),
      },
      addProjectToTags: sinon.stub(),
    }
    ctx.UserModel = {
      findById: sinon.stub().returns({ exec: sinon.stub().resolves() }),
      updateOne: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }
    ctx.AuthorizationManager = {
      promises: {
        getPrivilegeLevelForProject: sinon.stub(),
      },
      isRestrictedUser: sinon.stub().returns(false),
    }
    ctx.EditorController = {
      promises: {
        renameProject: sinon.stub().resolves(),
      },
    }
    ctx.InactiveProjectManager = {
      promises: { reactivateProjectIfRequired: sinon.stub() },
    }
    ctx.ProjectUpdateHandler = {
      promises: {
        markAsOpened: sinon.stub().resolves(),
      },
    }
    ctx.ProjectGetter = {
      promises: {
        findAllUsersProjects: sinon.stub().resolves(),
        getProject: sinon.stub().resolves(),
      },
    }
    ctx.ProjectHelper = {
      isArchived: sinon.stub(),
      isTrashed: sinon.stub(),
      isArchivedOrTrashed: sinon.stub(),
      getAllowedImagesForUser: sinon.stub().returns([]),
    }
    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(ctx.user._id),
      getSessionUser: sinon.stub().returns(ctx.user),
      isUserLoggedIn: sinon.stub().returns(true),
    }
    ctx.UserController = {
      logout: sinon.stub(),
    }
    ctx.TokenAccessHandler = {
      getRequestToken: sinon.stub().returns(ctx.token),
    }
    ctx.CollaboratorsGetter = {
      promises: {
        userIsTokenMember: sinon.stub().resolves(false),
        isUserInvitedMemberOfProject: sinon.stub().resolves(true),
        userIsReadWriteTokenMember: sinon.stub().resolves(false),
        isUserInvitedReadWriteMemberOfProject: sinon.stub().resolves(true),
      },
    }
    ctx.CollaboratorsHandler = {
      promises: {
        setCollaboratorPrivilegeLevel: sinon.stub().resolves(),
      },
    }
    ctx.ProjectEntityHandler = {}
    ctx.UserGetter = {
      getUserFullEmails: sinon.stub().yields(null, []),
      getUser: sinon.stub().resolves({ lastLoginIp: '192.170.18.2' }),
      promises: {
        getUserFeatures: sinon.stub().resolves(null, { collaborators: 1 }),
      },
    }
    ctx.Features = {
      hasFeature: sinon.stub(),
    }
    ctx.FeaturesUpdater = {
      featuresEpochIsCurrent: sinon.stub().returns(true),
      promises: {
        refreshFeatures: sinon.stub().resolves(ctx.user),
      },
    }
    ctx.BrandVariationsHandler = {
      promises: {
        getBrandVariationById: sinon.stub().resolves(ctx.brandVariationDetails),
      },
    }
    ctx.TpdsProjectFlusher = {
      promises: {
        flushProjectToTpdsIfNeeded: sinon.stub().resolves(),
      },
    }
    ctx.Metrics = {
      Timer: class {
        done() {}
      },
      inc: sinon.stub(),
    }
    ctx.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
        getAssignmentForUser: sinon.stub().resolves({ variant: 'default' }),
        hasUserBeenAssignedToVariant: sinon.stub().resolves(false),
      },
      getAssignment: sinon.stub().yields(null, { variant: 'default' }),
    }
    ctx.SplitTestSessionHandler = {
      promises: {
        sessionMaintenance: sinon.stub().resolves(),
      },
    }
    ctx.InstitutionsFeatures = {
      promises: {
        hasLicence: sinon.stub().resolves(false),
      },
    }
    ctx.InstitutionsGetter = {
      promises: {
        getCurrentAffiliations: sinon.stub().resolves([]),
      },
    }
    ctx.SurveyHandler = {
      getSurvey: sinon.stub().yields(null, {}),
    }
    ctx.ProjectAuditLogHandler = {
      addEntryIfManagedInBackground: sinon.stub().resolves(),
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }
    ctx.TutorialHandler = {
      getInactiveTutorials: sinon.stub().returns([]),
    }
    ctx.OnboardingDataCollectionManager = {
      getOnboardingDataValue: sinon.stub().resolves(null),
    }
    ctx.Modules = {
      promises: { hooks: { fire: sinon.stub().resolves() } },
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
      '../../../../app/src/Features/Collaborators/CollaboratorsHandler',
      () => ({
        default: ctx.CollaboratorsHandler,
      })
    )

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

    vi.doMock('../../../../app/src/Features/Project/ProjectDeleter', () => ({
      default: ctx.ProjectDeleter,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectDuplicator', () => ({
      default: ctx.ProjectDuplicator,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectCreationHandler',
      () => ({
        default: ctx.ProjectCreationHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Editor/EditorController', () => ({
      default: ctx.EditorController,
    }))

    vi.doMock('../../../../app/src/Features/User/UserController', () => ({
      default: ctx.UserController,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectHelper', () => ({
      default: ctx.ProjectHelper,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionController',
      () => ({
        default: ctx.SubscriptionController,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/LimitationsManager',
      () => ({
        default: ctx.LimitationsManager,
      })
    )

    vi.doMock('../../../../app/src/Features/Tags/TagsHandler', () => ({
      default: ctx.TagsHandler,
    }))

    vi.doMock('../../../../app/src/models/User', () => ({
      User: ctx.UserModel,
    }))

    vi.doMock('../../../../app/src/models/Subscription', () => ({}))

    vi.doMock(
      '../../../../app/src/Features/Authorization/AuthorizationManager',
      () => ({
        default: ctx.AuthorizationManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/InactiveData/InactiveProjectManager',
      () => ({
        default: ctx.InactiveProjectManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectUpdateHandler',
      () => ({
        default: ctx.ProjectUpdateHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectDetailsHandler',
      () => ({
        default: ctx.ProjectDetailsHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/TokenAccess/TokenAccessHandler',
      () => ({
        default: ctx.TokenAccessHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter',
      () => ({
        default: ctx.CollaboratorsGetter,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityHandler',
      () => ({
        default: ctx.ProjectEntityHandler,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: ctx.Features,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/FeaturesUpdater',
      () => ({
        default: ctx.FeaturesUpdater,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/BrandVariations/BrandVariationsHandler',
      () => ({
        default: ctx.BrandVariationsHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsProjectFlusher',
      () => ({
        default: ctx.TpdsProjectFlusher,
      })
    )

    vi.doMock('../../../../app/src/models/Project', () => ({}))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: {
          recordEventForUserInBackground: () => {},
        },
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionViewModelBuilder',
      () => ({
        default: ctx.SubscriptionViewModelBuilder,
      })
    )

    vi.doMock('../../../../app/src/Features/Spelling/SpellingHandler', () => ({
      default: {
        promises: {
          getUserDictionary: sinon.stub().resolves([]),
        },
      },
    }))

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsFeatures',
      () => ({
        default: ctx.InstitutionsFeatures,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsGetter',
      () => ({
        default: ctx.InstitutionsGetter,
      })
    )

    vi.doMock('../../../../app/src/Features/Survey/SurveyHandler', () => ({
      default: ctx.SurveyHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectAuditLogHandler',
      () => ({
        default: ctx.ProjectAuditLogHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Tutorial/TutorialHandler', () => ({
      default: ctx.TutorialHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/OnboardingDataCollection/OnboardingDataCollectionManager',
      () => ({
        default: ctx.OnboardingDataCollectionManager,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: {
        promises: {
          updateUser: sinon.stub().resolves(),
        },
      },
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    ctx.ProjectController = (await import(MODULE_PATH)).default

    ctx.projectName = '£12321jkj9ujkljds'
    ctx.req = {
      query: {},
      params: {
        Project_id: ctx.project_id,
      },
      headers: {},
      connection: {
        remoteAddress: '192.170.18.1',
      },
      session: {
        user: ctx.user,
      },
      body: {
        projectName: ctx.projectName,
      },
      i18n: {
        translate() {},
      },
      ip: '192.170.18.1',
      capabilitySet: new Set(['chat']),
    }
    ctx.res = {
      locals: {
        jsPath: 'js path here',
      },
      setTimeout: sinon.stub(),
    }
  })

  describe('updateProjectSettings', function () {
    beforeEach(function (ctx) {
      ctx.req.params.Project_id = ctx.project_id.toString()
    })

    it('should update the name', async function (ctx) {
      await new Promise(resolve => {
        ctx.EditorController.promises.renameProject = sinon.stub().resolves()
        ctx.req.body = { name: (ctx.projectName = 'New name') }
        ctx.res.sendStatus = code => {
          ctx.EditorController.promises.renameProject
            .calledWith(ctx.project_id, ctx.projectName)
            .should.equal(true)
          code.should.equal(204)
          resolve()
        }
        ctx.ProjectController.updateProjectSettings(ctx.req, ctx.res)
      })
    })

    it('should update the compiler', async function (ctx) {
      await new Promise(resolve => {
        ctx.EditorController.promises.setCompiler = sinon.stub().resolves()
        ctx.req.body = { compiler: (ctx.compiler = 'pdflatex') }
        ctx.res.sendStatus = code => {
          ctx.EditorController.promises.setCompiler
            .calledWith(ctx.project_id, ctx.compiler)
            .should.equal(true)
          code.should.equal(204)
          resolve()
        }
        ctx.ProjectController.updateProjectSettings(ctx.req, ctx.res)
      })
    })

    it('should update the imageName', async function (ctx) {
      await new Promise(resolve => {
        ctx.EditorController.promises.setImageName = sinon.stub().resolves()
        ctx.req.body = { imageName: (ctx.imageName = 'texlive-1234.5') }
        ctx.res.sendStatus = code => {
          ctx.EditorController.promises.setImageName
            .calledWith(ctx.project_id, ctx.imageName)
            .should.equal(true)
          code.should.equal(204)
          resolve()
        }
        ctx.ProjectController.updateProjectSettings(ctx.req, ctx.res)
      })
    })

    it('should update the spell check language', async function (ctx) {
      await new Promise(resolve => {
        ctx.EditorController.promises.setSpellCheckLanguage = sinon
          .stub()
          .resolves()
        ctx.req.body = { spellCheckLanguage: (ctx.languageCode = 'fr') }
        ctx.res.sendStatus = code => {
          ctx.EditorController.promises.setSpellCheckLanguage
            .calledWith(ctx.project_id, ctx.languageCode)
            .should.equal(true)
          code.should.equal(204)
          resolve()
        }
        ctx.ProjectController.updateProjectSettings(ctx.req, ctx.res)
      })
    })

    it('should update the root doc', async function (ctx) {
      await new Promise(resolve => {
        ctx.EditorController.promises.setRootDoc = sinon.stub().resolves()
        ctx.req.body = {
          rootDocId: (ctx.rootDocId = 'abc123def456abc123def456'),
        }
        ctx.res.sendStatus = code => {
          ctx.EditorController.promises.setRootDoc
            .calledWith(ctx.project_id, ctx.rootDocId)
            .should.equal(true)
          code.should.equal(204)
          resolve()
        }
        ctx.ProjectController.updateProjectSettings(ctx.req, ctx.res)
      })
    })
  })

  describe('updateProjectAdminSettings', function () {
    it('should update the public access level', async function (ctx) {
      ctx.Features.hasFeature.withArgs('link-sharing').returns(true)

      ctx.EditorController.promises.setPublicAccessLevel = sinon
        .stub()
        .resolves()
      ctx.req.params.Project_id = ctx.project_id.toString()
      ctx.req.body = {
        publicAccessLevel: 'tokenBased',
      }
      await new Promise(resolve => {
        ctx.res.sendStatus = code => {
          ctx.EditorController.promises.setPublicAccessLevel
            .calledWith(ctx.project_id, 'tokenBased')
            .should.equal(true)
          code.should.equal(204)
          resolve()
        }
        ctx.ProjectController.updateProjectAdminSettings(ctx.req, ctx.res)
      })
    })

    it('should record the change in the project audit log', async function (ctx) {
      ctx.Features.hasFeature.withArgs('link-sharing').returns(true)
      ctx.EditorController.promises.setPublicAccessLevel = sinon
        .stub()
        .resolves()
      ctx.req.body = {
        publicAccessLevel: 'tokenBased',
      }
      ctx.req.params.Project_id = ctx.project_id.toString()
      await new Promise(resolve => {
        ctx.res.sendStatus = code => {
          ctx.ProjectAuditLogHandler.promises.addEntry
            .calledWith(
              ctx.project_id,
              'toggle-access-level',
              ctx.user._id,
              ctx.req.ip,
              {
                publicAccessLevel: 'tokenBased',
                status: 'OK',
              }
            )
            .should.equal(true)
          resolve()
        }
        ctx.ProjectController.updateProjectAdminSettings(ctx.req, ctx.res)
      })
    })

    it('should refuse to update the public access level when link sharing is disabled', async function (ctx) {
      ctx.Features.hasFeature.withArgs('link-sharing').returns(false)
      ctx.EditorController.promises.setPublicAccessLevel = sinon
        .stub()
        .resolves()
      ctx.req.params.Project_id = ctx.project_id.toString()
      ctx.req.body = {
        publicAccessLevel: 'tokenBased',
      }
      await new Promise(resolve => {
        ctx.res.sendStatus = code => {
          ctx.EditorController.promises.setPublicAccessLevel.called.should.equal(
            false
          )
          code.should.equal(403) // Forbidden
          resolve()
        }
        ctx.ProjectController.updateProjectAdminSettings(ctx.req, ctx.res)
      })
    })
  })

  describe('deleteProject', function () {
    it('should call the project deleter', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.sendStatus = code => {
          ctx.ProjectDeleter.promises.deleteProject
            .calledWith(ctx.project_id, {
              deleterUser: ctx.user,
              ipAddress: ctx.req.ip,
            })
            .should.equal(true)
          code.should.equal(200)
          resolve()
        }
        ctx.ProjectController.deleteProject(ctx.req, ctx.res)
      })
    })
  })

  describe('restoreProject', function () {
    it('should tell the project deleter', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.sendStatus = code => {
          ctx.ProjectDeleter.promises.restoreProject
            .calledWith(ctx.project_id)
            .should.equal(true)
          code.should.equal(200)
          resolve()
        }
        ctx.ProjectController.restoreProject(ctx.req, ctx.res)
      })
    })
  })

  describe('cloneProject', function () {
    it('should call the project duplicator', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.json = json => {
          ctx.ProjectDuplicator.promises.duplicate
            .calledWith(ctx.user, ctx.project_id, ctx.projectName)
            .should.equal(true)
          json.project_id.should.equal(ctx.project_id)
          resolve()
        }
        ctx.ProjectController.cloneProject(ctx.req, ctx.res)
      })
    })
  })

  describe('newProject', function () {
    it('should call the projectCreationHandler with createExampleProject', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body.template = 'example'
        ctx.res.json = json => {
          ctx.ProjectCreationHandler.promises.createExampleProject
            .calledWith(ctx.user._id, ctx.projectName)
            .should.equal(true)
          ctx.ProjectCreationHandler.promises.createBasicProject.called.should.equal(
            false
          )
          resolve()
        }
        ctx.ProjectController.newProject(ctx.req, ctx.res)
      })
    })

    it('should call the projectCreationHandler with createBasicProject', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body.template = 'basic'
        ctx.res.json = json => {
          ctx.ProjectCreationHandler.promises.createExampleProject.called.should.equal(
            false
          )
          ctx.ProjectCreationHandler.promises.createBasicProject
            .calledWith(ctx.user._id, ctx.projectName)
            .should.equal(true)
          resolve()
        }
        ctx.ProjectController.newProject(ctx.req, ctx.res)
      })
    })

    it('adds project audit log for managed for managed users', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body.template = 'basic'
        ctx.res.json = () => {
          expect(ctx.ProjectAuditLogHandler.addEntryIfManagedInBackground).to
            .have.been.called
          resolve()
        }
        ctx.ProjectController.newProject(ctx.req, ctx.res)
      })
    })
  })

  describe('renameProject', function () {
    beforeEach(function (ctx) {
      ctx.newProjectName = 'my supper great new project'
      ctx.req.body.newProjectName = ctx.newProjectName
      ctx.req.params.Project_id = ctx.project_id.toString()
    })

    it('should call the editor controller', async function (ctx) {
      await new Promise(resolve => {
        ctx.EditorController.promises.renameProject.resolves()
        ctx.res.sendStatus = code => {
          code.should.equal(200)

          expect(ctx.EditorController.promises.renameProject).to.have.been
            .called
          expect(
            ctx.EditorController.promises.renameProject.args[0][0].toString()
          ).to.equal(ctx.project_id.toString())
          expect(
            ctx.EditorController.promises.renameProject.args[0][1]
          ).to.equal(ctx.newProjectName)

          resolve()
        }
        ctx.ProjectController.renameProject(ctx.req, ctx.res)
      })
    })

    it('should send an error to next() if there is a problem', async function (ctx) {
      await new Promise(resolve => {
        let error
        ctx.EditorController.promises.renameProject.rejects(
          (error = new Error('problem'))
        )
        const next = e => {
          e.should.equal(error)
          resolve()
        }
        ctx.ProjectController.renameProject(ctx.req, ctx.res, next)
      })
    })
  })

  describe('loadEditor', function () {
    beforeEach(function (ctx) {
      ctx.settings.editorIsOpen = true
      ctx.project = {
        name: 'my proj',
        _id: '213123kjlkj',
        owner_ref: '59fc84d5fbea77482d436e1b',
      }
      ctx.brandedProject = {
        name: 'my branded proj',
        _id: '3252332',
        owner_ref: '59fc84d5fbea77482d436e1b',
        brandVariationId: '12',
      }
      ctx.user = {
        _id: ctx.user._id,
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
      ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
      ctx.UserModel.findById.returns({
        exec: sinon.stub().resolves(ctx.user),
      })
      ctx.SubscriptionLocator.promises.getUsersSubscription.resolves({})
      ctx.AuthorizationManager.promises.getPrivilegeLevelForProject.resolves(
        'owner'
      )
      ctx.ProjectDeleter.unmarkAsDeletedByExternalSource = sinon.stub()
      ctx.InactiveProjectManager.promises.reactivateProjectIfRequired.resolves()
      ctx.ProjectUpdateHandler.promises.markAsOpened.resolves()
    })

    it('should render the project/ide-react page', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          pageName.should.equal('project/ide-react')
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should redirect to domain capture page', async function (ctx) {
      ctx.Features.hasFeature.withArgs('saas').returns(true)
      ctx.SplitTestHandler.promises.getAssignment
        .withArgs(ctx.req, ctx.res, 'domain-capture-redirect')
        .resolves({ variant: 'enabled' })
      ctx.Modules.promises.hooks.fire
        .withArgs('findDomainCaptureGroupUserCouldBePartOf', ctx.user._id)
        .resolves([{ _id: new ObjectId(), managedUsersEnabled: true }])
      await new Promise(resolve => {
        ctx.res.redirect = url => {
          url.should.equal('/domain-capture')
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should add user', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          opts.user.email.should.equal(ctx.user.email)
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should sanitize refProviders', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (_pageName, opts) => {
          expect(opts.user.refProviders).to.deep.equal({
            mendeley: true,
            zotero: true,
          })
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should add on userSettings', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          opts.userSettings.fontSize.should.equal(ctx.user.ace.fontSize)
          opts.userSettings.editorTheme.should.equal(ctx.user.ace.theme)
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should add isRestrictedTokenMember', async function (ctx) {
      await new Promise(resolve => {
        ctx.AuthorizationManager.isRestrictedUser.returns(false)
        ctx.res.render = (pageName, opts) => {
          opts.isRestrictedTokenMember.should.exist
          opts.isRestrictedTokenMember.should.equal(false)
          return resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should set isRestrictedTokenMember when appropriate', async function (ctx) {
      await new Promise(resolve => {
        ctx.AuthorizationManager.isRestrictedUser.returns(true)
        ctx.res.render = (pageName, opts) => {
          opts.isRestrictedTokenMember.should.exist
          opts.isRestrictedTokenMember.should.equal(true)
          return resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should invoke the session maintenance for logged in user', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = () => {
          ctx.SplitTestSessionHandler.promises.sessionMaintenance.should.have.been.calledWith(
            ctx.req,
            ctx.user
          )
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should invoke the session maintenance for anonymous user', async function (ctx) {
      await new Promise(resolve => {
        ctx.SessionManager.getLoggedInUserId.returns(null)
        ctx.res.render = () => {
          ctx.SplitTestSessionHandler.promises.sessionMaintenance.should.have.been.calledWith(
            ctx.req
          )
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should render the closed page if the editor is closed', async function (ctx) {
      await new Promise(resolve => {
        ctx.settings.editorIsOpen = false
        ctx.res.render = (pageName, opts) => {
          pageName.should.equal('general/closed')
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should not render the page if the project can not be accessed', async function (ctx) {
      await new Promise(resolve => {
        ctx.AuthorizationManager.promises.getPrivilegeLevelForProject = sinon
          .stub()
          .resolves(null)
        ctx.res.sendStatus = (resCode, opts) => {
          resCode.should.equal(401)
          ctx.AuthorizationManager.promises.getPrivilegeLevelForProject.should.have.been.calledWith(
            ctx.user._id,
            ctx.project_id,
            'some-token'
          )
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should reactivateProjectIfRequired', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          ctx.InactiveProjectManager.promises.reactivateProjectIfRequired
            .calledWith(ctx.project_id)
            .should.equal(true)
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should mark user as active', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          expect(ctx.UserModel.updateOne).to.have.been.calledOnce
          expect(ctx.UserModel.updateOne.args[0][0]).to.deep.equal({
            _id: new ObjectId(ctx.user._id),
          })
          expect(ctx.UserModel.updateOne.args[0][1].$set.lastActive).to.exist
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should mark project as opened', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          ctx.ProjectUpdateHandler.promises.markAsOpened
            .calledWith(ctx.project_id)
            .should.equal(true)
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should call the brand variations handler for branded projects', async function (ctx) {
      await new Promise(resolve => {
        ctx.ProjectGetter.promises.getProject.resolves(ctx.brandedProject)
        ctx.res.render = (pageName, opts) => {
          ctx.BrandVariationsHandler.promises.getBrandVariationById
            .calledWith()
            .should.equal(true)
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should not call the brand variations handler for unbranded projects', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = (pageName, opts) => {
          ctx.BrandVariationsHandler.promises.getBrandVariationById.called.should.equal(
            false
          )
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should expose the brand variation details as locals for branded projects', async function (ctx) {
      await new Promise(resolve => {
        ctx.ProjectGetter.promises.getProject.resolves(ctx.brandedProject)
        ctx.res.render = (pageName, opts) => {
          opts.brandVariation.should.deep.equal(ctx.brandVariationDetails)
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('flushes the project to TPDS if a flush is pending', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.render = () => {
          ctx.TpdsProjectFlusher.promises.flushProjectToTpdsIfNeeded.should.have.been.calledWith(
            ctx.project_id
          )
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    it('should refresh the user features if the epoch is outdated', async function (ctx) {
      await new Promise(resolve => {
        ctx.FeaturesUpdater.featuresEpochIsCurrent = sinon.stub().returns(false)
        ctx.res.render = () => {
          ctx.FeaturesUpdater.promises.refreshFeatures.should.have.been.calledWith(
            ctx.user._id,
            'load-editor'
          )
          resolve()
        }
        ctx.ProjectController.loadEditor(ctx.req, ctx.res)
      })
    })

    describe('wsUrl', function () {
      function checkLoadEditorWsMetric(metric) {
        it(`should inc metric ${metric}`, async function (ctx) {
          await new Promise(resolve => {
            ctx.res.render = () => {
              ctx.Metrics.inc.calledWith(metric).should.equal(true)
              resolve()
            }
            ctx.ProjectController.loadEditor(ctx.req, ctx.res)
          })
        })
      }
      function checkWsFallback(isBeta, isV2) {
        describe('with ws=fallback', function () {
          beforeEach(function (ctx) {
            ctx.req.query = {}
            ctx.req.query.ws = 'fallback'
          })
          it('should unset the wsUrl', async function (ctx) {
            await new Promise(resolve => {
              ctx.res.render = (pageName, opts) => {
                ;(opts.wsUrl || '/socket.io').should.equal('/socket.io')
                resolve()
              }
              ctx.ProjectController.loadEditor(ctx.req, ctx.res)
            })
          })
          checkLoadEditorWsMetric(
            `load-editor-ws${isBeta ? '-beta' : ''}${
              isV2 ? '-v2' : ''
            }-fallback`
          )
        })
      }

      beforeEach(function (ctx) {
        ctx.settings.wsUrl = '/other.socket.io'
      })
      it('should set the custom wsUrl', async function (ctx) {
        await new Promise(resolve => {
          ctx.res.render = (pageName, opts) => {
            opts.wsUrl.should.equal('/other.socket.io')
            resolve()
          }
          ctx.ProjectController.loadEditor(ctx.req, ctx.res)
        })
      })
      checkLoadEditorWsMetric('load-editor-ws')
      checkWsFallback(false)

      describe('beta program', function () {
        beforeEach(function (ctx) {
          ctx.settings.wsUrlBeta = '/beta.socket.io'
        })
        describe('for a normal user', function () {
          it('should set the normal custom wsUrl', async function (ctx) {
            await new Promise(resolve => {
              ctx.res.render = (pageName, opts) => {
                opts.wsUrl.should.equal('/other.socket.io')
                resolve()
              }
              ctx.ProjectController.loadEditor(ctx.req, ctx.res)
            })
          })
          checkLoadEditorWsMetric('load-editor-ws')
          checkWsFallback(false)
        })

        describe('for a beta user', function () {
          beforeEach(function (ctx) {
            ctx.user.betaProgram = true
          })
          it('should set the beta wsUrl', async function (ctx) {
            await new Promise(resolve => {
              ctx.res.render = (pageName, opts) => {
                opts.wsUrl.should.equal('/beta.socket.io')
                resolve()
              }
              ctx.ProjectController.loadEditor(ctx.req, ctx.res)
            })
          })
          checkLoadEditorWsMetric('load-editor-ws-beta')
          checkWsFallback(true)
        })
      })

      describe('v2-rollout', function () {
        beforeEach(function (ctx) {
          ctx.settings.wsUrlBeta = '/beta.socket.io'
          ctx.settings.wsUrlV2 = '/socket.io.v2'
        })

        function checkNonMatch() {
          it('should set the normal custom wsUrl', async function (ctx) {
            await new Promise(resolve => {
              ctx.res.render = (pageName, opts) => {
                opts.wsUrl.should.equal('/other.socket.io')
                resolve()
              }
              ctx.ProjectController.loadEditor(ctx.req, ctx.res)
            })
          })
          checkLoadEditorWsMetric('load-editor-ws')
          checkWsFallback(false)
        }
        function checkMatch() {
          it('should set the v2 wsUrl', async function (ctx) {
            await new Promise(resolve => {
              ctx.res.render = (pageName, opts) => {
                opts.wsUrl.should.equal('/socket.io.v2')
                resolve()
              }
              ctx.ProjectController.loadEditor(ctx.req, ctx.res)
            })
          })
          checkLoadEditorWsMetric('load-editor-ws-v2')
          checkWsFallback(false, true)
        }
        function checkForBetaUser() {
          describe('for a beta user', function () {
            beforeEach(function (ctx) {
              ctx.user.betaProgram = true
            })
            it('should set the beta wsUrl', async function (ctx) {
              await new Promise(resolve => {
                ctx.res.render = (pageName, opts) => {
                  opts.wsUrl.should.equal('/beta.socket.io')
                  resolve()
                }
                ctx.ProjectController.loadEditor(ctx.req, ctx.res)
              })
            })
            checkLoadEditorWsMetric('load-editor-ws-beta')
            checkWsFallback(true)
          })
        }

        describe('when the roll out percentage is 0', function () {
          beforeEach(function (ctx) {
            ctx.settings.wsUrlV2Percentage = 0
          })
          describe('when the projectId does not match (0)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(0)
            })
            checkNonMatch()
          })
          describe('when the projectId does not match (42)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(42)
            })
            checkNonMatch()
          })
          checkForBetaUser()
        })
        describe('when the roll out percentage is 1', function () {
          beforeEach(function (ctx) {
            ctx.settings.wsUrlV2Percentage = 1
          })
          describe('when the projectId matches (0)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(0)
            })
            checkMatch()
            checkForBetaUser()
          })
          describe('when the projectId does not match (1)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(1)
            })
            checkNonMatch()
            checkForBetaUser()
          })
          describe('when the projectId does not match (42)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(42)
            })
            checkNonMatch()
          })
        })
        describe('when the roll out percentage is 10', function () {
          beforeEach(function (ctx) {
            ctx.settings.wsUrlV2Percentage = 10
          })
          describe('when the projectId matches (0)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(0)
            })
            checkMatch()
          })
          describe('when the projectId matches (9)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(9)
            })
            checkMatch()
            checkForBetaUser()
          })
          describe('when the projectId does not match (10)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(10)
            })
            checkNonMatch()
          })
          describe('when the projectId does not match (42)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(42)
            })
            checkNonMatch()
            checkForBetaUser()
          })
        })
        describe('when the roll out percentage is 100', function () {
          beforeEach(function (ctx) {
            ctx.settings.wsUrlV2Percentage = 100
          })
          describe('when the projectId matches (0)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(0)
            })
            checkMatch()
            checkForBetaUser()
          })
          describe('when the projectId matches (10)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(10)
            })
            checkMatch()
          })
          describe('when the projectId matches (42)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(42)
            })
            checkMatch()
          })
          describe('when the projectId matches (99)', function () {
            beforeEach(function (ctx) {
              ctx.req.params.Project_id = ObjectId.createFromTime(99)
            })
            checkMatch()
          })
        })
      })
    })

    describe('upgrade prompt (on header and share project modal)', function () {
      beforeEach(function (ctx) {
        // default to saas enabled
        ctx.Features.hasFeature.withArgs('saas').returns(true)
        // default to without a subscription
        ctx.SubscriptionLocator.promises.getUsersSubscription = sinon
          .stub()
          .resolves(null)
      })
      it('should not show without the saas feature', async function (ctx) {
        ctx.Features.hasFeature.withArgs('saas').returns(false)
        await new Promise(resolve => {
          ctx.res.render = (pageName, opts) => {
            expect(opts.showUpgradePrompt).to.equal(false)
            resolve()
          }
          ctx.ProjectController.loadEditor(ctx.req, ctx.res)
        })
      })
      it('should show for a user without a subscription or only non-paid affiliations', async function (ctx) {
        await new Promise(resolve => {
          ctx.res.render = (pageName, opts) => {
            expect(opts.showUpgradePrompt).to.equal(true)
            resolve()
          }
          ctx.ProjectController.loadEditor(ctx.req, ctx.res)
        })
      })
      it('should not show for a user with a personal subscription', async function (ctx) {
        ctx.SubscriptionLocator.promises.getUsersSubscription = sinon
          .stub()
          .resolves({})
        await new Promise(resolve => {
          ctx.res.render = (pageName, opts) => {
            expect(opts.showUpgradePrompt).to.equal(false)
            resolve()
          }
          ctx.ProjectController.loadEditor(ctx.req, ctx.res)
        })
      })
      it('should not show for a user who is a member of a group subscription', async function (ctx) {
        ctx.InstitutionsFeatures.promises.hasLicence = sinon
          .stub()
          .resolves(true)
        await new Promise(resolve => {
          ctx.res.render = (pageName, opts) => {
            expect(opts.showUpgradePrompt).to.equal(false)
            resolve()
          }
          ctx.ProjectController.loadEditor(ctx.req, ctx.res)
        })
      })
      it('should not show for a user with an affiliated paid university', async function (ctx) {
        await new Promise(resolve => {
          ctx.LimitationsManager.promises.userIsMemberOfGroupSubscription =
            sinon.stub().resolves({ isMember: true })
          ctx.res.render = (pageName, opts) => {
            expect(opts.showUpgradePrompt).to.equal(false)
            resolve()
          }
          ctx.ProjectController.loadEditor(ctx.req, ctx.res)
        })
      })

      describe('when user is a read write token member (and not already a named editor)', function () {
        beforeEach(function (ctx) {
          ctx.CollaboratorsGetter.promises.userIsTokenMember.resolves(true)
          ctx.CollaboratorsGetter.promises.userIsReadWriteTokenMember.resolves(
            true
          )
          ctx.CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject.resolves(
            false
          )
        })

        it('should redirect to the sharing-updates page', async function (ctx) {
          await new Promise(resolve => {
            ctx.res.redirect = url => {
              expect(url).to.equal(`/project/${ctx.project_id}/sharing-updates`)
              resolve()
            }
            ctx.ProjectController.loadEditor(ctx.req, ctx.res)
          })
        })
      })

      describe('when user is a read write token member but also a named editor', function () {
        beforeEach(function (ctx) {
          ctx.CollaboratorsGetter.promises.userIsTokenMember.resolves(true)
          ctx.CollaboratorsGetter.promises.userIsReadWriteTokenMember.resolves(
            true
          )
          ctx.CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject.resolves(
            true
          )
        })

        it('should not redirect to the sharing-updates page, and should load the editor', async function (ctx) {
          await new Promise(resolve => {
            ctx.res.render = (pageName, opts) => {
              resolve()
            }
            ctx.ProjectController.loadEditor(ctx.req, ctx.res)
          })
        })
      })

      it('should call the collaborator limit enforcement check', async function (ctx) {
        await new Promise(resolve => {
          ctx.res.render = (pageName, opts) => {
            ctx.Modules.promises.hooks.fire.should.have.been.calledWith(
              'enforceCollaboratorLimit',
              ctx.project_id
            )
            resolve()
          }
          ctx.ProjectController.loadEditor(ctx.req, ctx.res)
        })
      })
    })

    describe('capabilitySet', function () {
      it('should be passed as an array when loading the editor', async function (ctx) {
        ctx.Features.hasFeature = sinon.stub().withArgs('chat').returns(false)
        await new Promise(resolve => {
          ctx.res.render = (pageName, opts) => {
            expect(opts.capabilities).to.deep.equal(['chat'])
            resolve()
          }
          ctx.ProjectController.loadEditor(ctx.req, ctx.res)
        })
      })
    })
  })

  describe('userProjectsJson', function () {
    beforeEach(function (ctx) {
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

      ctx.ProjectHelper.isArchivedOrTrashed
        .withArgs(projects[0], ctx.user._id)
        .returns(true)
      ctx.ProjectHelper.isArchivedOrTrashed
        .withArgs(projects[1], ctx.user._id)
        .returns(false)
      ctx.ProjectHelper.isArchivedOrTrashed
        .withArgs(projects[2], ctx.user._id)
        .returns(true)
      ctx.ProjectHelper.isArchivedOrTrashed
        .withArgs(projects[3], ctx.user._id)
        .returns(false)

      ctx.ProjectGetter.promises.findAllUsersProjects = sinon
        .stub()
        .resolves([])
      ctx.ProjectController._buildProjectList = sinon.stub().returns(projects)
      ctx.SessionManager.getLoggedInUserId = sinon.stub().returns(ctx.user._id)
    })

    it('should produce a list of projects', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.json = data => {
          expect(data).to.deep.equal({
            projects: [
              { _id: 'b', name: 'B', accessLevel: 'b' },
              { _id: 'd', name: 'D', accessLevel: 'd' },
            ],
          })
          resolve()
        }
        ctx.ProjectController.userProjectsJson(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })
  })

  describe('projectEntitiesJson', function () {
    beforeEach(function (ctx) {
      ctx.SessionManager.getLoggedInUserId = sinon.stub().returns('abc')
      ctx.req.params = { Project_id: 'abcd' }
      ctx.project = { _id: 'abcd' }
      ctx.docs = [
        { path: '/things/b.txt', doc: true },
        { path: '/main.tex', doc: true },
      ]
      ctx.files = [{ path: '/things/a.txt' }]
      ctx.ProjectGetter.promises.getProject = sinon.stub().resolves(ctx.project)
      ctx.ProjectEntityHandler.getAllEntitiesFromProject = sinon
        .stub()
        .returns({ docs: ctx.docs, files: ctx.files })
    })

    it('should produce a list of entities', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.json = data => {
          expect(data).to.deep.equal({
            project_id: 'abcd',
            entities: [
              { path: '/main.tex', type: 'doc' },
              { path: '/things/a.txt', type: 'file' },
              { path: '/things/b.txt', type: 'doc' },
            ],
          })
          expect(ctx.ProjectGetter.promises.getProject.callCount).to.equal(1)
          expect(
            ctx.ProjectEntityHandler.getAllEntitiesFromProject.callCount
          ).to.equal(1)
          resolve()
        }
        ctx.ProjectController.projectEntitiesJson(ctx.req, ctx.res, ctx.next)
      })
    })

    it('should call next with an error if the project file tree is invalid', async function (ctx) {
      ctx.ProjectEntityHandler.getAllEntitiesFromProject = sinon.stub().throws()
      await new Promise(resolve => {
        ctx.next = err => {
          expect(err).to.be.an.instanceof(Error)
          resolve()
        }
        ctx.ProjectController.projectEntitiesJson(ctx.req, ctx.res, ctx.next)
      })
    })
  })

  describe('_buildProjectViewModel', function () {
    beforeEach(function (ctx) {
      ctx.ProjectHelper.isArchived.returns(false)
      ctx.ProjectHelper.isTrashed.returns(false)

      ctx.project = {
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
      it('should produce a model of the project', function (ctx) {
        const result = ctx.ProjectController._buildProjectViewModel(
          ctx.project,
          'readAndWrite',
          'owner',
          ctx.user._id
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
      beforeEach(function (ctx) {
        ctx.ProjectHelper.isArchived.returns(true)
        ctx.ProjectHelper.isTrashed.returns(true)
      })

      it('should produce a model of the project', function (ctx) {
        const result = ctx.ProjectController._buildProjectViewModel(
          ctx.project,
          'readAndWrite',
          'owner',
          ctx.user._id
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
      it('should redact the owner and last-updated data', function (ctx) {
        const result = ctx.ProjectController._buildProjectViewModel(
          ctx.project,
          'readOnly',
          'token',
          ctx.user._id
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
    const ids = [
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

    it('should produce the expected results', function (ctx) {
      expect(
        ids.map(i =>
          ctx.ProjectController._isInPercentageRollout('abcd', i, 50)
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
        ids.map(i =>
          ctx.ProjectController._isInPercentageRollout('efgh', i, 50)
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
