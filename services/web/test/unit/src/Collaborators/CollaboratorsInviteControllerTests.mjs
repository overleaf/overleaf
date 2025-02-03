import sinon from 'sinon'
import { expect } from 'chai'
import esmock from 'esmock'
import MockRequest from '../helpers/MockRequest.js'
import MockResponse from '../helpers/MockResponse.js'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import _ from 'lodash'

const ObjectId = mongodb.ObjectId

const MODULE_PATH =
  '../../../../app/src/Features/Collaborators/CollaboratorsInviteController.mjs'

describe('CollaboratorsInviteController', function () {
  beforeEach(async function () {
    this.projectId = 'project-id-123'
    this.token = 'some-opaque-token'
    this.tokenHmac = 'some-hmac-token'
    this.targetEmail = 'user@example.com'
    this.privileges = 'readAndWrite'
    this.projectOwner = {
      _id: 'project-owner-id',
      email: 'project-owner@example.com',
    }
    this.currentUser = {
      _id: 'current-user-id',
      email: 'current-user@example.com',
    }
    this.invite = {
      _id: new ObjectId(),
      token: this.token,
      tokenHmac: this.tokenHmac,
      sendingUserId: this.currentUser._id,
      projectId: this.projectId,
      email: this.targetEmail,
      privileges: this.privileges,
      createdAt: new Date(),
    }
    this.inviteReducedData = _.pick(this.invite, ['_id', 'email', 'privileges'])
    this.project = {
      _id: this.projectId,
      owner_ref: this.projectOwner._id,
    }

    this.SessionManager = {
      getSessionUser: sinon.stub().returns(this.currentUser),
    }

    this.AnalyticsManger = { recordEventForUserInBackground: sinon.stub() }

    this.rateLimiter = {
      consume: sinon.stub().resolves(),
    }
    this.RateLimiter = {
      RateLimiter: sinon.stub().returns(this.rateLimiter),
    }

    this.LimitationsManager = {
      promises: {
        allowedNumberOfCollaboratorsForUser: sinon.stub(),
        canAddXEditCollaborators: sinon.stub().resolves(true),
      },
    }

    this.UserGetter = {
      promises: {
        getUserByAnyEmail: sinon.stub(),
        getUser: sinon.stub(),
      },
    }

    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub(),
      },
    }

    this.CollaboratorsGetter = {
      promises: {
        isUserInvitedMemberOfProject: sinon.stub(),
      },
    }

    this.CollaboratorsInviteHandler = {
      promises: {
        inviteToProject: sinon.stub().resolves(this.inviteReducedData),
        generateNewInvite: sinon.stub().resolves(this.invite),
        revokeInvite: sinon.stub().resolves(this.invite),
        acceptInvite: sinon.stub(),
      },
    }

    this.CollaboratorsInviteGetter = {
      promises: {
        getAllInvites: sinon.stub(),
        getInviteByToken: sinon.stub().resolves(this.invite),
      },
    }

    this.EditorRealTimeController = {
      emitToRoom: sinon.stub(),
    }

    this.settings = {}

    this.ProjectAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
      addEntryInBackground: sinon.stub(),
    }

    this.AuthenticationController = {
      setRedirectInSession: sinon.stub(),
    }

    this.SplitTestHandler = {
      promises: {
        getAssignmentForUser: sinon.stub().resolves({ variant: 'default' }),
      },
    }

    this.CollaboratorsInviteController = await esmock.strict(MODULE_PATH, {
      '../../../../app/src/Features/Project/ProjectGetter.js':
        this.ProjectGetter,
      '../../../../app/src/Features/Project/ProjectAuditLogHandler.js':
        this.ProjectAuditLogHandler,
      '../../../../app/src/Features/Subscription/LimitationsManager.js':
        this.LimitationsManager,
      '../../../../app/src/Features/User/UserGetter.js': this.UserGetter,
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter.js':
        this.CollaboratorsGetter,
      '../../../../app/src/Features/Collaborators/CollaboratorsInviteHandler.mjs':
        this.CollaboratorsInviteHandler,
      '../../../../app/src/Features/Collaborators/CollaboratorsInviteGetter.js':
        this.CollaboratorsInviteGetter,
      '../../../../app/src/Features/Editor/EditorRealTimeController.js':
        this.EditorRealTimeController,
      '../../../../app/src/Features/Analytics/AnalyticsManager.js':
        this.AnalyticsManger,
      '../../../../app/src/Features/Authentication/SessionManager.js':
        this.SessionManager,
      '@overleaf/settings': this.settings,
      '../../../../app/src/infrastructure/RateLimiter': this.RateLimiter,
      '../../../../app/src/Features/Authentication/AuthenticationController':
        this.AuthenticationController,
      '../../../../app/src/Features/SplitTests/SplitTestHandler':
        this.SplitTestHandler,
    })

    this.res = new MockResponse()
    this.req = new MockRequest()
    this.next = sinon.stub()
  })

  describe('getAllInvites', function () {
    beforeEach(function () {
      this.fakeInvites = [
        { _id: new ObjectId(), one: 1 },
        { _id: new ObjectId(), two: 2 },
      ]
      this.req.params = { Project_id: this.projectId }
    })

    describe('when all goes well', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteGetter.promises.getAllInvites.resolves(
          this.fakeInvites
        )
        this.res.callback = () => done()
        this.CollaboratorsInviteController.getAllInvites(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not produce an error', function () {
        this.next.callCount.should.equal(0)
      })

      it('should produce a list of invite objects', function () {
        this.res.json.callCount.should.equal(1)
        this.res.json
          .calledWith({ invites: this.fakeInvites })
          .should.equal(true)
      })

      it('should have called CollaboratorsInviteHandler.getAllInvites', function () {
        this.CollaboratorsInviteGetter.promises.getAllInvites.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteGetter.promises.getAllInvites
          .calledWith(this.projectId)
          .should.equal(true)
      })
    })

    describe('when CollaboratorsInviteHandler.getAllInvites produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteGetter.promises.getAllInvites.rejects(
          new Error('woops')
        )
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.getAllInvites(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce an error', function () {
        this.next.callCount.should.equal(1)
        this.next.firstCall.args[0].should.be.instanceof(Error)
      })
    })
  })

  describe('inviteToProject', function () {
    beforeEach(function () {
      this.req.params = { Project_id: this.projectId }
      this.req.body = {
        email: this.targetEmail,
        privileges: this.privileges,
      }
      this.ProjectGetter.promises.getProject.resolves({
        owner_ref: this.project.owner_ref,
      })
    })

    describe('when all goes well', function (done) {
      beforeEach(async function () {
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .resolves(true)
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .resolves(true)

        await this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res
        )
      })

      it('should produce json response', function () {
        this.res.json.callCount.should.equal(1)
        expect(this.res.json.firstCall.args[0]).to.deep.equal({
          invite: this.inviteReducedData,
        })
      })

      it('should have called canAddXEditCollaborators', function () {
        this.LimitationsManager.promises.canAddXEditCollaborators.callCount.should.equal(
          1
        )
        this.LimitationsManager.promises.canAddXEditCollaborators
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should have called _checkShouldInviteEmail', function () {
        this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          1
        )

        this.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(this.targetEmail)
          .should.equal(true)
      })

      it('should have called inviteToProject', function () {
        this.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteHandler.promises.inviteToProject
          .calledWith(
            this.projectId,
            this.currentUser,
            this.targetEmail,
            this.privileges
          )
          .should.equal(true)
      })

      it('should have called emitToRoom', function () {
        this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
        this.EditorRealTimeController.emitToRoom
          .calledWith(this.projectId, 'project:membership:changed')
          .should.equal(true)
      })

      it('adds a project audit log entry', function () {
        this.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
          this.projectId,
          'send-invite',
          this.currentUser._id,
          this.req.ip,
          {
            inviteId: this.invite._id,
            privileges: this.privileges,
          }
        )
      })
    })

    describe('when the user is not allowed to add more edit collaborators', function () {
      beforeEach(function () {
        this.LimitationsManager.promises.canAddXEditCollaborators.resolves(
          false
        )
      })

      describe('readAndWrite collaborator', function () {
        beforeEach(function (done) {
          this.privileges = 'readAndWrite'
          this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
            .stub()
            .resolves(true)
          this.CollaboratorsInviteController._checkRateLimit = sinon
            .stub()
            .resolves(true)
          this.res.callback = () => done()
          this.CollaboratorsInviteController.inviteToProject(
            this.req,
            this.res,
            this.next
          )
        })

        it('should produce json response without an invite', function () {
          this.res.json.callCount.should.equal(1)
          expect(this.res.json.firstCall.args[0]).to.deep.equal({
            invite: null,
          })
        })

        it('should not have called _checkShouldInviteEmail', function () {
          this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
            0
          )
          this.CollaboratorsInviteController._checkShouldInviteEmail
            .calledWith(this.currentUser, this.targetEmail)
            .should.equal(false)
        })

        it('should not have called inviteToProject', function () {
          this.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
            0
          )
        })
      })

      describe('readOnly collaborator (always allowed)', function () {
        beforeEach(function (done) {
          this.req.body = {
            email: this.targetEmail,
            privileges: (this.privileges = 'readOnly'),
          }
          this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
            .stub()
            .resolves(true)
          this.CollaboratorsInviteController._checkRateLimit = sinon
            .stub()
            .resolves(true)
          this.res.callback = () => done()
          this.CollaboratorsInviteController.inviteToProject(
            this.req,
            this.res,
            this.next
          )
        })

        it('should produce json response', function () {
          this.res.json.callCount.should.equal(1)
          expect(this.res.json.firstCall.args[0]).to.deep.equal({
            invite: this.inviteReducedData,
          })
        })

        it('should not have called canAddXEditCollaborators', function () {
          this.LimitationsManager.promises.canAddXEditCollaborators.callCount.should.equal(
            0
          )
        })

        it('should have called _checkShouldInviteEmail', function () {
          this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
            1
          )
          this.CollaboratorsInviteController._checkShouldInviteEmail
            .calledWith(this.targetEmail)
            .should.equal(true)
        })

        it('should have called inviteToProject', function () {
          this.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
            1
          )
          this.CollaboratorsInviteHandler.promises.inviteToProject
            .calledWith(
              this.projectId,
              this.currentUser,
              this.targetEmail,
              this.privileges
            )
            .should.equal(true)
        })

        it('should have called emitToRoom', function () {
          this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
          this.EditorRealTimeController.emitToRoom
            .calledWith(this.projectId, 'project:membership:changed')
            .should.equal(true)
        })

        it('adds a project audit log entry', function () {
          this.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
            this.projectId,
            'send-invite',
            this.currentUser._id,
            this.req.ip,
            {
              inviteId: this.invite._id,
              privileges: this.privileges,
            }
          )
        })
      })
    })

    describe('when inviteToProject produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .resolves(true)
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .resolves(true)
        this.CollaboratorsInviteHandler.promises.inviteToProject.rejects(
          new Error('woops')
        )
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function () {
        this.next.callCount.should.equal(1)
        expect(this.next).to.have.been.calledWith(sinon.match.instanceOf(Error))
      })

      it('should have called canAddXEditCollaborators', function () {
        this.LimitationsManager.promises.canAddXEditCollaborators.callCount.should.equal(
          1
        )
        this.LimitationsManager.promises.canAddXEditCollaborators
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should have called _checkShouldInviteEmail', function () {
        this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(this.targetEmail)
          .should.equal(true)
      })

      it('should have called inviteToProject', function () {
        this.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteHandler.promises.inviteToProject
          .calledWith(
            this.projectId,
            this.currentUser,
            this.targetEmail,
            this.privileges
          )
          .should.equal(true)
      })
    })

    describe('when _checkShouldInviteEmail disallows the invite', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .resolves(false)
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .resolves(true)
        this.res.callback = () => done()
        this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce json response with no invite, and an error property', function () {
        this.res.json.callCount.should.equal(1)
        expect(this.res.json.firstCall.args[0]).to.deep.equal({
          invite: null,
          error: 'cannot_invite_non_user',
        })
      })

      it('should have called _checkShouldInviteEmail', function () {
        this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(this.targetEmail)
          .should.equal(true)
      })

      it('should not have called inviteToProject', function () {
        this.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          0
        )
      })
    })

    describe('when _checkShouldInviteEmail produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .rejects(new Error('woops'))
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .resolves(true)
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function () {
        this.next.callCount.should.equal(1)
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should have called _checkShouldInviteEmail', function () {
        this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(this.targetEmail)
          .should.equal(true)
      })

      it('should not have called inviteToProject', function () {
        this.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          0
        )
      })
    })

    describe('when the user invites themselves to the project', function () {
      beforeEach(function () {
        this.req.body.email = this.currentUser.email
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .resolves(true)
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .resolves(true)
        this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should reject action, return json response with error code', function () {
        this.res.json.callCount.should.equal(1)
        expect(this.res.json.firstCall.args[0]).to.deep.equal({
          invite: null,
          error: 'cannot_invite_self',
        })
      })

      it('should not have called canAddXEditCollaborators', function () {
        this.LimitationsManager.promises.canAddXEditCollaborators.callCount.should.equal(
          0
        )
      })

      it('should not have called _checkShouldInviteEmail', function () {
        this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          0
        )
      })

      it('should not have called inviteToProject', function () {
        this.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          0
        )
      })

      it('should not have called emitToRoom', function () {
        this.EditorRealTimeController.emitToRoom.callCount.should.equal(0)
      })
    })

    describe('when _checkRateLimit returns false', function () {
      beforeEach(async function () {
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .resolves(true)
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .resolves(false)
        await this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 429 response', function () {
        this.res.sendStatus.calledWith(429).should.equal(true)
      })

      it('should not call inviteToProject', function () {
        this.CollaboratorsInviteHandler.promises.inviteToProject.called.should.equal(
          false
        )
      })

      it('should not call emitToRoom', function () {
        this.EditorRealTimeController.emitToRoom.called.should.equal(false)
      })
    })
  })

  describe('viewInvite', function () {
    beforeEach(function () {
      this.req.params = {
        Project_id: this.projectId,
        token: this.token,
      }
      this.fakeProject = {
        _id: this.projectId,
        name: 'some project',
        owner_ref: this.invite.sendingUserId,
        collaberator_refs: [],
        readOnly_refs: [],
      }
      this.owner = {
        _id: this.fakeProject.owner_ref,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      }

      this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.resolves(
        false
      )
      this.CollaboratorsInviteGetter.promises.getInviteByToken.resolves(
        this.invite
      )
      this.ProjectGetter.promises.getProject.resolves(this.fakeProject)
      this.UserGetter.promises.getUser.resolves(this.owner)
    })

    describe('when the token is valid', function () {
      beforeEach(function (done) {
        this.res.callback = () => done()
        this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should render the view template', function () {
        this.res.render.callCount.should.equal(1)
        this.res.render.calledWith('project/invite/show').should.equal(true)
      })

      it('should not call next', function () {
        this.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function () {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.currentUser._id, this.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteGetter.promises.getInviteByToken
          .calledWith(this.fakeProject._id, this.invite.token)
          .should.equal(true)
      })

      it('should call User.getUser', function () {
        this.UserGetter.promises.getUser.callCount.should.equal(1)
        this.UserGetter.promises.getUser
          .calledWith({ _id: this.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should call ProjectGetter.getProject', function () {
        this.ProjectGetter.promises.getProject.callCount.should.equal(1)
        this.ProjectGetter.promises.getProject
          .calledWith(this.projectId)
          .should.equal(true)
      })
    })

    describe('when not logged in', function () {
      beforeEach(function (done) {
        this.SessionManager.getSessionUser.returns(null)

        this.res.callback = () => done()
        this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })
      it('should not check member status', function () {
        expect(this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject)
          .to.not.have.been.called
      })

      it('should set redirect back to invite', function () {
        expect(
          this.AuthenticationController.setRedirectInSession
        ).to.have.been.calledWith(this.req)
      })

      it('should redirect to the register page', function () {
        expect(this.res.render).to.not.have.been.called
        expect(this.res.redirect).to.have.been.calledOnce
        expect(this.res.redirect).to.have.been.calledWith('/register')
      })
    })

    describe('when user is already a member of the project', function () {
      beforeEach(function (done) {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.resolves(
          true
        )
        this.res.callback = () => done()
        this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should redirect to the project page', function () {
        this.res.redirect.callCount.should.equal(1)
        this.res.redirect
          .calledWith(`/project/${this.projectId}`)
          .should.equal(true)
      })

      it('should not call next with an error', function () {
        this.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function () {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.currentUser._id, this.projectId)
          .should.equal(true)
      })

      it('should not call getInviteByToken', function () {
        this.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          0
        )
      })

      it('should not call User.getUser', function () {
        this.UserGetter.promises.getUser.callCount.should.equal(0)
      })

      it('should not call ProjectGetter.getProject', function () {
        this.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })
    })

    describe('when isUserInvitedMemberOfProject produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.rejects(
          new Error('woops')
        )
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function () {
        this.next.callCount.should.equal(1)
        expect(this.next.firstCall.args[0]).to.be.instanceof(Error)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function () {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.currentUser._id, this.projectId)
          .should.equal(true)
      })

      it('should not call getInviteByToken', function () {
        this.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          0
        )
      })

      it('should not call User.getUser', function () {
        this.UserGetter.promises.getUser.callCount.should.equal(0)
      })

      it('should not call ProjectGetter.getProject', function () {
        this.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })
    })

    describe('when the getInviteByToken produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteGetter.promises.getInviteByToken.rejects(
          new Error('woops')
        )
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with the error', function () {
        this.next.callCount.should.equal(1)
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function () {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.currentUser._id, this.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.currentUser._id, this.projectId)
          .should.equal(true)
      })

      it('should not call User.getUser', function () {
        this.UserGetter.promises.getUser.callCount.should.equal(0)
      })

      it('should not call ProjectGetter.getProject', function () {
        this.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })
    })

    describe('when the getInviteByToken does not produce an invite', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteGetter.promises.getInviteByToken.resolves(null)
        this.res.callback = () => done()
        this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should render the not-valid view template', function () {
        this.res.render.callCount.should.equal(1)
        this.res.render
          .calledWith('project/invite/not-valid')
          .should.equal(true)
      })

      it('should not call next', function () {
        this.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function () {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.currentUser._id, this.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.currentUser._id, this.projectId)
          .should.equal(true)
      })

      it('should not call User.getUser', function () {
        this.UserGetter.promises.getUser.callCount.should.equal(0)
      })

      it('should not call ProjectGetter.getProject', function () {
        this.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })
    })

    describe('when User.getUser produces an error', function () {
      beforeEach(function (done) {
        this.UserGetter.promises.getUser.rejects(new Error('woops'))
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce an error', function () {
        this.next.callCount.should.equal(1)
        expect(this.next.firstCall.args[0]).to.be.instanceof(Error)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function () {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.currentUser._id, this.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
      })

      it('should call User.getUser', function () {
        this.UserGetter.promises.getUser.callCount.should.equal(1)
        this.UserGetter.promises.getUser
          .calledWith({ _id: this.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should not call ProjectGetter.getProject', function () {
        this.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })
    })

    describe('when User.getUser does not find a user', function () {
      beforeEach(function (done) {
        this.UserGetter.promises.getUser.resolves(null)
        this.res.callback = () => done()
        this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should render the not-valid view template', function () {
        this.res.render.callCount.should.equal(1)
        this.res.render
          .calledWith('project/invite/not-valid')
          .should.equal(true)
      })

      it('should not call next', function () {
        this.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function () {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.currentUser._id, this.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
      })

      it('should call User.getUser', function () {
        this.UserGetter.promises.getUser.callCount.should.equal(1)
        this.UserGetter.promises.getUser
          .calledWith({ _id: this.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should not call ProjectGetter.getProject', function () {
        this.ProjectGetter.promises.getProject.callCount.should.equal(0)
      })
    })

    describe('when getProject produces an error', function () {
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.rejects(new Error('woops'))
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce an error', function () {
        this.next.callCount.should.equal(1)
        expect(this.next.firstCall.args[0]).to.be.instanceof(Error)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function () {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.currentUser._id, this.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
      })

      it('should call User.getUser', function () {
        this.UserGetter.promises.getUser.callCount.should.equal(1)
        this.UserGetter.promises.getUser
          .calledWith({ _id: this.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should call ProjectGetter.getProject', function () {
        this.ProjectGetter.promises.getProject.callCount.should.equal(1)
      })
    })

    describe('when Project.getUser does not find a user', function () {
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.resolves(null)
        this.res.callback = () => done()
        this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should render the not-valid view template', function () {
        this.res.render.callCount.should.equal(1)
        this.res.render
          .calledWith('project/invite/not-valid')
          .should.equal(true)
      })

      it('should not call next', function () {
        this.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsGetter.isUserInvitedMemberOfProject', function () {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.currentUser._id, this.projectId)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteGetter.promises.getInviteByToken.callCount.should.equal(
          1
        )
      })

      it('should call getUser', function () {
        this.UserGetter.promises.getUser.callCount.should.equal(1)
        this.UserGetter.promises.getUser
          .calledWith({ _id: this.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should call ProjectGetter.getProject', function () {
        this.ProjectGetter.promises.getProject.callCount.should.equal(1)
      })
    })
  })

  describe('generateNewInvite', function () {
    beforeEach(function () {
      this.req.params = {
        Project_id: this.projectId,
        invite_id: this.invite._id.toString(),
      }
      this.CollaboratorsInviteController._checkRateLimit = sinon
        .stub()
        .resolves(true)
    })

    describe('when generateNewInvite does not produce an error', function () {
      describe('and returns an invite object', function () {
        beforeEach(function (done) {
          this.res.callback = () => done()
          this.CollaboratorsInviteController.generateNewInvite(
            this.req,
            this.res,
            this.next
          )
        })

        it('should produce a 201 response', function () {
          this.res.sendStatus.callCount.should.equal(1)
          this.res.sendStatus.calledWith(201).should.equal(true)
        })

        it('should have called generateNewInvite', function () {
          this.CollaboratorsInviteHandler.promises.generateNewInvite.callCount.should.equal(
            1
          )
        })

        it('should have called emitToRoom', function () {
          this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
          this.EditorRealTimeController.emitToRoom
            .calledWith(this.projectId, 'project:membership:changed')
            .should.equal(true)
        })

        it('should check the rate limit', function () {
          this.CollaboratorsInviteController._checkRateLimit.callCount.should.equal(
            1
          )
        })

        it('should add a project audit log entry', function () {
          this.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
            this.projectId,
            'resend-invite',
            this.currentUser._id,
            this.req.ip,
            {
              inviteId: this.invite._id,
              privileges: this.privileges,
            }
          )
        })
      })

      describe('and returns a null invite', function () {
        beforeEach(function (done) {
          this.CollaboratorsInviteHandler.promises.generateNewInvite.resolves(
            null
          )
          this.res.callback = () => done()
          this.CollaboratorsInviteController.generateNewInvite(
            this.req,
            this.res,
            this.next
          )
        })

        it('should have called emitToRoom', function () {
          this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
          this.EditorRealTimeController.emitToRoom
            .calledWith(this.projectId, 'project:membership:changed')
            .should.equal(true)
        })

        it('should produce a 404 response when invite is null', function () {
          this.res.sendStatus.callCount.should.equal(1)
          this.res.sendStatus.should.have.been.calledWith(404)
        })
      })
    })

    describe('when generateNewInvite produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteHandler.promises.generateNewInvite.rejects(
          new Error('woops')
        )
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.generateNewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not produce a 201 response', function () {
        this.res.sendStatus.callCount.should.equal(0)
      })

      it('should call next with the error', function () {
        this.next.callCount.should.equal(1)
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should have called generateNewInvite', function () {
        this.CollaboratorsInviteHandler.promises.generateNewInvite.callCount.should.equal(
          1
        )
      })
    })
  })

  describe('revokeInvite', function () {
    beforeEach(function () {
      this.req.params = {
        Project_id: this.projectId,
        invite_id: this.invite._id.toString(),
      }
    })

    describe('when revokeInvite does not produce an error', function () {
      beforeEach(function (done) {
        this.res.callback = () => done()
        this.CollaboratorsInviteController.revokeInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce a 204 response', function () {
        this.res.sendStatus.callCount.should.equal(1)
        this.res.sendStatus.should.have.been.calledWith(204)
      })

      it('should have called revokeInvite', function () {
        this.CollaboratorsInviteHandler.promises.revokeInvite.callCount.should.equal(
          1
        )
      })

      it('should have called emitToRoom', function () {
        this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
        this.EditorRealTimeController.emitToRoom
          .calledWith(this.projectId, 'project:membership:changed')
          .should.equal(true)
      })

      it('should add a project audit log entry', function () {
        this.ProjectAuditLogHandler.addEntryInBackground.should.have.been.calledWith(
          this.projectId,
          'revoke-invite',
          this.currentUser._id,
          this.req.ip,
          {
            inviteId: this.invite._id,
            privileges: this.privileges,
          }
        )
      })
    })

    describe('when revokeInvite produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteHandler.promises.revokeInvite.rejects(
          new Error('woops')
        )
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.revokeInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not produce a 201 response', function () {
        this.res.sendStatus.callCount.should.equal(0)
      })

      it('should call next with the error', function () {
        this.next.callCount.should.equal(1)
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should have called revokeInvite', function () {
        this.CollaboratorsInviteHandler.promises.revokeInvite.callCount.should.equal(
          1
        )
      })
    })
  })

  describe('acceptInvite', function () {
    beforeEach(function () {
      this.req.params = {
        Project_id: this.projectId,
        token: this.token,
      }
    })

    describe('when acceptInvite does not produce an error', function () {
      beforeEach(function (done) {
        this.res.callback = () => done()
        this.CollaboratorsInviteController.acceptInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should redirect to project page', function () {
        this.res.redirect.should.have.been.calledOnce
        this.res.redirect.should.have.been.calledWith(
          `/project/${this.projectId}`
        )
      })

      it('should have called acceptInvite', function () {
        this.CollaboratorsInviteHandler.promises.acceptInvite.should.have.been.calledWith(
          this.invite,
          this.projectId,
          this.currentUser
        )
      })

      it('should have called emitToRoom', function () {
        this.EditorRealTimeController.emitToRoom.should.have.been.calledOnce
        this.EditorRealTimeController.emitToRoom.should.have.been.calledWith(
          this.projectId,
          'project:membership:changed'
        )
      })

      it('should add a project audit log entry', function () {
        this.ProjectAuditLogHandler.promises.addEntry.should.have.been.calledWith(
          this.projectId,
          'accept-invite',
          this.currentUser._id,
          this.req.ip,
          {
            inviteId: this.invite._id,
            privileges: this.privileges,
          }
        )
      })
    })

    describe('when the invite is not found', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteGetter.promises.getInviteByToken.resolves(null)
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.acceptInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('throws a NotFoundError', function () {
        expect(this.next).to.have.been.calledWith(
          sinon.match.instanceOf(Errors.NotFoundError)
        )
      })
    })

    describe('when acceptInvite produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteHandler.promises.acceptInvite.rejects(
          new Error('woops')
        )
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.acceptInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not redirect to project page', function () {
        this.res.redirect.callCount.should.equal(0)
      })

      it('should call next with the error', function () {
        this.next.callCount.should.equal(1)
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should have called acceptInvite', function () {
        this.CollaboratorsInviteHandler.promises.acceptInvite.callCount.should.equal(
          1
        )
      })
    })

    describe('when the project audit log entry fails', function () {
      beforeEach(function (done) {
        this.ProjectAuditLogHandler.promises.addEntry.rejects(new Error('oops'))
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.acceptInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not accept the invite', function () {
        this.CollaboratorsInviteHandler.promises.acceptInvite.should.not.have
          .been.called
      })
    })
  })

  describe('_checkShouldInviteEmail', function () {
    beforeEach(function () {
      this.email = 'user@example.com'
    })

    describe('when we should be restricting to existing accounts', function () {
      beforeEach(function () {
        this.settings.restrictInvitesToExistingAccounts = true
        this.call = () =>
          this.CollaboratorsInviteController._checkShouldInviteEmail(this.email)
      })

      describe('when user account is present', function () {
        beforeEach(function () {
          this.user = { _id: new ObjectId().toString() }
          this.UserGetter.promises.getUserByAnyEmail.resolves(this.user)
        })

        it('should callback with `true`', async function () {
          const shouldAllow =
            await this.CollaboratorsInviteController._checkShouldInviteEmail(
              this.email
            )
          expect(shouldAllow).to.equal(true)
        })
      })

      describe('when user account is absent', function () {
        beforeEach(function () {
          this.user = null
          this.UserGetter.promises.getUserByAnyEmail.resolves(this.user)
        })

        it('should callback with `false`', async function () {
          const shouldAllow =
            await this.CollaboratorsInviteController._checkShouldInviteEmail(
              this.email
            )
          expect(shouldAllow).to.equal(false)
        })

        it('should have called getUser', async function () {
          await this.CollaboratorsInviteController._checkShouldInviteEmail(
            this.email
          )
          this.UserGetter.promises.getUserByAnyEmail.callCount.should.equal(1)
          this.UserGetter.promises.getUserByAnyEmail
            .calledWith(this.email, { _id: 1 })
            .should.equal(true)
        })
      })

      describe('when getUser produces an error', function () {
        beforeEach(function () {
          this.user = null
          this.UserGetter.promises.getUserByAnyEmail.rejects(new Error('woops'))
        })

        it('should callback with an error', async function () {
          await expect(
            this.CollaboratorsInviteController._checkShouldInviteEmail(
              this.email
            )
          ).to.be.rejected
        })
      })
    })
  })

  describe('_checkRateLimit', function () {
    beforeEach(function () {
      this.settings.restrictInvitesToExistingAccounts = false
      this.currentUserId = '32312313'
      this.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser
        .withArgs(this.currentUserId)
        .resolves(17)
    })

    it('should callback with `true` when rate limit under', async function () {
      const result = await this.CollaboratorsInviteController._checkRateLimit(
        this.currentUserId
      )
      expect(this.rateLimiter.consume).to.have.been.calledWith(
        this.currentUserId
      )
      result.should.equal(true)
    })

    it('should callback with `false` when rate limit hit', async function () {
      this.rateLimiter.consume.rejects({ remainingPoints: 0 })
      const result = await this.CollaboratorsInviteController._checkRateLimit(
        this.currentUserId
      )
      expect(this.rateLimiter.consume).to.have.been.calledWith(
        this.currentUserId
      )
      result.should.equal(false)
    })

    it('should allow 10x the collaborators', async function () {
      await this.CollaboratorsInviteController._checkRateLimit(
        this.currentUserId
      )
      expect(this.rateLimiter.consume).to.have.been.calledWith(
        this.currentUserId,
        Math.floor(40000 / 170)
      )
    })

    it('should allow 200 requests when collaborators is -1', async function () {
      this.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser
        .withArgs(this.currentUserId)
        .resolves(-1)
      await this.CollaboratorsInviteController._checkRateLimit(
        this.currentUserId
      )
      expect(this.rateLimiter.consume).to.have.been.calledWith(
        this.currentUserId,
        Math.floor(40000 / 200)
      )
    })

    it('should allow 10 requests when user has no collaborators set', async function () {
      this.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser
        .withArgs(this.currentUserId)
        .resolves(null)
      await this.CollaboratorsInviteController._checkRateLimit(
        this.currentUserId
      )
      expect(this.rateLimiter.consume).to.have.been.calledWith(
        this.currentUserId,
        Math.floor(40000 / 10)
      )
    })
  })
})
