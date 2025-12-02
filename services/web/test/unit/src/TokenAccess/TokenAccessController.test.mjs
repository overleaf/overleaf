import { expect, vi } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import PrivilegeLevels from '../../../../app/src/Features/Authorization/PrivilegeLevels.mjs'
import UrlHelper from '../../../../app/src/Features/Helpers/UrlHelper.mjs'

const { getSafeRedirectPath } = UrlHelper
const ObjectId = mongodb.ObjectId

const MODULE_PATH =
  '../../../../app/src/Features/TokenAccess/TokenAccessController'

describe('TokenAccessController', function () {
  beforeEach(async function (ctx) {
    ctx.token = 'abc123'
    ctx.user = { _id: new ObjectId() }
    ctx.project = {
      _id: new ObjectId(),
      owner_ref: ctx.user._id,
      name: 'test',
      tokenAccessReadAndWrite_refs: [],
      tokenAccessReadOnly_refs: [],
    }
    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub().returns()

    ctx.Settings = {
      siteUrl: 'https://www.dev-overleaf.com',
      adminPrivilegeAvailable: false,
      adminUrl: 'https://admin.dev-overleaf.com',
      adminDomains: ['overleaf.com'],
    }
    ctx.TokenAccessHandler = {
      TOKEN_TYPES: {
        READ_ONLY: 'readOnly',
        READ_AND_WRITE: 'readAndWrite',
      },
      isReadAndWriteToken: sinon.stub().returns(true),
      isReadOnlyToken: sinon.stub().returns(true),
      tokenAccessEnabledForProject: sinon.stub().returns(true),
      checkTokenHashPrefix: sinon.stub(),
      makeTokenUrl: sinon.stub().returns('/'),
      grantSessionTokenAccess: sinon.stub(),
      promises: {
        addReadOnlyUserToProject: sinon.stub().resolves(),
        getProjectByToken: sinon.stub().resolves(ctx.project),
        getV1DocPublishedInfo: sinon.stub().resolves({ allow: true }),
        getV1DocInfo: sinon.stub(),
        removeReadAndWriteUserFromProject: sinon.stub().resolves(),
        moveReadAndWriteUserToReadOnly: sinon.stub().resolves(),
      },
    }

    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(ctx.user._id),
      getSessionUser: sinon.stub().returns(ctx.user._id),
    }

    ctx.AuthenticationController = {
      setRedirectInSession: sinon.stub(),
    }

    ctx.AuthorizationManager = {
      promises: {
        getPrivilegeLevelForProject: sinon
          .stub()
          .resolves(PrivilegeLevels.NONE),
      },
    }

    ctx.AuthorizationMiddleware = {}

    ctx.ProjectAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }

    ctx.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
        getAssignmentForUser: sinon.stub().resolves({ variant: 'default' }),
      },
    }

    ctx.CollaboratorsInviteHandler = {
      promises: {
        revokeInviteForUser: sinon.stub().resolves(),
      },
    }

    ctx.CollaboratorsHandler = {
      promises: {
        addUserIdToProject: sinon.stub().resolves(),
        setCollaboratorPrivilegeLevel: sinon.stub().resolves(),
      },
    }

    ctx.CollaboratorsGetter = {
      promises: {
        userIsReadWriteTokenMember: sinon.stub().resolves(),
        isUserInvitedReadWriteMemberOfProject: sinon.stub().resolves(),
        isUserInvitedMemberOfProject: sinon.stub().resolves(),
      },
    }

    ctx.EditorRealTimeController = { emitToRoom: sinon.stub() }

    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(ctx.project),
      },
    }

    ctx.AnalyticsManager = {
      recordEventForSession: sinon.stub(),
      recordEventForUserInBackground: sinon.stub(),
    }

    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().callsFake(async (userId, filter) => {
          if (userId === ctx.userId) {
            return ctx.user
          } else {
            return null
          }
        }),
        getUserEmail: sinon.stub().resolves(),
        getUserConfirmedEmails: sinon.stub().resolves(),
      },
    }

    ctx.LimitationsManager = {
      promises: {
        canAcceptEditCollaboratorInvite: sinon.stub().resolves(),
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock(
      '../../../../app/src/Features/TokenAccess/TokenAccessHandler',
      () => ({
        default: ctx.TokenAccessHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationController',
      () => ({
        default: ctx.AuthenticationController,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authorization/AuthorizationManager',
      () => ({
        default: ctx.AuthorizationManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authorization/AuthorizationMiddleware',
      () => ({
        default: ctx.AuthorizationMiddleware,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectAuditLogHandler',
      () => ({
        default: ctx.ProjectAuditLogHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Errors/Errors', () => ({
      default: (ctx.Errors = {
        NotFoundError: sinon.stub(),
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsHandler',
      () => ({
        default: ctx.CollaboratorsHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsInviteHandler',
      () => ({
        default: ctx.CollaboratorsInviteHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter',
      () => ({
        default: ctx.CollaboratorsGetter,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Editor/EditorRealTimeController',
      () => ({
        default: ctx.EditorRealTimeController,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock('../../../../app/src/Features/Helpers/AsyncFormHelper', () => ({
      default: (ctx.AsyncFormHelper = {
        redirect: sinon.stub(),
      }),
    }))

    ctx.AdminAuthorizationHelper = {
      canRedirectToAdminDomain: sinon.stub(),
    }

    vi.doMock(
      '../../../../app/src/Features/Helpers/AdminAuthorizationHelper',
      () => ({ default: ctx.AdminAuthorizationHelper })
    )

    vi.doMock('../../../../app/src/Features/Helpers/UrlHelper', () => ({
      default: (ctx.UrlHelper = {
        getSafeAdminDomainRedirect: sinon
          .stub()
          .callsFake(
            path => `${ctx.Settings.adminUrl}${getSafeRedirectPath(path)}`
          ),
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/LimitationsManager',
      () => ({
        default: ctx.LimitationsManager,
      })
    )

    ctx.TokenAccessController = (await import(MODULE_PATH)).default
  })

  describe('grantTokenAccessReadAndWrite', function () {
    beforeEach(function (ctx) {
      ctx.LimitationsManager.promises.canAcceptEditCollaboratorInvite.resolves(
        true
      )
    })

    describe('normal case (edit slot available)', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.canAcceptEditCollaboratorInvite.resolves(
          true
        )
        ctx.req.params = { token: ctx.token }
        ctx.req.body = {
          confirmedByUser: true,
          tokenHashPrefix: '#prefix',
        }
        await new Promise((resolve, reject) => {
          ctx.res.callback = resolve
          ctx.TokenAccessController.grantTokenAccessReadAndWrite(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })

      it('adds the user as a read and write invited member', function (ctx) {
        expect(
          ctx.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          ctx.project._id,
          undefined,
          ctx.user._id,
          PrivilegeLevels.READ_AND_WRITE
        )
      })

      it('writes a project audit log', function (ctx) {
        expect(
          ctx.ProjectAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          ctx.project._id,
          'accept-via-link-sharing',
          ctx.user._id,
          ctx.req.ip,
          { privileges: 'readAndWrite' }
        )
      })

      it('records a project-joined event for the user', function (ctx) {
        expect(
          ctx.AnalyticsManager.recordEventForUserInBackground
        ).to.have.been.calledWith(ctx.user._id, 'project-joined', {
          mode: 'edit',
          projectId: ctx.project._id.toString(),
          ownerId: ctx.project.owner_ref.toString(),
          role: PrivilegeLevels.READ_AND_WRITE,
          source: 'link-sharing',
        })
      })

      it('emits a project membership changed event', function (ctx) {
        expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
          ctx.project._id,
          'project:membership:changed',
          { members: true, invites: true }
        )
      })

      it('checks token hash', function (ctx) {
        expect(
          ctx.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          ctx.token,
          '#prefix',
          'readAndWrite',
          ctx.user._id,
          { projectId: ctx.project._id, action: 'continue' }
        )
      })
    })

    describe('when there are no edit collaborator slots available', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.canAcceptEditCollaboratorInvite.resolves(
          false
        )
        ctx.req.params = { token: ctx.token }
        ctx.req.body = {
          confirmedByUser: true,
          tokenHashPrefix: '#prefix',
        }
        await new Promise((resolve, reject) => {
          ctx.res.callback = resolve
          ctx.TokenAccessController.grantTokenAccessReadAndWrite(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })

      it('adds the user as a read only invited member instead (pendingEditor)', function (ctx) {
        expect(
          ctx.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          ctx.project._id,
          undefined,
          ctx.user._id,
          PrivilegeLevels.READ_ONLY,
          { pendingEditor: true }
        )
      })

      it('writes a project audit log', function (ctx) {
        expect(
          ctx.ProjectAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          ctx.project._id,
          'accept-via-link-sharing',
          ctx.user._id,
          ctx.req.ip,
          { privileges: 'readOnly', pendingEditor: true }
        )
      })

      it('records a project-joined event for the user', function (ctx) {
        expect(
          ctx.AnalyticsManager.recordEventForUserInBackground
        ).to.have.been.calledWith(ctx.user._id, 'project-joined', {
          mode: 'view',
          projectId: ctx.project._id.toString(),
          pendingEditor: true,
          ownerId: ctx.project.owner_ref.toString(),
          role: PrivilegeLevels.READ_ONLY,
          source: 'link-sharing',
        })
      })

      it('emits a project membership changed event', function (ctx) {
        expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
          ctx.project._id,
          'project:membership:changed',
          { members: true, invites: true }
        )
      })

      it('checks token hash', function (ctx) {
        expect(
          ctx.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          ctx.token,
          '#prefix',
          'readAndWrite',
          ctx.user._id,
          { projectId: ctx.project._id, action: 'continue' }
        )
      })
    })

    describe('when the access was already granted', function () {
      beforeEach(async function (ctx) {
        ctx.project.tokenAccessReadAndWrite_refs.push(ctx.user._id)
        ctx.req.params = { token: ctx.token }
        ctx.req.body = { confirmedByUser: true }
        await new Promise((resolve, reject) => {
          ctx.res.callback = resolve
          ctx.TokenAccessController.grantTokenAccessReadAndWrite(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })

      it('writes a project audit log', function (ctx) {
        expect(
          ctx.ProjectAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          ctx.project._id,
          'accept-via-link-sharing',
          ctx.user._id,
          ctx.req.ip,
          { privileges: 'readAndWrite' }
        )
      })

      it('checks token hash', function (ctx) {
        expect(
          ctx.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          ctx.token,
          undefined,
          'readAndWrite',
          ctx.user._id,
          { projectId: ctx.project._id, action: 'continue' }
        )
      })
    })

    describe('hash prefix missing in request', function () {
      beforeEach(async function (ctx) {
        ctx.req.params = { token: ctx.token }
        ctx.req.body = { confirmedByUser: true }
        await new Promise((resolve, reject) => {
          ctx.res.callback = resolve
          ctx.TokenAccessController.grantTokenAccessReadAndWrite(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })

      it('adds the user as a read and write invited member', function (ctx) {
        expect(
          ctx.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          ctx.project._id,
          undefined,
          ctx.user._id,
          PrivilegeLevels.READ_AND_WRITE
        )
      })

      it('checks the hash prefix', function (ctx) {
        expect(
          ctx.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          ctx.token,
          undefined,
          'readAndWrite',
          ctx.user._id,
          { projectId: ctx.project._id, action: 'continue' }
        )
      })
    })

    describe('user is owner of project', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.AuthorizationManager.promises.getPrivilegeLevelForProject.returns(
            PrivilegeLevels.OWNER
          )
          ctx.req.params = { token: ctx.token }
          ctx.req.body = {}
          ctx.res.callback = resolve
          ctx.TokenAccessController.grantTokenAccessReadAndWrite(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })
      it('checks token hash and includes log data', function (ctx) {
        expect(
          ctx.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          ctx.token,
          undefined,
          'readAndWrite',
          ctx.user._id,
          {
            projectId: ctx.project._id,
            action: 'user already has higher or same privilege',
          }
        )
      })
    })

    describe('when user is not logged in', function () {
      beforeEach(function (ctx) {
        ctx.SessionManager.getLoggedInUserId.returns(null)
        ctx.req.params = { token: ctx.token }
        ctx.req.body = { tokenHashPrefix: '#prefix' }
      })
      describe('ANONYMOUS_READ_AND_WRITE_ENABLED is undefined', function () {
        beforeEach(async function (ctx) {
          await new Promise((resolve, reject) => {
            ctx.res.callback = resolve
            ctx.TokenAccessController.grantTokenAccessReadAndWrite(
              ctx.req,
              ctx.res,
              ctx.rejectOnError(reject)
            )
          })
        })

        it('redirects to restricted', function (ctx) {
          expect(ctx.res.json).toHaveBeenCalledWith({
            redirect: '/restricted',
            anonWriteAccessDenied: true,
          })
        })

        it('checks the hash prefix and includes log data', function (ctx) {
          expect(
            ctx.TokenAccessHandler.checkTokenHashPrefix
          ).to.have.been.calledWith(
            ctx.token,
            '#prefix',
            'readAndWrite',
            null,
            {
              action: 'denied anonymous read-and-write token access',
            }
          )
        })

        it('saves redirect URL with URL fragment', function (ctx) {
          expect(
            ctx.AuthenticationController.setRedirectInSession.lastCall.args[1]
          ).to.equal('/#prefix')
        })
      })

      describe('ANONYMOUS_READ_AND_WRITE_ENABLED is true', function () {
        beforeEach(async function (ctx) {
          ctx.TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = true
          await new Promise((resolve, reject) => {
            ctx.res.callback = resolve

            ctx.TokenAccessController.grantTokenAccessReadAndWrite(
              ctx.req,
              ctx.res,
              ctx.rejectOnError(reject)
            )
          })
        })

        it('redirects to project', function (ctx) {
          expect(ctx.res.json).toHaveBeenCalledWith({
            redirect: `/project/${ctx.project._id}`,
            grantAnonymousAccess: 'readAndWrite',
          })
        })

        it('checks the hash prefix and includes log data', function (ctx) {
          expect(
            ctx.TokenAccessHandler.checkTokenHashPrefix
          ).to.have.been.calledWith(
            ctx.token,
            '#prefix',
            'readAndWrite',
            null,
            {
              projectId: ctx.project._id,
              action: 'granting read-write anonymous access',
            }
          )
        })
      })
    })

    describe('when Overleaf SaaS', function () {
      beforeEach(function (ctx) {
        ctx.Settings.overleaf = {}
      })
      describe('when token is for v1 project', function () {
        beforeEach(async function (ctx) {
          ctx.TokenAccessHandler.promises.getProjectByToken.resolves(undefined)
          ctx.TokenAccessHandler.promises.getV1DocInfo.resolves({
            exists: true,
            has_owner: true,
          })
          ctx.req.params = { token: ctx.token }
          ctx.req.body = { tokenHashPrefix: '#prefix' }
          await new Promise((resolve, reject) => {
            ctx.res.callback = resolve
            ctx.TokenAccessController.grantTokenAccessReadAndWrite(
              ctx.req,
              ctx.res,
              ctx.rejectOnError(reject)
            )
          })
        })
        it('returns v1 import data', function (ctx) {
          expect(ctx.res.json).toHaveBeenCalledWith({
            v1Import: {
              status: 'canDownloadZip',
              projectId: ctx.token,
              hasOwner: true,
              name: 'Untitled',
              brandInfo: undefined,
            },
          })
        })
        it('checks the hash prefix and includes log data', function (ctx) {
          expect(
            ctx.TokenAccessHandler.checkTokenHashPrefix
          ).to.have.been.calledWith(
            ctx.token,
            '#prefix',
            'readAndWrite',
            ctx.user._id,
            {
              action: 'import v1',
            }
          )
        })
      })

      describe('when token is not for a v1 or v2 project', function () {
        beforeEach(async function (ctx) {
          ctx.TokenAccessHandler.promises.getProjectByToken.resolves(undefined)
          ctx.TokenAccessHandler.promises.getV1DocInfo.resolves({
            exists: false,
          })
          ctx.req.params = { token: ctx.token }
          ctx.req.body = { tokenHashPrefix: '#prefix' }
          await new Promise((resolve, reject) => {
            ctx.res.callback = resolve
            ctx.TokenAccessController.grantTokenAccessReadAndWrite(
              ctx.req,
              ctx.res,
              ctx.rejectOnError(reject)
            )
          })
        })
        it('returns 404', function (ctx) {
          expect(ctx.res.sendStatus).toHaveBeenCalledWith(404)
        })
        it('checks the hash prefix and includes log data', function (ctx) {
          expect(
            ctx.TokenAccessHandler.checkTokenHashPrefix
          ).to.have.been.calledWith(
            ctx.token,
            '#prefix',
            'readAndWrite',
            ctx.user._id,
            {
              action: '404',
            }
          )
        })
      })
    })

    describe('not Overleaf SaaS', function () {
      beforeEach(function (ctx) {
        ctx.TokenAccessHandler.promises.getProjectByToken.resolves(undefined)
        ctx.req.params = { token: ctx.token }
        ctx.req.body = { tokenHashPrefix: '#prefix' }
      })
      it('passes Errors.NotFoundError to next when project not found and still checks token hash', async function (ctx) {
        await new Promise(resolve => {
          ctx.TokenAccessController.grantTokenAccessReadAndWrite(
            ctx.req,
            ctx.res,
            args => {
              expect(args).to.be.instanceof(ctx.Errors.NotFoundError)

              expect(
                ctx.TokenAccessHandler.checkTokenHashPrefix
              ).to.have.been.calledWith(
                ctx.token,
                '#prefix',
                'readAndWrite',
                ctx.user._id,
                {
                  action: '404',
                }
              )

              resolve()
            }
          )
        })
      })
    })

    describe('when user is admin', function () {
      const admin = { _id: new ObjectId(), isAdmin: true }
      beforeEach(function (ctx) {
        ctx.SessionManager.getLoggedInUserId.returns(admin._id)
        ctx.SessionManager.getSessionUser.returns(admin)
        ctx.AdminAuthorizationHelper.canRedirectToAdminDomain.returns(true)
        ctx.req.params = { token: ctx.token }
        ctx.req.body = { confirmedByUser: true, tokenHashPrefix: '#prefix' }
      })

      it('redirects if project owner is non-admin', async function (ctx) {
        ctx.UserGetter.promises.getUserConfirmedEmails = sinon
          .stub()
          .resolves([{ email: 'test@not-overleaf.com' }])

        await ctx.TokenAccessController.grantTokenAccessReadAndWrite(
          ctx.req,
          ctx.res
        )
        expect(ctx.res.json).toHaveBeenCalledWith({
          redirect: `${ctx.Settings.adminUrl}/#prefix`,
        })
      })

      it('grants access if project owner is an internal staff', function (ctx) {
        const internalStaff = { _id: new ObjectId(), isAdmin: true }
        const projectFromInternalStaff = {
          _id: new ObjectId(),
          name: 'test',
          tokenAccessReadAndWrite_refs: [],
          tokenAccessReadOnly_refs: [],
          owner_ref: internalStaff._id,
        }
        ctx.UserGetter.promises.getUser = sinon.stub().resolves(internalStaff)
        ctx.UserGetter.promises.getUserConfirmedEmails = sinon
          .stub()
          .resolves([{ email: 'test@overleaf.com' }])
        ctx.TokenAccessHandler.promises.getProjectByToken = sinon
          .stub()
          .resolves(projectFromInternalStaff)
        ctx.res.callback = () => {
          expect(
            ctx.CollaboratorsHandler.promises.addUserIdToProject
          ).to.have.been.calledWith(
            projectFromInternalStaff._id,
            undefined,
            admin._id,
            PrivilegeLevels.READ_AND_WRITE
          )
        }
        ctx.TokenAccessController.grantTokenAccessReadAndWrite(ctx.req, ctx.res)
      })
    })

    it('passes Errors.NotFoundError to next when token access is not enabled but still checks token hash', async function (ctx) {
      await new Promise(resolve => {
        ctx.TokenAccessHandler.tokenAccessEnabledForProject.returns(false)
        ctx.req.params = { token: ctx.token }
        ctx.req.body = { tokenHashPrefix: '#prefix' }
        ctx.TokenAccessController.grantTokenAccessReadAndWrite(
          ctx.req,
          ctx.res,
          args => {
            expect(args).to.be.instanceof(ctx.Errors.NotFoundError)

            expect(
              ctx.TokenAccessHandler.checkTokenHashPrefix
            ).to.have.been.calledWith(
              ctx.token,
              '#prefix',
              'readAndWrite',
              ctx.user._id,
              {
                projectId: ctx.project._id,
                action: 'token access not enabled',
              }
            )

            resolve()
          }
        )
      })
    })

    it('returns 400 when not using a read write token', function (ctx) {
      ctx.TokenAccessHandler.isReadAndWriteToken.returns(false)
      ctx.req.params = { token: ctx.token }
      ctx.req.body = { tokenHashPrefix: '#prefix' }
      ctx.TokenAccessController.grantTokenAccessReadAndWrite(ctx.req, ctx.res)
      expect(ctx.res.sendStatus).toHaveBeenCalledWith(400)
    })
  })

  describe('grantTokenAccessReadOnly', function () {
    describe('normal case', function () {
      beforeEach(async function (ctx) {
        ctx.req.params = { token: ctx.token }
        ctx.req.body = { confirmedByUser: true, tokenHashPrefix: '#prefix' }
        await new Promise((resolve, reject) => {
          ctx.res.callback = resolve
          ctx.TokenAccessController.grantTokenAccessReadOnly(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })

      it('grants read-only access', function (ctx) {
        expect(
          ctx.TokenAccessHandler.promises.addReadOnlyUserToProject
        ).to.have.been.calledWith(
          ctx.user._id,
          ctx.project._id,
          ctx.project.owner_ref
        )
      })

      it('writes a project audit log', function (ctx) {
        expect(
          ctx.ProjectAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          ctx.project._id,
          'join-via-token',
          ctx.user._id,
          ctx.req.ip,
          { privileges: 'readOnly' }
        )
      })

      it('checks if hash prefix matches', function (ctx) {
        expect(
          ctx.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          ctx.token,
          '#prefix',
          'readOnly',
          ctx.user._id,
          { projectId: ctx.project._id, action: 'continue' }
        )
      })
    })

    describe('when the access was already granted', function () {
      beforeEach(async function (ctx) {
        ctx.project.tokenAccessReadOnly_refs.push(ctx.user._id)
        ctx.req.params = { token: ctx.token }
        ctx.req.body = { confirmedByUser: true }
        await new Promise((resolve, reject) => {
          ctx.res.callback = resolve
          ctx.TokenAccessController.grantTokenAccessReadOnly(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })

      it("doesn't write a project audit log", function (ctx) {
        expect(ctx.ProjectAuditLogHandler.promises.addEntry).to.not.have.been
          .called
      })

      it('still checks if hash prefix matches', function (ctx) {
        expect(
          ctx.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          ctx.token,
          undefined,
          'readOnly',
          ctx.user._id,
          { projectId: ctx.project._id, action: 'continue' }
        )
      })
    })

    it('returns 400 when not using a read only token', function (ctx) {
      ctx.TokenAccessHandler.isReadOnlyToken.returns(false)
      ctx.req.params = { token: ctx.token }
      ctx.req.body = { tokenHashPrefix: '#prefix' }
      ctx.TokenAccessController.grantTokenAccessReadOnly(ctx.req, ctx.res)
      expect(ctx.res.sendStatus).toHaveBeenCalledWith(400)
    })

    describe('anonymous users', function () {
      beforeEach(async function (ctx) {
        ctx.req.params = { token: ctx.token }
        ctx.SessionManager.getLoggedInUserId.returns(null)
        await new Promise((resolve, reject) => {
          ctx.res.callback = resolve

          ctx.TokenAccessController.grantTokenAccessReadOnly(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })

      it('allows anonymous users and checks the token hash', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledWith({
          redirect: `/project/${ctx.project._id}`,
          grantAnonymousAccess: 'readOnly',
        })

        expect(
          ctx.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(ctx.token, undefined, 'readOnly', null, {
          projectId: ctx.project._id,
          action: 'granting read-only anonymous access',
        })
      })
    })

    describe('user is owner of project', function () {
      beforeEach(async function (ctx) {
        ctx.AuthorizationManager.promises.getPrivilegeLevelForProject.returns(
          PrivilegeLevels.OWNER
        )
        ctx.req.params = { token: ctx.token }
        ctx.req.body = {}
        await new Promise((resolve, reject) => {
          ctx.res.callback = resolve
          ctx.TokenAccessController.grantTokenAccessReadOnly(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })
      it('checks token hash and includes log data', function (ctx) {
        expect(
          ctx.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          ctx.token,
          undefined,
          'readOnly',
          ctx.user._id,
          {
            projectId: ctx.project._id,
            action: 'user already has higher or same privilege',
          }
        )
      })
    })

    it('passes Errors.NotFoundError to next when token access is not enabled but still checks token hash', async function (ctx) {
      await new Promise(resolve => {
        ctx.TokenAccessHandler.tokenAccessEnabledForProject.returns(false)
        ctx.req.params = { token: ctx.token }
        ctx.req.body = { tokenHashPrefix: '#prefix' }
        ctx.TokenAccessController.grantTokenAccessReadOnly(
          ctx.req,
          ctx.res,
          args => {
            expect(args).to.be.instanceof(ctx.Errors.NotFoundError)

            expect(
              ctx.TokenAccessHandler.checkTokenHashPrefix
            ).to.have.been.calledWith(
              ctx.token,
              '#prefix',
              'readOnly',
              ctx.user._id,
              {
                projectId: ctx.project._id,
                action: 'token access not enabled',
              }
            )

            resolve()
          }
        )
      })
    })
  })

  describe('ensureUserCanUseSharingUpdatesConsentPage', function () {
    beforeEach(function (ctx) {
      ctx.req.params = { Project_id: ctx.project._id }
    })

    describe('when not in link sharing changes test', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.AsyncFormHelper.redirect = sinon.stub().callsFake(() => resolve())
          ctx.TokenAccessController.ensureUserCanUseSharingUpdatesConsentPage(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })

      it('redirects to the project/editor', function (ctx) {
        expect(ctx.AsyncFormHelper.redirect).to.have.been.calledWith(
          ctx.req,
          ctx.res,
          `/project/${ctx.project._id}`
        )
      })
    })

    describe('when link sharing changes test active', function () {
      beforeEach(function (ctx) {
        ctx.SplitTestHandler.promises.getAssignmentForUser.resolves({
          variant: 'active',
        })
      })

      describe('when user is not an invited editor and is a read write token member', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject.resolves(
              false
            )
            ctx.CollaboratorsGetter.promises.userIsReadWriteTokenMember.resolves(
              true
            )
            ctx.next.callsFake(() => resolve())
            ctx.TokenAccessController.ensureUserCanUseSharingUpdatesConsentPage(
              ctx.req,
              ctx.res,
              ctx.next
            )
          })
        })

        it('calls next', function (ctx) {
          expect(
            ctx.CollaboratorsGetter.promises
              .isUserInvitedReadWriteMemberOfProject
          ).to.have.been.calledWith(ctx.user._id, ctx.project._id)
          expect(
            ctx.CollaboratorsGetter.promises.userIsReadWriteTokenMember
          ).to.have.been.calledWith(ctx.user._id, ctx.project._id)
          expect(ctx.next).to.have.been.calledOnce
          expect(ctx.next.firstCall.args[0]).to.not.exist
        })
      })

      describe('when user is already an invited editor', function () {
        beforeEach(async function (ctx) {
          ctx.CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject.resolves(
            true
          )
          await new Promise((resolve, reject) => {
            ctx.AsyncFormHelper.redirect = sinon
              .stub()
              .callsFake(() => resolve())
            ctx.TokenAccessController.ensureUserCanUseSharingUpdatesConsentPage(
              ctx.req,
              ctx.res,
              ctx.rejectOnError(reject)
            )
          })
        })

        it('redirects to the project/editor', function (ctx) {
          expect(ctx.AsyncFormHelper.redirect).to.have.been.calledWith(
            ctx.req,
            ctx.res,
            `/project/${ctx.project._id}`
          )
        })
      })

      describe('when user not a read write token member', function () {
        beforeEach(async function (ctx) {
          ctx.CollaboratorsGetter.promises.userIsReadWriteTokenMember.resolves(
            false
          )
          await new Promise((resolve, reject) => {
            ctx.AsyncFormHelper.redirect = sinon
              .stub()
              .callsFake(() => resolve())
            ctx.TokenAccessController.ensureUserCanUseSharingUpdatesConsentPage(
              ctx.req,
              ctx.res,
              ctx.rejectOnError(reject)
            )
          })
        })

        it('redirects to the project/editor', function (ctx) {
          expect(ctx.AsyncFormHelper.redirect).to.have.been.calledWith(
            ctx.req,
            ctx.res,
            `/project/${ctx.project._id}`
          )
        })
      })
    })
  })

  describe('moveReadWriteToCollaborators', function () {
    beforeEach(function (ctx) {
      ctx.req.params = { Project_id: ctx.project._id }
    })

    describe('when there are collaborator slots available', function () {
      beforeEach(function (ctx) {
        ctx.LimitationsManager.promises.canAcceptEditCollaboratorInvite.resolves(
          true
        )
      })

      describe('previously joined token access user moving to named collaborator', function () {
        beforeEach(async function (ctx) {
          ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.resolves(
            false
          )
          await new Promise((resolve, reject) => {
            ctx.res.callback = resolve
            ctx.TokenAccessController.moveReadWriteToCollaborators(
              ctx.req,
              ctx.res,
              ctx.rejectOnError(reject)
            )
          })
        })

        it('sets the privilege level to read and write for the invited viewer', function (ctx) {
          expect(
            ctx.TokenAccessHandler.promises.removeReadAndWriteUserFromProject
          ).to.have.been.calledWith(ctx.user._id, ctx.project._id)
          expect(
            ctx.CollaboratorsHandler.promises.addUserIdToProject
          ).to.have.been.calledWith(
            ctx.project._id,
            undefined,
            ctx.user._id,
            PrivilegeLevels.READ_AND_WRITE
          )
          expect(ctx.res.sendStatus).toHaveBeenCalledWith(204)
        })
      })
    })

    describe('when there are no edit collaborator slots available', function () {
      beforeEach(function (ctx) {
        ctx.LimitationsManager.promises.canAcceptEditCollaboratorInvite.resolves(
          false
        )
      })

      describe('previously joined token access user moving to named collaborator', function () {
        beforeEach(async function (ctx) {
          ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.resolves(
            false
          )
          await new Promise((resolve, reject) => {
            ctx.res.callback = resolve
            ctx.TokenAccessController.moveReadWriteToCollaborators(
              ctx.req,
              ctx.res,
              ctx.rejectOnError(reject)
            )
          })
        })

        it('sets the privilege level to read only for the invited viewer (pendingEditor)', function (ctx) {
          expect(
            ctx.TokenAccessHandler.promises.removeReadAndWriteUserFromProject
          ).to.have.been.calledWith(ctx.user._id, ctx.project._id)
          expect(
            ctx.CollaboratorsHandler.promises.addUserIdToProject
          ).to.have.been.calledWith(
            ctx.project._id,
            undefined,
            ctx.user._id,
            PrivilegeLevels.READ_ONLY,
            { pendingEditor: true }
          )
          expect(ctx.res.sendStatus).toHaveBeenCalledWith(204)
        })
      })
    })
  })

  describe('moveReadWriteToReadOnly', function () {
    beforeEach(function (ctx) {
      ctx.req.params = { Project_id: ctx.project._id }
    })

    describe('previously joined token access user moving to anonymous viewer', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.res.callback = resolve
          ctx.TokenAccessController.moveReadWriteToReadOnly(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })

      it('removes them from read write token access refs and adds them to read only token access refs', function (ctx) {
        expect(
          ctx.TokenAccessHandler.promises.moveReadAndWriteUserToReadOnly
        ).to.have.been.calledWith(ctx.user._id, ctx.project._id)
        expect(ctx.res.sendStatus).toHaveBeenCalledWith(204)
      })

      it('writes a project audit log', function (ctx) {
        expect(
          ctx.ProjectAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          ctx.project._id,
          'readonly-via-sharing-updates',
          ctx.user._id,
          ctx.req.ip
        )
      })
    })
  })
})
