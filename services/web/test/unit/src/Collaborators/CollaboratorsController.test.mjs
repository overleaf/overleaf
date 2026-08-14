import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import {
  InvalidParamsError,
  InvalidRequestError,
} from '@overleaf/validation-tools'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'

const ObjectId = mongodb.ObjectId

const MODULE_PATH =
  '../../../../app/src/Features/Collaborators/CollaboratorsController.mjs'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('CollaboratorsController', function () {
  beforeEach(async function (ctx) {
    ctx.res = new MockResponse(vi)
    ctx.req = new MockRequest(vi)

    ctx.user = { _id: new ObjectId(), email: 'user@example.com' }
    ctx.projectId = new ObjectId()
    ctx.callback = sinon.stub()

    ctx.CollaboratorsHandler = {
      promises: {
        removeUserFromProject: sinon.stub().resolves(),
        setCollaboratorPrivilegeLevel: sinon.stub().resolves(),
        requestAccess: sinon.stub().resolves({ isNew: true }),
        declineAccessRequest: sinon
          .stub()
          .resolves({ removed: true, privilegeLevel: 'review' }),
      },
      createTokenHashPrefix: sinon.stub().returns('abc123'),
    }
    ctx.CollaboratorsInviteHandler = {
      promises: {
        revokeInviteForUser: sinon.stub().resolves(),
      },
    }
    ctx.projectAccess = {
      getOwnerId: sinon.stub().returns(ctx.user._id),
      accessRequestCount: sinon.stub().returns(0),
      loadAccessRequests: sinon.stub().resolves([]),
      loadAccessRequestsView: sinon.stub().resolves([]),
      getAccessRequestForUser: sinon.stub().returns(null),
      privilegeLevelForUser: sinon.stub().returns('readOnly'),
    }
    ctx.CollaboratorsGetter = {
      promises: {
        getAllInvitedMembers: sinon.stub(),
        getProjectAccess: sinon.stub().resolves(ctx.projectAccess),
        getPublicShareTokens: sinon.stub(),
      },
    }
    ctx.Features = {
      hasFeature: sinon.stub().returns(true),
    }
    ctx.AuthorizationManager = {
      promises: {
        getPrivilegeLevelForProject: sinon.stub().resolves('readOnly'),
      },
    }
    ctx.AnalyticsManager = {
      recordEventForUserInBackground: sinon.stub(),
    }
    ctx.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves(),
      },
    }
    ctx.EditorRealTimeController = {
      emitToRoom: sinon.stub(),
    }
    ctx.HttpErrorHandler = {
      forbidden: sinon.stub(),
      notFound: sinon.stub(),
    }
    ctx.TagsHandler = {
      promises: {
        removeProjectFromAllTags: sinon.stub().resolves(),
      },
    }
    ctx.SessionManager = {
      getSessionUser: sinon.stub().returns(ctx.user),
      getLoggedInUserId: sinon.stub().returns(ctx.user._id),
    }

    ctx.UserGetter = {
      promises: {
        getAllInvitedMembers: sinon.stub(),
        getUser: sinon.stub().resolves(ctx.user),
        getUsers: sinon.stub().resolves([]),
        getUserConfirmedEmails: sinon
          .stub()
          .resolves([{ email: 'req@example.com' }]),
      },
    }
    ctx.OwnershipTransferHandler = {
      promises: {
        transferOwnership: sinon.stub().resolves(),
      },
    }
    ctx.TokenAccessHandler = {
      getRequestToken: sinon.stub().returns('access-token'),
      createTokenHashPrefix: sinon.stub().returns('hash-prefix'),
    }

    ctx.ProjectAuditLogHandler = {
      addEntryInBackground: sinon.stub(),
    }

    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves({ owner_ref: ctx.user._id }),
      },
    }

    ctx.SplitTestHandler = {
      promises: {
        getAssignmentForUser: sinon.stub().resolves({ variant: 'default' }),
      },
    }

    ctx.LimitationsManager = {
      promises: {
        canAddXEditCollaborators: sinon.stub().resolves(),
        canChangeCollaboratorPrivilegeLevel: sinon.stub().resolves(true),
      },
    }

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsHandler.mjs',
      () => ({
        default: ctx.CollaboratorsHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter.mjs',
      () => ({
        default: ctx.CollaboratorsGetter,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsInviteHandler.mjs',
      () => ({
        default: ctx.CollaboratorsInviteHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/OwnershipTransferHandler.mjs',
      () => ({
        default: ctx.OwnershipTransferHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Editor/EditorRealTimeController',
      () => ({
        default: ctx.EditorRealTimeController,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Errors/HttpErrorHandler.mjs',
      () => ({
        default: ctx.HttpErrorHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Tags/TagsHandler.mjs', () => ({
      default: ctx.TagsHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager.mjs',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter.mjs', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/TokenAccess/TokenAccessHandler.mjs',
      () => ({
        default: ctx.TokenAccessHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectAuditLogHandler.mjs',
      () => ({
        default: ctx.ProjectAuditLogHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter.mjs', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler.mjs',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/LimitationsManager.mjs',
      () => ({
        default: ctx.LimitationsManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authorization/AuthorizationManager.mjs',
      () => ({
        default: ctx.AuthorizationManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager.mjs',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    vi.doMock('../../../../app/src/Features/Email/EmailHandler.mjs', () => ({
      default: ctx.EmailHandler,
    }))

    vi.doMock('../../../../app/src/infrastructure/Features.mjs', () => ({
      default: ctx.Features,
    }))

    ctx.CollaboratorsController = (await import(MODULE_PATH)).default
  })

  describe('removeUserFromProject', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.req.params = {
          Project_id: ctx.projectId.toString(),
          user_id: ctx.user._id.toString(),
        }
        ctx.res.sendStatus = sinon.spy(() => {
          resolve()
        })
        ctx.CollaboratorsController.removeUserFromProject(ctx.req, ctx.res)
      })
    })

    it('should from the user from the project', function (ctx) {
      expect(
        ctx.CollaboratorsHandler.promises.removeUserFromProject
      ).to.have.been.calledWith(
        ctx.projectId.toString(),
        ctx.user._id.toString()
      )
    })

    it('should emit a userRemovedFromProject event to the proejct', function (ctx) {
      expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        ctx.projectId.toString(),
        'userRemovedFromProject',
        ctx.user._id.toString()
      )
    })

    it('should send the back a success response', function (ctx) {
      ctx.res.sendStatus.calledWith(204).should.equal(true)
    })

    it('should have called emitToRoom', function (ctx) {
      expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        ctx.projectId.toString(),
        'project:membership:changed'
      )
    })

    it('should look up the collaborator email', function (ctx) {
      expect(ctx.UserGetter.promises.getUser).to.have.been.calledWith(
        { _id: ctx.user._id.toString() },
        { email: 1 }
      )
    })

    it('should write a project audit log', function (ctx) {
      ctx.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
        ctx.projectId.toString(),
        'remove-collaborator',
        ctx.user._id,
        ctx.req.ip,
        {
          userId: ctx.user._id.toString(),
          collaboratorEmail: 'user@example.com',
        }
      )
    })
  })

  describe('removeUserFromProject with a malformed project id', function () {
    it('rejects the request instead of removing anyone', async function (ctx) {
      ctx.req.params = {
        Project_id: 'not-an-object-id',
        user_id: ctx.user._id.toString(),
      }
      await ctx.CollaboratorsController.removeUserFromProject(
        ctx.req,
        ctx.res
      ).should.be.rejectedWith(InvalidParamsError)
      expect(ctx.CollaboratorsHandler.promises.removeUserFromProject).to.not
        .have.been.called
    })
  })

  describe('removeSelfFromProject', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.req.params = { Project_id: ctx.projectId.toString() }
        ctx.res.sendStatus = sinon.spy(() => {
          resolve()
        })
        ctx.CollaboratorsController.removeSelfFromProject(ctx.req, ctx.res)
      })
    })

    it('should remove the logged in user from the project', function (ctx) {
      expect(
        ctx.CollaboratorsHandler.promises.removeUserFromProject
      ).to.have.been.calledWith(ctx.projectId.toString(), ctx.user._id)
    })

    it('should emit a userRemovedFromProject event to the proejct', function (ctx) {
      expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        ctx.projectId.toString(),
        'userRemovedFromProject',
        ctx.user._id
      )
    })

    it('should remove the project from all tags', function (ctx) {
      expect(
        ctx.TagsHandler.promises.removeProjectFromAllTags
      ).to.have.been.calledWith(ctx.user._id, ctx.projectId.toString())
    })

    it('should return a success code', function (ctx) {
      ctx.res.sendStatus.calledWith(204).should.equal(true)
    })

    it('should emit a project:membership:changed event to the project', function (ctx) {
      expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        ctx.projectId.toString(),
        'project:membership:changed',
        { members: true }
      )
    })

    it('should write a project audit log', function (ctx) {
      ctx.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
        ctx.projectId.toString(),
        'leave-project',
        ctx.user._id,
        ctx.req.ip
      )
    })
  })

  describe('removeSelfFromProject with a malformed project id', function () {
    it('rejects the request instead of removing anyone', async function (ctx) {
      ctx.req.params = { Project_id: 'not-an-object-id' }
      await ctx.CollaboratorsController.removeSelfFromProject(
        ctx.req,
        ctx.res
      ).should.be.rejectedWith(InvalidParamsError)
      expect(ctx.CollaboratorsHandler.promises.removeUserFromProject).to.not
        .have.been.called
    })
  })

  describe('getAllMembers', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.req.params = { Project_id: ctx.projectId.toString() }
        ctx.res.json = sinon.spy(() => {
          resolve()
        })
        ctx.next = sinon.stub()
        ctx.members = [{ a: 1 }]
        ctx.CollaboratorsGetter.promises.getAllInvitedMembers.resolves(
          ctx.members
        )
        ctx.CollaboratorsController.getAllMembers(ctx.req, ctx.res, ctx.next)
      })
    })

    it('should not produce an error', function (ctx) {
      ctx.next.callCount.should.equal(0)
    })

    it('should produce a json response', function (ctx) {
      ctx.res.json.callCount.should.equal(1)
      ctx.res.json.calledWith({ members: ctx.members }).should.equal(true)
    })

    it('should call CollaboratorsGetter.getAllInvitedMembers', function (ctx) {
      expect(ctx.CollaboratorsGetter.promises.getAllInvitedMembers).to.have.been
        .calledOnce
    })

    describe('when CollaboratorsGetter.getAllInvitedMembers produces an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.res.json = sinon.stub()
          ctx.next = sinon.spy(() => {
            resolve()
          })
          ctx.CollaboratorsGetter.promises.getAllInvitedMembers.rejects(
            new Error('woops')
          )
          ctx.CollaboratorsController.getAllMembers(ctx.req, ctx.res, ctx.next)
        })
      })

      it('should produce an error', function (ctx) {
        expect(ctx.next).to.have.been.calledOnce
        expect(ctx.next).to.have.been.calledWithMatch(
          sinon.match.instanceOf(Error)
        )
      })

      it('should not produce a json response', function (ctx) {
        ctx.res.json.callCount.should.equal(0)
      })
    })
  })

  describe('getAllMembers with a malformed project id', function () {
    it('rejects the request instead of listing members', async function (ctx) {
      ctx.req.params = { Project_id: 'not-an-object-id' }
      await ctx.CollaboratorsController.getAllMembers(
        ctx.req,
        ctx.res
      ).should.be.rejectedWith(InvalidParamsError)
      expect(ctx.CollaboratorsGetter.promises.getAllInvitedMembers).to.not.have
        .been.called
    })
  })

  describe('getAccessRequests', function () {
    beforeEach(async function (ctx) {
      ctx.requesterId = new ObjectId()
      ctx.editAccessRequests = [
        {
          _id: ctx.requesterId,
          email: 'r@e.com',
          first_name: 'Req',
          last_name: 'User',
          privilegeLevel: 'readAndWrite',
          currentPrivilegeLevel: 'readOnly',
          requestedAt: new Date(),
        },
      ]
      ctx.projectAccess.loadAccessRequestsView = sinon
        .stub()
        .resolves(ctx.editAccessRequests)
      await new Promise(resolve => {
        ctx.req.params = { Project_id: ctx.projectId.toString() }
        ctx.res.json = sinon.spy(() => resolve())
        ctx.CollaboratorsController.getAccessRequests(ctx.req, ctx.res)
      })
    })

    it('responds with the flattened owner view of the requests', function (ctx) {
      expect(
        ctx.CollaboratorsGetter.promises.getProjectAccess
      ).to.have.been.calledWith(ctx.projectId.toString())
      expect(ctx.res.json).to.have.been.calledWith({
        editAccessRequests: ctx.editAccessRequests,
      })
    })
  })

  describe('getAccessRequests with a malformed project id', function () {
    it('rejects the request instead of listing access requests', async function (ctx) {
      ctx.req.params = { Project_id: 'not-an-object-id' }
      await ctx.CollaboratorsController.getAccessRequests(
        ctx.req,
        ctx.res
      ).should.be.rejectedWith(InvalidParamsError)
      expect(ctx.CollaboratorsGetter.promises.getProjectAccess).to.not.have.been
        .called
    })
  })

  describe('setCollaboratorInfo', function () {
    beforeEach(function (ctx) {
      ctx.req.params = {
        Project_id: ctx.projectId.toString(),
        user_id: ctx.user._id.toString(),
      }
      ctx.req.body = { privilegeLevel: 'readOnly' }
    })

    it('should set the collaborator privilege level', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.sendStatus = status => {
          expect(status).to.equal(204)
          expect(
            ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel
          ).to.have.been.calledWith(
            ctx.projectId.toString(),
            ctx.user._id.toString(),
            'readOnly'
          )
          resolve()
        }
        ctx.CollaboratorsController.setCollaboratorInfo(ctx.req, ctx.res)
      })
    })

    it('should return a 404 when the project or collaborator is not found', async function (ctx) {
      await new Promise(resolve => {
        ctx.HttpErrorHandler.notFound = sinon.spy((req, res) => {
          expect(req).to.equal(ctx.req)
          expect(res).to.equal(ctx.res)
          resolve()
        })

        ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel.rejects(
          new Errors.NotFoundError()
        )
        ctx.CollaboratorsController.setCollaboratorInfo(ctx.req, ctx.res)
      })
    })

    it('should pass the error to the next handler when setting the privilege level fails', async function (ctx) {
      await new Promise(resolve => {
        ctx.next = sinon.spy(err => {
          expect(err).instanceOf(Error)
          resolve()
        })

        ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel.rejects(
          new Error()
        )
        ctx.CollaboratorsController.setCollaboratorInfo(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })
    })

    it('rejects an unrecognized field in the body instead of falling back', async function (ctx) {
      ctx.req.body = { privilegeLevel: 'readOnly', notARealField: 'nope' }
      await new Promise(resolve => {
        ctx.next = sinon.spy(err => {
          expect(err).to.be.instanceOf(InvalidRequestError)
          resolve()
        })
        ctx.CollaboratorsController.setCollaboratorInfo(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })
      expect(ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel).to
        .not.have.been.called
    })

    describe('when setting privilege level to readAndWrite', function () {
      beforeEach(function (ctx) {
        ctx.req.body = { privilegeLevel: 'readAndWrite' }
      })

      describe('when owner can add new edit collaborators', function () {
        it('should set privilege level after checking collaborators can be added', async function (ctx) {
          await new Promise(resolve => {
            ctx.res.sendStatus = status => {
              expect(status).to.equal(204)
              expect(
                ctx.LimitationsManager.promises
                  .canChangeCollaboratorPrivilegeLevel
              ).to.have.been.calledWith(
                ctx.projectId.toString(),
                ctx.user._id.toString(),
                'readAndWrite'
              )
              resolve()
            }
            ctx.CollaboratorsController.setCollaboratorInfo(ctx.req, ctx.res)
          })
        })
      })

      describe('when owner cannot add edit collaborators', function () {
        beforeEach(function (ctx) {
          ctx.LimitationsManager.promises.canChangeCollaboratorPrivilegeLevel.resolves(
            false
          )
        })

        it('should return a 403 if trying to set a new edit collaborator', async function (ctx) {
          await new Promise(resolve => {
            ctx.HttpErrorHandler.forbidden = sinon.spy((req, res) => {
              expect(req).to.equal(ctx.req)
              expect(res).to.equal(ctx.res)
              expect(
                ctx.LimitationsManager.promises
                  .canChangeCollaboratorPrivilegeLevel
              ).to.have.been.calledWith(
                ctx.projectId.toString(),
                ctx.user._id.toString(),
                'readAndWrite'
              )
              expect(
                ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel
              ).to.not.have.been.called
              resolve()
            })
            ctx.CollaboratorsController.setCollaboratorInfo(ctx.req, ctx.res)
          })
        })
      })
    })

    describe('when setting privilege level to readOnly', function () {
      beforeEach(function (ctx) {
        ctx.req.body = { privilegeLevel: 'readOnly' }
      })

      describe('when owner cannot add edit collaborators', function () {
        beforeEach(function (ctx) {
          ctx.LimitationsManager.promises.canAddXEditCollaborators.resolves(
            false
          )
        })

        it('should always allow setting a collaborator to viewer even if user cant add edit collaborators', async function (ctx) {
          await new Promise(resolve => {
            ctx.res.sendStatus = status => {
              expect(status).to.equal(204)
              expect(ctx.LimitationsManager.promises.canAddXEditCollaborators)
                .to.not.have.been.called
              expect(
                ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel
              ).to.have.been.calledWith(
                ctx.projectId.toString(),
                ctx.user._id.toString(),
                'readOnly'
              )
              resolve()
            }
            ctx.CollaboratorsController.setCollaboratorInfo(ctx.req, ctx.res)
          })
        })
      })
    })
  })

  describe('transferOwnership', function () {
    beforeEach(function (ctx) {
      ctx.req.params = { Project_id: ctx.projectId.toString() }
      ctx.req.body = { user_id: ctx.user._id.toString() }
    })

    it('returns 204 on success', async function (ctx) {
      ctx.res.sendStatus = vi.fn()

      await ctx.CollaboratorsController.transferOwnership(ctx.req, ctx.res)
      expect(ctx.res.sendStatus).toHaveBeenCalledWith(204)
    })

    it('returns 404 if the project does not exist', async function (ctx) {
      await new Promise(resolve => {
        ctx.HttpErrorHandler.notFound = sinon.spy((req, res, message) => {
          expect(req).to.equal(ctx.req)
          expect(res).to.equal(ctx.res)
          expect(message).to.match(/project not found/)
          resolve()
        })
        ctx.OwnershipTransferHandler.promises.transferOwnership.rejects(
          new Errors.ProjectNotFoundError()
        )
        ctx.CollaboratorsController.transferOwnership(ctx.req, ctx.res)
      })
    })

    it('returns 404 if the user does not exist', async function (ctx) {
      await new Promise(resolve => {
        ctx.HttpErrorHandler.notFound = sinon.spy((req, res, message) => {
          expect(req).to.equal(ctx.req)
          expect(res).to.equal(ctx.res)
          expect(message).to.match(/user not found/)
          resolve()
        })
        ctx.OwnershipTransferHandler.promises.transferOwnership.rejects(
          new Errors.UserNotFoundError()
        )
        ctx.CollaboratorsController.transferOwnership(ctx.req, ctx.res)
      })
    })

    it('invokes HTTP forbidden error handler if the user is not a collaborator', async function (ctx) {
      ctx.OwnershipTransferHandler.promises.transferOwnership.rejects(
        new Errors.UserNotCollaboratorError()
      )
      await new Promise(resolve => {
        ctx.HttpErrorHandler.forbidden = sinon.spy(() => resolve())
        ctx.CollaboratorsController.transferOwnership(ctx.req, ctx.res)
      })
    })

    it('rejects an unrecognized field in the body instead of falling back', async function (ctx) {
      ctx.req.body = {
        user_id: ctx.user._id.toString(),
        notARealField: 'nope',
      }
      await ctx.CollaboratorsController.transferOwnership(
        ctx.req,
        ctx.res
      ).should.be.rejectedWith(InvalidRequestError)
      expect(ctx.OwnershipTransferHandler.promises.transferOwnership).to.not
        .have.been.called
    })
  })

  describe('requestAccess', function () {
    beforeEach(function (ctx) {
      ctx.ownerId = new ObjectId()
      ctx.req.params = { Project_id: ctx.projectId.toString() }
      ctx.req.body = { privilegeLevel: 'readAndWrite' }
      ctx.ProjectGetter.promises.getProject.resolves({
        _id: ctx.projectId,
        name: 'My Project',
        owner_ref: ctx.ownerId,
      })
      ctx.UserGetter.promises.getUsers.resolves([
        {
          _id: ctx.ownerId,
          email: 'owner@example.com',
          first_name: 'O',
          last_name: 'wner',
        },
        {
          _id: ctx.user._id,
          email: 'req@example.com',
          first_name: 'Re',
          last_name: 'Quester',
        },
      ])
    })

    it('rejects callers who are editors or owners', async function (ctx) {
      ctx.AuthorizationManager.promises.getPrivilegeLevelForProject.resolves(
        'readAndWrite'
      )
      await new Promise(resolve => {
        ctx.HttpErrorHandler.forbidden = sinon.spy(() => resolve())
        ctx.CollaboratorsController.requestAccess(ctx.req, ctx.res)
      })
      expect(ctx.CollaboratorsHandler.promises.requestAccess).to.not.have.been
        .called
    })

    it('lets a reviewer request editor access', async function (ctx) {
      ctx.AuthorizationManager.promises.getPrivilegeLevelForProject.resolves(
        'review'
      )
      ctx.req.body = { privilegeLevel: 'readAndWrite' }
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.requestAccess(ctx.req, ctx.res)
      })
      expect(
        ctx.CollaboratorsHandler.promises.requestAccess
      ).to.have.been.calledWith(
        ctx.projectId.toString(),
        ctx.user._id,
        'readAndWrite'
      )
    })

    it('rejects a reviewer asking for the reviewer level they already hold', async function (ctx) {
      ctx.AuthorizationManager.promises.getPrivilegeLevelForProject.resolves(
        'review'
      )
      ctx.req.body = { privilegeLevel: 'review' }
      await new Promise(resolve => {
        ctx.HttpErrorHandler.forbidden = sinon.spy(() => resolve())
        ctx.CollaboratorsController.requestAccess(ctx.req, ctx.res)
      })
      expect(ctx.CollaboratorsHandler.promises.requestAccess).to.not.have.been
        .called
    })

    it('emits + emails + records analytics on a fresh request', async function (ctx) {
      ctx.CollaboratorsHandler.promises.requestAccess.resolves({
        isNew: true,
      })
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.requestAccess(ctx.req, ctx.res)
      })
      ctx.res.sendStatus.calledWith(204).should.equal(true)
      expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        ctx.projectId.toString(),
        'project:membership:changed',
        { accessRequests: true }
      )
      expect(
        ctx.AnalyticsManager.recordEventForUserInBackground
      ).to.have.been.calledWith(ctx.user._id, 'project-access-requested', {
        projectId: ctx.projectId.toString(),
        currentPrivilegeLevel: 'readOnly',
        privilegeLevel: 'readAndWrite',
      })
      // notify is async + swallowed via .catch; let microtasks drain
      await new Promise(r => setImmediate(r))
      expect(ctx.EmailHandler.promises.sendEmail).to.have.been.calledWith(
        'accessRequest',
        sinon.match({ to: 'owner@example.com', privilegeLevel: 'readAndWrite' })
      )
    })

    it('skips email + analytics when isNew is false', async function (ctx) {
      ctx.CollaboratorsHandler.promises.requestAccess.resolves({
        isNew: false,
      })
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.requestAccess(ctx.req, ctx.res)
      })
      expect(ctx.EmailHandler.promises.sendEmail).to.not.have.been.called
      expect(ctx.AnalyticsManager.recordEventForUserInBackground).to.not.have
        .been.called
    })
  })

  describe('requestAccess with a malformed project id', function () {
    it('rejects the request instead of recording it', async function (ctx) {
      ctx.req.params = { Project_id: 'not-an-object-id' }
      ctx.req.body = { privilegeLevel: 'readAndWrite' }
      await ctx.CollaboratorsController.requestAccess(
        ctx.req,
        ctx.res
      ).should.be.rejectedWith(InvalidParamsError)
      expect(ctx.CollaboratorsHandler.promises.requestAccess).to.not.have.been
        .called
    })
  })

  describe('declineAccessRequest', function () {
    beforeEach(function (ctx) {
      ctx.requesterId = new ObjectId()
      ctx.req.params = {
        Project_id: ctx.projectId.toString(),
        user_id: ctx.requesterId.toString(),
      }
      ctx.req.body = {}
      ctx.ProjectGetter.promises.getProject.resolves({
        _id: ctx.projectId,
        name: 'My Project',
      })
      ctx.UserGetter.promises.getUser.resolves({
        email: 'req@example.com',
      })
    })

    it('pulls the entry, emits, and skips email when notify is absent', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.declineAccessRequest(ctx.req, ctx.res)
      })
      expect(
        ctx.CollaboratorsHandler.promises.declineAccessRequest
      ).to.have.been.calledWith(
        ctx.projectId.toString(),
        ctx.requesterId.toString()
      )
      expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        ctx.projectId.toString(),
        'project:membership:changed',
        { accessRequests: true }
      )
      expect(ctx.EmailHandler.promises.sendEmail).to.not.have.been.called
    })

    it('records a deny analytics event regardless of notify', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.declineAccessRequest(ctx.req, ctx.res)
      })
      expect(
        ctx.AnalyticsManager.recordEventForUserInBackground
      ).to.have.been.calledWith(
        ctx.user._id,
        'project-access-request-actioned',
        {
          projectId: ctx.projectId.toString(),
          privilegeLevel: 'review',
          decision: 'deny',
        }
      )
    })

    it('does not record an analytics event when nothing was pulled', async function (ctx) {
      ctx.CollaboratorsHandler.promises.declineAccessRequest.resolves({
        removed: false,
      })
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.declineAccessRequest(ctx.req, ctx.res)
      })
      expect(ctx.AnalyticsManager.recordEventForUserInBackground).to.not.have
        .been.called
    })

    it('sends the declined email when notify=true and something was removed', async function (ctx) {
      ctx.req.body = { notify: true }
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.declineAccessRequest(ctx.req, ctx.res)
      })
      await new Promise(r => setImmediate(r))
      expect(ctx.EmailHandler.promises.sendEmail).to.have.been.calledWith(
        'accessRequestDeclined',
        sinon.match({ to: 'req@example.com' })
      )
    })

    it('skips the declined email when nothing was actually pulled', async function (ctx) {
      ctx.req.body = { notify: true }
      ctx.CollaboratorsHandler.promises.declineAccessRequest.resolves({
        removed: false,
      })
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.declineAccessRequest(ctx.req, ctx.res)
      })
      expect(ctx.EmailHandler.promises.sendEmail).to.not.have.been.called
    })
  })

  describe('declineAccessRequest with a malformed project id', function () {
    it('rejects the request instead of declining it', async function (ctx) {
      ctx.req.params = {
        Project_id: 'not-an-object-id',
        user_id: new ObjectId().toString(),
      }
      await ctx.CollaboratorsController.declineAccessRequest(
        ctx.req,
        ctx.res
      ).should.be.rejectedWith(InvalidParamsError)
      expect(ctx.CollaboratorsHandler.promises.declineAccessRequest).to.not.have
        .been.called
    })
  })

  describe('grantAccessRequest', function () {
    beforeEach(function (ctx) {
      ctx.requesterId = new ObjectId()
      ctx.req.params = {
        Project_id: ctx.projectId.toString(),
        user_id: ctx.requesterId.toString(),
      }
      ctx.req.body = { privilegeLevel: 'readAndWrite', notify: true }
      ctx.projectAccess.getAccessRequestForUser = sinon.stub().returns({
        privilegeLevel: 'readAndWrite',
        requestedAt: new Date(),
      })
      ctx.ProjectGetter.promises.getProject.resolves({
        _id: ctx.projectId,
        name: 'My Project',
      })
      ctx.UserGetter.promises.getUser.resolves({
        email: 'req@example.com',
      })
    })

    it('refuses to grant when it would exceed the collaborator limit', async function (ctx) {
      ctx.LimitationsManager.promises.canChangeCollaboratorPrivilegeLevel.resolves(
        false
      )
      await new Promise(resolve => {
        ctx.HttpErrorHandler.forbidden = sinon.spy(() => resolve())
        ctx.CollaboratorsController.grantAccessRequest(ctx.req, ctx.res)
      })
      expect(ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel).to
        .not.have.been.called
      expect(ctx.AnalyticsManager.recordEventForUserInBackground).to.not.have
        .been.called
    })

    it('skips the limit check when the requester already holds the target level', async function (ctx) {
      // idempotent re-grant: already at the requested level, so granting must
      // not be blocked even when the project is at its collaborator limit
      ctx.projectAccess.privilegeLevelForUser = sinon
        .stub()
        .returns('readAndWrite')
      ctx.LimitationsManager.promises.canChangeCollaboratorPrivilegeLevel.resolves(
        false
      )
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.grantAccessRequest(ctx.req, ctx.res)
      })
      expect(
        ctx.LimitationsManager.promises.canChangeCollaboratorPrivilegeLevel
      ).to.not.have.been.called
      expect(
        ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel
      ).to.have.been.calledWith(
        ctx.projectId.toString(),
        ctx.requesterId.toString(),
        'readAndWrite'
      )
    })

    it('promotes via setCollaboratorPrivilegeLevel and notifies', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.grantAccessRequest(ctx.req, ctx.res)
      })
      expect(
        ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel
      ).to.have.been.calledWith(
        ctx.projectId.toString(),
        ctx.requesterId.toString(),
        'readAndWrite'
      )
      expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        ctx.projectId.toString(),
        'project:membership:changed',
        { members: true, invites: true, accessRequests: true }
      )
      await new Promise(r => setImmediate(r))
      expect(ctx.EmailHandler.promises.sendEmail).to.have.been.calledWith(
        'accessRequestGranted',
        sinon.match({ to: 'req@example.com', privilegeLevel: 'readAndWrite' })
      )
    })

    it('clears any pending invite for the granted user', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.grantAccessRequest(ctx.req, ctx.res)
      })
      expect(
        ctx.UserGetter.promises.getUserConfirmedEmails
      ).to.have.been.calledWith(ctx.requesterId.toString())
      expect(
        ctx.CollaboratorsInviteHandler.promises.revokeInviteForUser
      ).to.have.been.calledWith(ctx.projectId.toString(), [
        { email: 'req@example.com' },
      ])
    })

    it('records an accept analytics event with the granted level', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.grantAccessRequest(ctx.req, ctx.res)
      })
      expect(
        ctx.AnalyticsManager.recordEventForUserInBackground
      ).to.have.been.calledWith(
        ctx.user._id,
        'project-access-request-actioned',
        {
          projectId: ctx.projectId.toString(),
          privilegeLevel: 'readAndWrite',
          decision: 'accept',
        }
      )
    })

    it('skips the granted email when there was no pending request', async function (ctx) {
      ctx.projectAccess.getAccessRequestForUser = sinon.stub().returns(null)
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.grantAccessRequest(ctx.req, ctx.res)
      })
      expect(ctx.EmailHandler.promises.sendEmail).to.not.have.been.called
    })

    it('does not record an analytics event when there was no pending request', async function (ctx) {
      ctx.projectAccess.getAccessRequestForUser = sinon.stub().returns(null)
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.grantAccessRequest(ctx.req, ctx.res)
      })
      expect(ctx.AnalyticsManager.recordEventForUserInBackground).to.not.have
        .been.called
    })

    it('still records the accept event when notify=false', async function (ctx) {
      ctx.req.body = { privilegeLevel: 'review', notify: false }
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.grantAccessRequest(ctx.req, ctx.res)
      })
      expect(ctx.EmailHandler.promises.sendEmail).to.not.have.been.called
      expect(
        ctx.AnalyticsManager.recordEventForUserInBackground
      ).to.have.been.calledWith(
        ctx.user._id,
        'project-access-request-actioned',
        {
          projectId: ctx.projectId.toString(),
          privilegeLevel: 'review',
          decision: 'accept',
        }
      )
    })
  })

  describe('grantAccessRequest with a malformed project id', function () {
    it('rejects the request instead of granting it', async function (ctx) {
      ctx.req.params = {
        Project_id: 'not-an-object-id',
        user_id: new ObjectId().toString(),
      }
      ctx.req.body = { privilegeLevel: 'readAndWrite' }
      await ctx.CollaboratorsController.grantAccessRequest(
        ctx.req,
        ctx.res
      ).should.be.rejectedWith(InvalidParamsError)
      expect(ctx.CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel).to
        .not.have.been.called
    })
  })

  describe('getShareTokens', function () {
    beforeEach(function (ctx) {
      ctx.req.params = { Project_id: ctx.projectId.toString() }
    })

    it('rejects a malformed project id before checking anything else', async function (ctx) {
      ctx.req.params = { Project_id: 'not-an-object-id' }
      await ctx.CollaboratorsController.getShareTokens(
        ctx.req,
        ctx.res
      ).should.be.rejectedWith(InvalidParamsError)
      expect(ctx.CollaboratorsGetter.promises.getPublicShareTokens).to.not.have
        .been.called
    })

    it('returns 403 when link sharing is disabled', async function (ctx) {
      ctx.Features.hasFeature.withArgs('link-sharing').returns(false)
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.getShareTokens(ctx.req, ctx.res)
      })
      expect(ctx.res.sendStatus).to.have.been.calledWith(403)
      expect(ctx.CollaboratorsGetter.promises.getPublicShareTokens).to.not.have
        .been.called
    })

    it('returns 403 when the logged in user has no share tokens', async function (ctx) {
      ctx.CollaboratorsGetter.promises.getPublicShareTokens.resolves(null)
      await new Promise(resolve => {
        ctx.res.sendStatus = sinon.spy(() => resolve())
        ctx.CollaboratorsController.getShareTokens(ctx.req, ctx.res)
      })
      expect(ctx.res.sendStatus).to.have.been.calledWith(403)
    })

    it('returns the hashed tokens for a logged in user', async function (ctx) {
      ctx.CollaboratorsGetter.promises.getPublicShareTokens.resolves({
        readOnly: 'ro-token',
        readAndWrite: 'rw-token',
      })
      await new Promise(resolve => {
        ctx.res.json = sinon.spy(() => resolve())
        ctx.CollaboratorsController.getShareTokens(ctx.req, ctx.res)
      })
      expect(
        ctx.CollaboratorsGetter.promises.getPublicShareTokens
      ).to.have.been.calledWith(
        new ObjectId(ctx.user._id.toString()),
        new ObjectId(ctx.projectId.toString())
      )
      expect(ctx.res.json).to.have.been.calledWith({
        readOnly: 'ro-token',
        readAndWrite: 'rw-token',
        readOnlyHashPrefix: 'hash-prefix',
        readAndWriteHashPrefix: 'hash-prefix',
      })
    })

    it('falls back to the session token for an anonymous request', async function (ctx) {
      ctx.SessionManager.getLoggedInUserId = sinon.stub().returns(null)
      ctx.TokenAccessHandler.getRequestToken = sinon
        .stub()
        .returns('anon-ro-token')
      await new Promise(resolve => {
        ctx.res.json = sinon.spy(() => resolve())
        ctx.CollaboratorsController.getShareTokens(ctx.req, ctx.res)
      })
      expect(ctx.CollaboratorsGetter.promises.getPublicShareTokens).to.not.have
        .been.called
      expect(ctx.TokenAccessHandler.getRequestToken).to.have.been.calledWith(
        ctx.req,
        ctx.projectId.toString()
      )
      expect(ctx.res.json).to.have.been.calledWith({
        readOnly: 'anon-ro-token',
        readOnlyHashPrefix: 'hash-prefix',
      })
    })
  })
})
