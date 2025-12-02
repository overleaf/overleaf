import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
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

    ctx.user = { _id: new ObjectId() }
    ctx.projectId = new ObjectId()
    ctx.callback = sinon.stub()

    ctx.CollaboratorsHandler = {
      promises: {
        removeUserFromProject: sinon.stub().resolves(),
        setCollaboratorPrivilegeLevel: sinon.stub().resolves(),
      },
      createTokenHashPrefix: sinon.stub().returns('abc123'),
    }
    ctx.CollaboratorsGetter = {
      promises: {
        getAllInvitedMembers: sinon.stub(),
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
    ctx.OwnershipTransferHandler = {
      promises: {
        transferOwnership: sinon.stub().resolves(),
      },
    }
    ctx.TokenAccessHandler = {
      getRequestToken: sinon.stub().returns('access-token'),
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

    ctx.CollaboratorsController = (await import(MODULE_PATH)).default
  })

  describe('removeUserFromProject', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.req.params = {
          Project_id: ctx.projectId,
          user_id: ctx.user._id,
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
      ).to.have.been.calledWith(ctx.projectId, ctx.user._id)
    })

    it('should emit a userRemovedFromProject event to the proejct', function (ctx) {
      expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        ctx.projectId,
        'userRemovedFromProject',
        ctx.user._id
      )
    })

    it('should send the back a success response', function (ctx) {
      ctx.res.sendStatus.calledWith(204).should.equal(true)
    })

    it('should have called emitToRoom', function (ctx) {
      expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        ctx.projectId,
        'project:membership:changed'
      )
    })

    it('should write a project audit log', function (ctx) {
      ctx.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
        ctx.projectId,
        'remove-collaborator',
        ctx.user._id,
        ctx.req.ip,
        { userId: ctx.user._id }
      )
    })
  })

  describe('removeSelfFromProject', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.req.params = { Project_id: ctx.projectId }
        ctx.res.sendStatus = sinon.spy(() => {
          resolve()
        })
        ctx.CollaboratorsController.removeSelfFromProject(ctx.req, ctx.res)
      })
    })

    it('should remove the logged in user from the project', function (ctx) {
      expect(
        ctx.CollaboratorsHandler.promises.removeUserFromProject
      ).to.have.been.calledWith(ctx.projectId, ctx.user._id)
    })

    it('should emit a userRemovedFromProject event to the proejct', function (ctx) {
      expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        ctx.projectId,
        'userRemovedFromProject',
        ctx.user._id
      )
    })

    it('should remove the project from all tags', function (ctx) {
      expect(
        ctx.TagsHandler.promises.removeProjectFromAllTags
      ).to.have.been.calledWith(ctx.user._id, ctx.projectId)
    })

    it('should return a success code', function (ctx) {
      ctx.res.sendStatus.calledWith(204).should.equal(true)
    })

    it('should write a project audit log', function (ctx) {
      ctx.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
        ctx.projectId,
        'leave-project',
        ctx.user._id,
        ctx.req.ip
      )
    })
  })

  describe('getAllMembers', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.req.params = { Project_id: ctx.projectId }
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
  })
})
