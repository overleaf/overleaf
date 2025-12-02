import { expect, vi } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import _ from 'lodash'

const ObjectId = mongodb.ObjectId

const MODULE_PATH =
  '../../../../app/src/Features/Collaborators/CollaboratorsInviteController.mjs'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('CollaboratorsInviteController', function () {
  beforeEach(async function (ctx) {
    ctx.projectId = '650f1f4f4f1c2c6d88f0e8b1'
    ctx.token = 'some-opaque-token'
    ctx.tokenHmac = 'some-hmac-token'
    ctx.targetEmail = 'user@example.com'
    ctx.privileges = 'readAndWrite'
    ctx.projectOwner = {
      _id: 'project-owner-id',
      email: 'project-owner@example.com',
    }
    ctx.currentUser = {
      _id: 'current-user-id',
      email: 'current-user@example.com',
    }
    ctx.invite = {
      _id: new ObjectId(),
      token: ctx.token,
      tokenHmac: ctx.tokenHmac,
      sendingUserId: ctx.currentUser._id,
      projectId: ctx.projectId,
      email: ctx.targetEmail,
      privileges: ctx.privileges,
      createdAt: new Date(),
    }
    ctx.inviteReducedData = _.pick(ctx.invite, ['_id', 'email', 'privileges'])
    ctx.project = {
      _id: ctx.projectId,
      owner_ref: ctx.projectOwner._id,
    }

    ctx.SessionManager = {
      getSessionUser: sinon.stub().returns(ctx.currentUser),
    }

    ctx.AnalyticsManger = { recordEventForUserInBackground: sinon.stub() }

    ctx.rateLimiter = {
      consume: sinon.stub().resolves(),
    }
    ctx.RateLimiter = {
      RateLimiter: sinon.stub().returns(ctx.rateLimiter),
    }

    ctx.LimitationsManager = {
      promises: {
        allowedNumberOfCollaboratorsForUser: sinon.stub(),
        canAddXEditCollaborators: sinon.stub().resolves(true),
      },
    }

    ctx.UserGetter = {
      promises: {
        getUserByAnyEmail: sinon.stub(),
        getUser: sinon.stub(),
      },
    }

    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub(),
      },
    }

    ctx.CollaboratorsGetter = {
      promises: {
        isUserInvitedMemberOfProject: sinon.stub(),
      },
    }

    ctx.CollaboratorsInviteHandler = {
      promises: {
        inviteToProject: sinon.stub().resolves(ctx.inviteReducedData),
        generateNewInvite: sinon.stub().resolves(ctx.invite),
        revokeInvite: sinon.stub().resolves(ctx.invite),
        acceptInvite: sinon.stub(),
      },
    }

    ctx.CollaboratorsInviteGetter = {
      promises: {
        getAllInvites: sinon.stub(),
        getInviteByToken: sinon.stub().resolves(ctx.invite),
      },
    }

    ctx.EditorRealTimeController = {
      emitToRoom: sinon.stub(),
    }

    ctx.settings = {}

    ctx.ProjectAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
      addEntryInBackground: sinon.stub(),
    }

    ctx.AuthenticationController = {
      setRedirectInSession: sinon.stub(),
    }

    ctx.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
        getAssignmentForUser: sinon.stub().resolves({ variant: 'default' }),
      },
    }

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter.mjs', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectAuditLogHandler.mjs',
      () => ({
        default: ctx.ProjectAuditLogHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/LimitationsManager.mjs',
      () => ({
        default: ctx.LimitationsManager,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter.mjs', () => ({
      default: ctx.UserGetter,
    }))

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
      '../../../../app/src/Features/Collaborators/CollaboratorsInviteGetter.mjs',
      () => ({
        default: ctx.CollaboratorsInviteGetter,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Editor/EditorRealTimeController.mjs',
      () => ({
        default: ctx.EditorRealTimeController,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager.mjs',
      () => ({
        default: ctx.AnalyticsManger,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager.mjs',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock(
      '../../../../app/src/infrastructure/RateLimiter',
      () => ctx.RateLimiter
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationController',
      () => ({
        default: ctx.AuthenticationController,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    ctx.CollaboratorsInviteController = (await import(MODULE_PATH)).default

    ctx.res = new MockResponse(vi)
    ctx.req = new MockRequest(vi)
    ctx.next = sinon.stub()
  })

  describe('getAllInvites', function () {
    beforeEach(function (ctx) {
      ctx.fakeInvites = [
        { _id: new ObjectId(), one: 1 },
        { _id: new ObjectId(), two: 2 },
      ]
      ctx.req.params = { Project_id: ctx.projectId }
    })

    describe('when all goes well', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.CollaboratorsInviteGetter.promises.getAllInvites.resolves(
            ctx.fakeInvites
          )
          ctx.res.callback = () => resolve()
          ctx.CollaboratorsInviteController.getAllInvites(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should not produce an error', function (ctx) {
        ctx.next.callCount.should.equal(0)
      })

      it('should produce a list of invite objects', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledTimes(1)
        expect(ctx.res.json).toHaveBeenCalledWith({ invites: ctx.fakeInvites })
      })

      it('should have called CollaboratorsInviteHandler.getAllInvites', function (ctx) {
        ctx.CollaboratorsInviteGetter.promises.getAllInvites.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteGetter.promises.getAllInvites
          .calledWith(ctx.projectId)
          .should.equal(true)
      })
    })

    describe('when CollaboratorsInviteHandler.getAllInvites produces an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.CollaboratorsInviteGetter.promises.getAllInvites.rejects(
            new Error('woops')
          )
          ctx.next.callsFake(() => resolve())
          ctx.CollaboratorsInviteController.getAllInvites(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should produce an error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        ctx.next.firstCall.args[0].should.be.instanceof(Error)
      })
    })
  })

  describe('inviteToProject', function () {
    beforeEach(function (ctx) {
      ctx.req.params = { Project_id: ctx.projectId }
      ctx.req.body = {
        email: ctx.targetEmail,
        privileges: ctx.privileges,
      }
      ctx.ProjectGetter.promises.getProject.resolves({
        owner_ref: ctx.project.owner_ref,
      })
    })

    describe('when all goes well', function (done) {
      beforeEach(async function (ctx) {
        ctx.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .resolves(true)
        ctx.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .resolves(true)

        await ctx.CollaboratorsInviteController.inviteToProject(
          ctx.req,
          ctx.res
        )
      })

      it('should produce json response', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledTimes(1)
        expect(ctx.res.json.mock.calls[0][0]).to.deep.equal({
          invite: ctx.inviteReducedData,
        })
      })

      it('should have called canAddXEditCollaborators', function (ctx) {
        ctx.LimitationsManager.promises.canAddXEditCollaborators.callCount.should.equal(
          1
        )
        ctx.LimitationsManager.promises.canAddXEditCollaborators
          .calledWith(ctx.projectId)
          .should.equal(true)
      })

      it('should have called _checkShouldInviteEmail', function (ctx) {
        ctx.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          1
        )

        ctx.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(ctx.targetEmail)
          .should.equal(true)
      })

      it('should have called inviteToProject', function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteHandler.promises.inviteToProject
          .calledWith(
            ctx.projectId,
            ctx.currentUser,
            ctx.targetEmail,
            ctx.privileges
          )
          .should.equal(true)
      })

      it('should have called emitToRoom', function (ctx) {
        ctx.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
        ctx.EditorRealTimeController.emitToRoom
          .calledWith(ctx.projectId, 'project:membership:changed')
          .should.equal(true)
      })

      it('adds a project audit log entry', function (ctx) {
        ctx.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
          ctx.projectId,
          'send-invite',
          ctx.currentUser._id,
          ctx.req.ip,
          {
            inviteId: ctx.invite._id,
            privileges: ctx.privileges,
          }
        )
      })
    })

    describe('when the user is not allowed to add more edit collaborators', function () {
      beforeEach(function (ctx) {
        ctx.LimitationsManager.promises.canAddXEditCollaborators.resolves(false)
      })

      describe('readAndWrite collaborator', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.privileges = 'readAndWrite'
            ctx.CollaboratorsInviteController._checkShouldInviteEmail = sinon
              .stub()
              .resolves(true)
            ctx.CollaboratorsInviteController._checkRateLimit = sinon
              .stub()
              .resolves(true)
            ctx.res.callback = () => resolve()
            ctx.CollaboratorsInviteController.inviteToProject(
              ctx.req,
              ctx.res,
              ctx.next
            )
          })
        })

        it('should produce json response without an invite', function (ctx) {
          expect(ctx.res.json).toHaveBeenCalledTimes(1)
          expect(ctx.res.json.mock.calls[0][0]).to.deep.equal({
            invite: null,
          })
        })

        it('should not have called _checkShouldInviteEmail', function (ctx) {
          ctx.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
            0
          )
          ctx.CollaboratorsInviteController._checkShouldInviteEmail
            .calledWith(ctx.currentUser, ctx.targetEmail)
            .should.equal(false)
        })

        it('should not have called inviteToProject', function (ctx) {
          ctx.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
            0
          )
        })
      })

      describe('readOnly collaborator (always allowed)', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.req.body = {
              email: ctx.targetEmail,
              privileges: (ctx.privileges = 'readOnly'),
            }
            ctx.CollaboratorsInviteController._checkShouldInviteEmail = sinon
              .stub()
              .resolves(true)
            ctx.CollaboratorsInviteController._checkRateLimit = sinon
              .stub()
              .resolves(true)
            ctx.res.callback = () => resolve()
            ctx.CollaboratorsInviteController.inviteToProject(
              ctx.req,
              ctx.res,
              ctx.next
            )
          })
        })

        it('should produce json response', function (ctx) {
          expect(ctx.res.json).toHaveBeenCalledTimes(1)
          expect(ctx.res.json.mock.calls[0][0]).to.deep.equal({
            invite: ctx.inviteReducedData,
          })
        })

        it('should not have called canAddXEditCollaborators', function (ctx) {
          ctx.LimitationsManager.promises.canAddXEditCollaborators.callCount.should.equal(
            0
          )
        })

        it('should have called _checkShouldInviteEmail', function (ctx) {
          ctx.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
            1
          )
          ctx.CollaboratorsInviteController._checkShouldInviteEmail
            .calledWith(ctx.targetEmail)
            .should.equal(true)
        })

        it('should have called inviteToProject', function (ctx) {
          ctx.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
            1
          )
          ctx.CollaboratorsInviteHandler.promises.inviteToProject
            .calledWith(
              ctx.projectId,
              ctx.currentUser,
              ctx.targetEmail,
              ctx.privileges
            )
            .should.equal(true)
        })

        it('should have called emitToRoom', function (ctx) {
          ctx.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
          ctx.EditorRealTimeController.emitToRoom
            .calledWith(ctx.projectId, 'project:membership:changed')
            .should.equal(true)
        })

        it('adds a project audit log entry', function (ctx) {
          ctx.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
            ctx.projectId,
            'send-invite',
            ctx.currentUser._id,
            ctx.req.ip,
            {
              inviteId: ctx.invite._id,
              privileges: ctx.privileges,
            }
          )
        })
      })
    })

    describe('when inviteToProject produces an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.CollaboratorsInviteController._checkShouldInviteEmail = sinon
            .stub()
            .resolves(true)
          ctx.CollaboratorsInviteController._checkRateLimit = sinon
            .stub()
            .resolves(true)
          ctx.CollaboratorsInviteHandler.promises.inviteToProject.rejects(
            new Error('woops')
          )
          ctx.next.callsFake(() => resolve())
          ctx.CollaboratorsInviteController.inviteToProject(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should call next with an error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        expect(ctx.next).to.have.been.calledWith(sinon.match.instanceOf(Error))
      })

      it('should have called canAddXEditCollaborators', function (ctx) {
        ctx.LimitationsManager.promises.canAddXEditCollaborators.callCount.should.equal(
          1
        )
        ctx.LimitationsManager.promises.canAddXEditCollaborators
          .calledWith(ctx.projectId)
          .should.equal(true)
      })

      it('should have called _checkShouldInviteEmail', function (ctx) {
        ctx.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(ctx.targetEmail)
          .should.equal(true)
      })

      it('should have called inviteToProject', function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteHandler.promises.inviteToProject
          .calledWith(
            ctx.projectId,
            ctx.currentUser,
            ctx.targetEmail,
            ctx.privileges
          )
          .should.equal(true)
      })
    })

    describe('when _checkShouldInviteEmail disallows the invite', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.CollaboratorsInviteController._checkShouldInviteEmail = sinon
            .stub()
            .resolves(false)
          ctx.CollaboratorsInviteController._checkRateLimit = sinon
            .stub()
            .resolves(true)
          ctx.res.callback = () => resolve()
          ctx.CollaboratorsInviteController.inviteToProject(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should produce json response with no invite, and an error property', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledTimes(1)
        expect(ctx.res.json.mock.calls[0][0]).to.deep.equal({
          invite: null,
          error: 'cannot_invite_non_user',
        })
      })

      it('should have called _checkShouldInviteEmail', function (ctx) {
        ctx.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(ctx.targetEmail)
          .should.equal(true)
      })

      it('should not have called inviteToProject', function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          0
        )
      })
    })

    describe('when _checkShouldInviteEmail produces an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.CollaboratorsInviteController._checkShouldInviteEmail = sinon
            .stub()
            .rejects(new Error('woops'))
          ctx.CollaboratorsInviteController._checkRateLimit = sinon
            .stub()
            .resolves(true)
          ctx.next.callsFake(() => resolve())
          ctx.CollaboratorsInviteController.inviteToProject(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should call next with an error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        ctx.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should have called _checkShouldInviteEmail', function (ctx) {
        ctx.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(ctx.targetEmail)
          .should.equal(true)
      })

      it('should not have called inviteToProject', function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          0
        )
      })
    })

    describe('when the user invites themselves to the project', function () {
      beforeEach(function (ctx) {
        ctx.req.body.email = ctx.currentUser.email
        ctx.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .resolves(true)
        ctx.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .resolves(true)
        ctx.CollaboratorsInviteController.inviteToProject(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should reject action, return json response with error code', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledTimes(1)
        expect(ctx.res.json.mock.calls[0][0]).to.deep.equal({
          invite: null,
          error: 'cannot_invite_self',
        })
      })

      it('should not have called canAddXEditCollaborators', function (ctx) {
        ctx.LimitationsManager.promises.canAddXEditCollaborators.callCount.should.equal(
          0
        )
      })

      it('should not have called _checkShouldInviteEmail', function (ctx) {
        ctx.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          0
        )
      })

      it('should not have called inviteToProject', function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          0
        )
      })

      it('should not have called emitToRoom', function (ctx) {
        ctx.EditorRealTimeController.emitToRoom.callCount.should.equal(0)
      })
    })

    describe('when _checkRateLimit returns false', function () {
      beforeEach(async function (ctx) {
        ctx.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .resolves(true)
        ctx.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .resolves(false)
        await ctx.CollaboratorsInviteController.inviteToProject(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should send a 429 response', function (ctx) {
        expect(ctx.res.sendStatus).toHaveBeenCalledWith(429)
      })

      it('should not call inviteToProject', function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.inviteToProject.called.should.equal(
          false
        )
      })

      it('should not call emitToRoom', function (ctx) {
        ctx.EditorRealTimeController.emitToRoom.called.should.equal(false)
      })
    })
  })

  describe('viewInvite', function () {
    beforeEach(function (ctx) {
      ctx.req.params = {
        Project_id: ctx.projectId,
        token: ctx.token,
      }
      ctx.fakeProject = {
        _id: ctx.projectId,
        name: 'some project',
        owner_ref: ctx.invite.sendingUserId,
        collaberator_refs: [],
        readOnly_refs: [],
      }
      ctx.owner = {
        _id: ctx.fakeProject.owner_ref,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      }

      ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.resolves(
        false
      )
      ctx.CollaboratorsInviteGetter.promises.getInviteByToken.resolves(
        ctx.invite
      )
      ctx.ProjectGetter.promises.getProject.resolves(ctx.fakeProject)
      ctx.UserGetter.promises.getUser.resolves(ctx.owner)
    })

    describe('when the token is valid', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.res.callback = () => resolve()
          ctx.CollaboratorsInviteController.viewInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should render the view template', function (ctx) {
        expect(ctx.res.render).toHaveBeenCalledTimes(1)
        expect(ctx.res.render).toHaveBeenCalledWith(
          'project/invite/show',
          expect.anything()
        )
      })

      it('should not call next', function (ctx) {
        ctx.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function (ctx) {
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(ctx.currentUser._id, ctx.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function (ctx) {
        ctx.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
        ctx.CollaboratorsInviteGetter.promises.getInviteByToken
          .calledWith(ctx.fakeProject._id, ctx.invite.token)
          .should.equal(true)
      })

      it('should call User.getUser', function (ctx) {
        ctx.UserGetter.promises.getUser.callCount.should.equal(1)
        ctx.UserGetter.promises.getUser
          .calledWith({ _id: ctx.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should call ProjectGetter.getProject', function (ctx) {
        ctx.ProjectGetter.promises.getProject.callCount.should.equal(1)
        ctx.ProjectGetter.promises.getProject
          .calledWith(ctx.projectId)
          .should.equal(true)
      })
    })

    describe('when not logged in', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.SessionManager.getSessionUser.returns(null)

          ctx.res.callback = () => resolve()
          ctx.CollaboratorsInviteController.viewInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })
      it('should not check member status', function (ctx) {
        expect(ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject).to
          .not.have.been.called
      })

      it('should set redirect back to invite', function (ctx) {
        expect(
          ctx.AuthenticationController.setRedirectInSession
        ).to.have.been.calledWith(ctx.req)
      })

      it('should redirect to the register page', function (ctx) {
        expect(ctx.res.render).not.toHaveBeenCalled()
        expect(ctx.res.redirect).toHaveBeenCalledTimes(1)
        expect(ctx.res.redirect).toHaveBeenCalledWith('/register')
      })
    })

    describe('when user is already a member of the project', function () {
      beforeEach(async function (ctx) {
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.resolves(
          true
        )
        await ctx.CollaboratorsInviteController.viewInvite(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should redirect to the project page', function (ctx) {
        expect(ctx.res.redirect).toHaveBeenCalledTimes(1)
        expect(ctx.res.redirect).toHaveBeenCalledWith(
          `/project/${ctx.projectId}`
        )
      })

      it('should not call next with an error', function (ctx) {
        ctx.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function (ctx) {
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(ctx.currentUser._id, ctx.projectId)
          .should.equal(true)
      })

      it('should not call getInviteByToken', function (ctx) {
        ctx.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          0
        )
      })

      it('should not call User.getUser', function (ctx) {
        ctx.UserGetter.promises.getUser.callCount.should.equal(0)
      })

      it('should not call ProjectGetter.getProject', function (ctx) {
        ctx.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })
    })

    describe('when isUserInvitedMemberOfProject produces an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.rejects(
            new Error('woops')
          )
          ctx.next.callsFake(() => resolve())
          ctx.CollaboratorsInviteController.viewInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should call next with an error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        expect(ctx.next.firstCall.args[0]).to.be.instanceof(Error)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function (ctx) {
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(ctx.currentUser._id, ctx.projectId)
          .should.equal(true)
      })

      it('should not call getInviteByToken', function (ctx) {
        ctx.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          0
        )
      })

      it('should not call User.getUser', function (ctx) {
        ctx.UserGetter.promises.getUser.callCount.should.equal(0)
      })

      it('should not call ProjectGetter.getProject', function (ctx) {
        ctx.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })
    })

    describe('when the getInviteByToken produces an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.CollaboratorsInviteGetter.promises.getInviteByToken.rejects(
            new Error('woops')
          )
          ctx.next.callsFake(() => resolve())
          ctx.CollaboratorsInviteController.viewInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should call next with the error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        ctx.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function (ctx) {
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(ctx.currentUser._id, ctx.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function (ctx) {
        ctx.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(ctx.currentUser._id, ctx.projectId)
          .should.equal(true)
      })

      it('should not call User.getUser', function (ctx) {
        ctx.UserGetter.promises.getUser.callCount.should.equal(0)
      })

      it('should not call ProjectGetter.getProject', function (ctx) {
        ctx.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })
    })

    describe('when the getInviteByToken does not produce an invite', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.CollaboratorsInviteGetter.promises.getInviteByToken.resolves(null)
          ctx.res.callback = () => resolve()
          ctx.CollaboratorsInviteController.viewInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should render the not-valid view template', function (ctx) {
        expect(ctx.res.render).toHaveBeenCalledTimes(1)
        expect(ctx.res.render).toHaveBeenCalledWith(
          'project/invite/not-valid',
          expect.anything()
        )
      })

      it('should not call next', function (ctx) {
        ctx.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function (ctx) {
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(ctx.currentUser._id, ctx.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function (ctx) {
        ctx.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(ctx.currentUser._id, ctx.projectId)
          .should.equal(true)
      })

      it('should not call User.getUser', function (ctx) {
        ctx.UserGetter.promises.getUser.callCount.should.equal(0)
      })

      it('should not call ProjectGetter.getProject', function (ctx) {
        ctx.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })
    })

    describe('when User.getUser produces an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.UserGetter.promises.getUser.rejects(new Error('woops'))
          ctx.next.callsFake(() => resolve())
          ctx.CollaboratorsInviteController.viewInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should produce an error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        expect(ctx.next.firstCall.args[0]).to.be.instanceof(Error)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function (ctx) {
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(ctx.currentUser._id, ctx.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function (ctx) {
        ctx.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
      })

      it('should call User.getUser', function (ctx) {
        ctx.UserGetter.promises.getUser.callCount.should.equal(1)
        ctx.UserGetter.promises.getUser
          .calledWith({ _id: ctx.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should not call ProjectGetter.getProject', function (ctx) {
        ctx.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })
    })

    describe('when User.getUser does not find a user', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.UserGetter.promises.getUser.resolves(null)
          ctx.res.callback = () => resolve()
          ctx.CollaboratorsInviteController.viewInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should render the not-valid view template', function (ctx) {
        expect(ctx.res.render).toHaveBeenCalledTimes(1)
        expect(ctx.res.render).toHaveBeenCalledWith(
          'project/invite/not-valid',
          expect.anything()
        )
      })

      it('should not call next', function (ctx) {
        ctx.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function (ctx) {
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(ctx.currentUser._id, ctx.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function (ctx) {
        ctx.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
      })

      it('should call User.getUser', function (ctx) {
        ctx.UserGetter.promises.getUser.callCount.should.equal(1)
        ctx.UserGetter.promises.getUser
          .calledWith({ _id: ctx.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should not call ProjectGetter.getProject', function (ctx) {
        ctx.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })
    })

    describe('when getProject produces an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ProjectGetter.promises.getProject.rejects(new Error('woops'))
          ctx.next.callsFake(() => resolve())
          ctx.CollaboratorsInviteController.viewInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should produce an error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        expect(ctx.next.firstCall.args[0]).to.be.instanceof(Error)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function (ctx) {
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(ctx.currentUser._id, ctx.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function (ctx) {
        ctx.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
      })

      it('should call User.getUser', function (ctx) {
        ctx.UserGetter.promises.getUser.callCount.should.equal(1)
        ctx.UserGetter.promises.getUser
          .calledWith({ _id: ctx.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should call ProjectGetter.getProject', function (ctx) {
        ctx.ProjectGetter.promises.getProject.callCount.should.equal(1)
      })
    })

    describe('when Project.getUser does not find a user', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ProjectGetter.promises.getProject.resolves(null)
          ctx.res.callback = () => resolve()
          ctx.CollaboratorsInviteController.viewInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should render the not-valid view template', function (ctx) {
        expect(ctx.res.render).toHaveBeenCalledTimes(1)
        expect(ctx.res.render).toHaveBeenCalledWith(
          'project/invite/not-valid',
          expect.anything()
        )
      })

      it('should not call next', function (ctx) {
        ctx.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function (ctx) {
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(ctx.currentUser._id, ctx.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function (ctx) {
        ctx.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
      })

      it('should call getUser', function (ctx) {
        ctx.UserGetter.promises.getUser.callCount.should.equal(1)
        ctx.UserGetter.promises.getUser
          .calledWith({ _id: ctx.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should call ProjectGetter.getProject', function (ctx) {
        ctx.ProjectGetter.promises.getProject.callCount.should.equal(1)
      })
    })
  })

  describe('generateNewInvite', function () {
    beforeEach(function (ctx) {
      ctx.req.params = {
        Project_id: ctx.projectId,
        invite_id: ctx.invite._id.toString(),
      }
      ctx.CollaboratorsInviteController._checkRateLimit = sinon
        .stub()
        .resolves(true)
    })

    describe('when generateNewInvite does not produce an error', function () {
      describe('and returns an invite object', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.res.callback = () => resolve()
            ctx.CollaboratorsInviteController.generateNewInvite(
              ctx.req,
              ctx.res,
              ctx.next
            )
          })
        })

        it('should produce a 201 response', function (ctx) {
          expect(ctx.res.sendStatus).toHaveBeenCalledTimes(1)
          expect(ctx.res.sendStatus).toHaveBeenCalledWith(201)
        })

        it('should have called generateNewInvite', function (ctx) {
          ctx.CollaboratorsInviteHandler.promises.generateNewInvite.callCount.should.equal(
            1
          )
        })

        it('should have called emitToRoom', function (ctx) {
          ctx.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
          ctx.EditorRealTimeController.emitToRoom
            .calledWith(ctx.projectId, 'project:membership:changed')
            .should.equal(true)
        })

        it('should check the rate limit', function (ctx) {
          ctx.CollaboratorsInviteController._checkRateLimit.callCount.should.equal(
            1
          )
        })

        it('should add a project audit log entry', function (ctx) {
          ctx.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
            ctx.projectId,
            'resend-invite',
            ctx.currentUser._id,
            ctx.req.ip,
            {
              inviteId: ctx.invite._id,
              privileges: ctx.privileges,
            }
          )
        })
      })

      describe('and returns a null invite', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.CollaboratorsInviteHandler.promises.generateNewInvite.resolves(
              null
            )
            ctx.res.callback = () => resolve()
            ctx.CollaboratorsInviteController.generateNewInvite(
              ctx.req,
              ctx.res,
              ctx.next
            )
          })
        })

        it('should have called emitToRoom', function (ctx) {
          ctx.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
          ctx.EditorRealTimeController.emitToRoom
            .calledWith(ctx.projectId, 'project:membership:changed')
            .should.equal(true)
        })

        it('should produce a 404 response when invite is null', function (ctx) {
          expect(ctx.res.sendStatus).toHaveBeenCalledTimes(1)
          expect(ctx.res.sendStatus).toHaveBeenCalledWith(404)
        })
      })
    })

    describe('when generateNewInvite produces an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.CollaboratorsInviteHandler.promises.generateNewInvite.rejects(
            new Error('woops')
          )
          ctx.next.callsFake(() => resolve())
          ctx.CollaboratorsInviteController.generateNewInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should not produce a 201 response', function (ctx) {
        expect(ctx.res.sendStatus).not.toHaveBeenCalled()
      })

      it('should call next with the error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        ctx.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should have called generateNewInvite', function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.generateNewInvite.callCount.should.equal(
          1
        )
      })
    })
  })

  describe('revokeInvite', function () {
    beforeEach(function (ctx) {
      ctx.req.params = {
        Project_id: ctx.projectId,
        invite_id: ctx.invite._id.toString(),
      }
    })

    describe('when revokeInvite does not produce an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.res.callback = () => resolve()
          ctx.CollaboratorsInviteController.revokeInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should produce a 204 response', function (ctx) {
        expect(ctx.res.sendStatus).toHaveBeenCalledTimes(1)
        expect(ctx.res.sendStatus).toHaveBeenCalledWith(204)
      })

      it('should have called revokeInvite', function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.revokeInvite.callCount.should.equal(
          1
        )
      })

      it('should have called emitToRoom', function (ctx) {
        ctx.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
        ctx.EditorRealTimeController.emitToRoom
          .calledWith(ctx.projectId, 'project:membership:changed')
          .should.equal(true)
      })

      it('should add a project audit log entry', function (ctx) {
        ctx.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
          ctx.projectId,
          'revoke-invite',
          ctx.currentUser._id,
          ctx.req.ip,
          {
            inviteId: ctx.invite._id,
            privileges: ctx.privileges,
          }
        )
      })
    })

    describe('when revokeInvite produces an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.CollaboratorsInviteHandler.promises.revokeInvite.rejects(
            new Error('woops')
          )
          ctx.next.callsFake(() => resolve())
          ctx.CollaboratorsInviteController.revokeInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should not produce a 201 response', function (ctx) {
        expect(ctx.res.sendStatus).not.toHaveBeenCalled()
      })

      it('should call next with the error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        ctx.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should have called revokeInvite', function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.revokeInvite.callCount.should.equal(
          1
        )
      })
    })
  })

  describe('acceptInvite', function () {
    beforeEach(function (ctx) {
      ctx.req.params = {
        Project_id: ctx.projectId,
        token: ctx.token,
      }
    })

    describe('when acceptInvite does not produce an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.res.callback = () => resolve()
          ctx.CollaboratorsInviteController.acceptInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should redirect to project page', function (ctx) {
        expect(ctx.res.redirect).toHaveBeenCalledTimes(1)
        expect(ctx.res.redirect).toHaveBeenCalledWith(
          `/project/${ctx.projectId}`
        )
      })

      it('should have called acceptInvite', function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.acceptInvite.should.have.been.calledWith(
          ctx.invite,
          ctx.projectId,
          ctx.currentUser
        )
      })

      it('should have called emitToRoom', function (ctx) {
        ctx.EditorRealTimeController.emitToRoom.should.have.been.calledOnce
        ctx.EditorRealTimeController.emitToRoom.should.have.been.calledWith(
          ctx.projectId,
          'project:membership:changed'
        )
      })

      it('should add a project audit log entry', function (ctx) {
        ctx.ProjectAuditLogHandler.promises.addEntry.should.have.been.calledWith(
          ctx.projectId,
          'accept-invite',
          ctx.currentUser._id,
          ctx.req.ip,
          {
            inviteId: ctx.invite._id,
            privileges: ctx.privileges,
          }
        )
      })
    })

    describe('when the invite is not found', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.CollaboratorsInviteGetter.promises.getInviteByToken.resolves(null)
          ctx.next.callsFake(() => resolve())
          ctx.CollaboratorsInviteController.acceptInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('throws a NotFoundError', function (ctx) {
        expect(ctx.next).to.have.been.calledWith(
          sinon.match.instanceOf(Errors.NotFoundError)
        )
      })
    })

    describe('when acceptInvite produces an error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.CollaboratorsInviteHandler.promises.acceptInvite.rejects(
            new Error('woops')
          )
          ctx.next.callsFake(() => resolve())
          ctx.CollaboratorsInviteController.acceptInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should not redirect to project page', function (ctx) {
        expect(ctx.res.redirect).not.toHaveBeenCalled()
      })

      it('should call next with the error', function (ctx) {
        ctx.next.callCount.should.equal(1)
        ctx.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should have called acceptInvite', function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.acceptInvite.callCount.should.equal(
          1
        )
      })
    })

    describe('when the project audit log entry fails', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ProjectAuditLogHandler.promises.addEntry.rejects(
            new Error('oops')
          )
          ctx.next.callsFake(() => resolve())
          ctx.CollaboratorsInviteController.acceptInvite(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should not accept the invite', function (ctx) {
        ctx.CollaboratorsInviteHandler.promises.acceptInvite.should.not.have
          .been.called
      })
    })
  })

  describe('_checkShouldInviteEmail', function () {
    beforeEach(function (ctx) {
      ctx.email = 'user@example.com'
    })

    describe('when we should be restricting to existing accounts', function () {
      beforeEach(function (ctx) {
        ctx.settings.restrictInvitesToExistingAccounts = true
        ctx.call = () =>
          ctx.CollaboratorsInviteController._checkShouldInviteEmail(ctx.email)
      })

      describe('when user account is present', function () {
        beforeEach(function (ctx) {
          ctx.user = { _id: new ObjectId().toString() }
          ctx.UserGetter.promises.getUserByAnyEmail.resolves(ctx.user)
        })

        it('should callback with `true`', async function (ctx) {
          const shouldAllow =
            await ctx.CollaboratorsInviteController._checkShouldInviteEmail(
              ctx.email
            )
          expect(shouldAllow).to.equal(true)
        })
      })

      describe('when user account is absent', function () {
        beforeEach(function (ctx) {
          ctx.user = null
          ctx.UserGetter.promises.getUserByAnyEmail.resolves(ctx.user)
        })

        it('should callback with `false`', async function (ctx) {
          const shouldAllow =
            await ctx.CollaboratorsInviteController._checkShouldInviteEmail(
              ctx.email
            )
          expect(shouldAllow).to.equal(false)
        })

        it('should have called getUser', async function (ctx) {
          await ctx.CollaboratorsInviteController._checkShouldInviteEmail(
            ctx.email
          )
          ctx.UserGetter.promises.getUserByAnyEmail.callCount.should.equal(1)
          ctx.UserGetter.promises.getUserByAnyEmail
            .calledWith(ctx.email, { _id: 1 })
            .should.equal(true)
        })
      })

      describe('when getUser produces an error', function () {
        beforeEach(function (ctx) {
          ctx.user = null
          ctx.UserGetter.promises.getUserByAnyEmail.rejects(new Error('woops'))
        })

        it('should callback with an error', async function (ctx) {
          await expect(
            ctx.CollaboratorsInviteController._checkShouldInviteEmail(ctx.email)
          ).to.be.rejected
        })
      })
    })
  })

  describe('_checkRateLimit', function () {
    beforeEach(function (ctx) {
      ctx.settings.restrictInvitesToExistingAccounts = false
      ctx.currentUserId = '32312313'
      ctx.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser
        .withArgs(ctx.currentUserId)
        .resolves(17)
    })

    it('should callback with `true` when rate limit under', async function (ctx) {
      const result = await ctx.CollaboratorsInviteController._checkRateLimit(
        ctx.currentUserId
      )
      expect(ctx.rateLimiter.consume).to.have.been.calledWith(ctx.currentUserId)
      result.should.equal(true)
    })

    it('should callback with `false` when rate limit hit', async function (ctx) {
      ctx.rateLimiter.consume.rejects({ remainingPoints: 0 })
      const result = await ctx.CollaboratorsInviteController._checkRateLimit(
        ctx.currentUserId
      )
      expect(ctx.rateLimiter.consume).to.have.been.calledWith(ctx.currentUserId)
      result.should.equal(false)
    })

    it('should allow 10x the collaborators', async function (ctx) {
      await ctx.CollaboratorsInviteController._checkRateLimit(ctx.currentUserId)
      expect(ctx.rateLimiter.consume).to.have.been.calledWith(
        ctx.currentUserId,
        Math.floor(40000 / 170)
      )
    })

    it('should allow 200 requests when collaborators is -1', async function (ctx) {
      ctx.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser
        .withArgs(ctx.currentUserId)
        .resolves(-1)
      await ctx.CollaboratorsInviteController._checkRateLimit(ctx.currentUserId)
      expect(ctx.rateLimiter.consume).to.have.been.calledWith(
        ctx.currentUserId,
        Math.floor(40000 / 200)
      )
    })

    it('should allow 10 requests when user has no collaborators set', async function (ctx) {
      ctx.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser
        .withArgs(ctx.currentUserId)
        .resolves(null)
      await ctx.CollaboratorsInviteController._checkRateLimit(ctx.currentUserId)
      expect(ctx.rateLimiter.consume).to.have.been.calledWith(
        ctx.currentUserId,
        Math.floor(40000 / 10)
      )
    })
  })
})
