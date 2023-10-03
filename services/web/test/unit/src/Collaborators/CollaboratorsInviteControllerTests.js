const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const { ObjectId } = require('mongodb')

const MODULE_PATH =
  '../../../../app/src/Features/Collaborators/CollaboratorsInviteController.js'

describe('CollaboratorsInviteController', function () {
  beforeEach(function () {
    this.user = { _id: 'id' }
    this.AnalyticsManger = { recordEventForUser: sinon.stub() }
    this.sendingUser = null
    this.AuthenticationController = {
      getSessionUser: req => {
        this.sendingUser = req.session.user
        return this.sendingUser
      },
    }

    this.rateLimiter = {
      consume: sinon.stub().resolves(),
    }
    this.RateLimiter = {
      RateLimiter: sinon.stub().returns(this.rateLimiter),
    }

    this.LimitationsManager = { promises: {} }
    this.UserGetter = {
      promises: {
        getUserByAnyEmail: sinon.stub(),
        getUser: sinon.stub(),
      },
    }

    this.ProjectGetter = { promises: {} }
    this.CollaboratorsGetter = { promises: {} }
    this.CollaboratorsInviteHandler = { promises: {} }
    this.EditorRealTimeController = {
      emitToRoom: sinon.stub(),
    }
    this.settings = {}

    this.CollaboratorsInviteController = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../Project/ProjectGetter': this.ProjectGetter,
        '../Subscription/LimitationsManager': this.LimitationsManager,
        '../User/UserGetter': this.UserGetter,
        './CollaboratorsGetter': this.CollaboratorsGetter,
        './CollaboratorsInviteHandler': this.CollaboratorsInviteHandler,
        '../Editor/EditorRealTimeController': this.EditorRealTimeController,
        '../Analytics/AnalyticsManager': this.AnalyticsManger,
        '../Authentication/AuthenticationController':
          this.AuthenticationController,
        '@overleaf/settings': this.settings,
        '../../infrastructure/RateLimiter': this.RateLimiter,
      },
    })
    this.res = new MockResponse()
    this.req = new MockRequest()

    this.project_id = 'project-id-123'
    this.callback = sinon.stub()
  })

  describe('getAllInvites', function () {
    beforeEach(function () {
      this.fakeInvites = [
        { _id: ObjectId(), one: 1 },
        { _id: ObjectId(), two: 2 },
      ]
      this.req.params = { Project_id: this.project_id }
      this.res.json = sinon.stub()
      this.next = sinon.stub()
    })

    describe('when all goes well', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteHandler.promises.getAllInvites = sinon
          .stub()
          .resolves(this.fakeInvites)
        this.res.json.callsFake(() => done())
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
        this.CollaboratorsInviteHandler.promises.getAllInvites.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteHandler.promises.getAllInvites
          .calledWith(this.project_id)
          .should.equal(true)
      })
    })

    describe('when CollaboratorsInviteHandler.getAllInvites produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteHandler.promises.getAllInvites = sinon
          .stub()
          .rejects(new Error('woops'))
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
      this.targetEmail = 'user@example.com'
      this.req.params = { Project_id: this.project_id }
      this.current_user = { _id: (this.current_user_id = 'current-user-id') }
      this.req.session = { user: this.current_user }
      this.req.body = {
        email: this.targetEmail,
        privileges: (this.privileges = 'readAndWrite'),
      }
      this.res.json = sinon.stub()
      this.res.sendStatus = sinon.stub()
      this.invite = {
        _id: ObjectId(),
        token: 'htnseuthaouse',
        sendingUserId: this.current_user_id,
        projectId: this.targetEmail,
        targetEmail: 'user@example.com',
        createdAt: new Date(),
      }
      this.LimitationsManager.promises.canAddXCollaborators = sinon
        .stub()
        .resolves(true)
      this.CollaboratorsInviteHandler.promises.inviteToProject = sinon
        .stub()
        .resolves(this.invite)
      this.callback = sinon.stub()
      this.next = sinon.stub()
    })

    describe('when all goes well', function (done) {
      beforeEach(function (done) {
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail =
          sinon.stub().resolves(true)
        this.CollaboratorsInviteController.promises._checkRateLimit = sinon
          .stub()
          .resolves(true)
        this.LimitationsManager.promises.canAddXCollaborators = sinon
          .stub()
          .resolves(true)
        this.res.json.callsFake(() => done())
        this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce json response', function () {
        this.res.json.callCount.should.equal(1)
        expect(this.res.json.firstCall.args[0]).to.deep.equal({
          invite: this.invite,
        })
      })

      it('should have called canAddXCollaborators', function () {
        this.LimitationsManager.promises.canAddXCollaborators.callCount.should.equal(
          1
        )
        this.LimitationsManager.promises.canAddXCollaborators
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should have called _checkShouldInviteEmail', function () {
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail
          .calledWith(this.targetEmail)
          .should.equal(true)
      })

      it('should have called inviteToProject', function () {
        this.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteHandler.promises.inviteToProject
          .calledWith(
            this.project_id,
            this.current_user,
            this.targetEmail,
            this.privileges
          )
          .should.equal(true)
      })

      it('should have called emitToRoom', function () {
        this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
        this.EditorRealTimeController.emitToRoom
          .calledWith(this.project_id, 'project:membership:changed')
          .should.equal(true)
      })
    })

    describe('when the user is not allowed to add more collaborators', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail =
          sinon.stub().resolves(true)
        this.CollaboratorsInviteController.promises._checkRateLimit = sinon
          .stub()
          .resolves(true)
        this.LimitationsManager.promises.canAddXCollaborators = sinon
          .stub()
          .resolves(false)
        this.res.json.callsFake(() => done())
        this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce json response without an invite', function () {
        this.res.json.callCount.should.equal(1)
        expect(this.res.json.firstCall.args[0]).to.deep.equal({ invite: null })
      })

      it('should not have called _checkShouldInviteEmail', function () {
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail.callCount.should.equal(
          0
        )
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail
          .calledWith(this.sendingUser, this.targetEmail)
          .should.equal(false)
      })

      it('should not have called inviteToProject', function () {
        this.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          0
        )
      })
    })

    describe('when canAddXCollaborators produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail =
          sinon.stub().resolves(true)
        this.CollaboratorsInviteController.promises._checkRateLimit = sinon
          .stub()
          .resolves(true)
        this.LimitationsManager.promises.canAddXCollaborators = sinon
          .stub()
          .rejects(new Error('woops'))
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

      it('should not have called _checkShouldInviteEmail', function () {
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail.callCount.should.equal(
          0
        )
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail
          .calledWith(this.sendingUser, this.targetEmail)
          .should.equal(false)
      })

      it('should not have called inviteToProject', function () {
        this.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          0
        )
      })
    })

    describe('when inviteToProject produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail =
          sinon.stub().resolves(true)
        this.CollaboratorsInviteController.promises._checkRateLimit = sinon
          .stub()
          .resolves(true)
        this.CollaboratorsInviteHandler.promises.inviteToProject = sinon
          .stub()
          .rejects(new Error('woops'))
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

      it('should have called canAddXCollaborators', function () {
        this.LimitationsManager.promises.canAddXCollaborators.callCount.should.equal(
          1
        )
        this.LimitationsManager.promises.canAddXCollaborators
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should have called _checkShouldInviteEmail', function () {
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail
          .calledWith(this.targetEmail)
          .should.equal(true)
      })

      it('should have called inviteToProject', function () {
        this.CollaboratorsInviteHandler.promises.inviteToProject.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteHandler.promises.inviteToProject
          .calledWith(
            this.project_id,
            this.current_user,
            this.targetEmail,
            this.privileges
          )
          .should.equal(true)
      })
    })

    describe('when _checkShouldInviteEmail disallows the invite', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail =
          sinon.stub().resolves(false)
        this.CollaboratorsInviteController.promises._checkRateLimit = sinon
          .stub()
          .resolves(true)
        this.LimitationsManager.promises.canAddXCollaborators = sinon
          .stub()
          .resolves(true)
        this.res.json.callsFake(() => done())
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
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail
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
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail =
          sinon.stub().rejects(new Error('woops'))
        this.CollaboratorsInviteController.promises._checkRateLimit = sinon
          .stub()
          .resolves(true)
        this.LimitationsManager.promises.canAddXCollaborators = sinon
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
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail
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
        this.req.session.user = { _id: 'abc', email: 'me@example.com' }
        this.req.body.email = 'me@example.com'
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail =
          sinon.stub().resolves(true)
        this.CollaboratorsInviteController.promises._checkRateLimit = sinon
          .stub()
          .resolves(true)
        this.LimitationsManager.promises.canAddXCollaborators = sinon
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

      it('should not have called canAddXCollaborators', function () {
        this.LimitationsManager.promises.canAddXCollaborators.callCount.should.equal(
          0
        )
      })

      it('should not have called _checkShouldInviteEmail', function () {
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail.callCount.should.equal(
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
      beforeEach(function (done) {
        this.CollaboratorsInviteController.promises._checkShouldInviteEmail =
          sinon.stub().resolves(true)
        this.CollaboratorsInviteController.promises._checkRateLimit = sinon
          .stub()
          .resolves(false)
        this.LimitationsManager.promises.canAddXCollaborators = sinon
          .stub()
          .resolves(true)
        this.res.sendStatus.callsFake(() => done())
        this.CollaboratorsInviteController.inviteToProject(
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
      this.token = 'some-opaque-token'
      this.req.params = {
        Project_id: this.project_id,
        token: this.token,
      }
      this.req.session = {
        user: { _id: (this.current_user_id = 'current-user-id') },
      }
      this.res.render = sinon.stub()
      this.res.redirect = sinon.stub()
      this.res.sendStatus = sinon.stub()
      this.invite = {
        _id: ObjectId(),
        token: this.token,
        sendingUserId: ObjectId(),
        projectId: this.project_id,
        targetEmail: 'user@example.com',
        createdAt: new Date(),
      }
      this.fakeProject = {
        _id: this.project_id,
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

      this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject = sinon
        .stub()
        .resolves(false)
      this.CollaboratorsInviteHandler.promises.getInviteByToken = sinon
        .stub()
        .resolves(this.invite)
      this.ProjectGetter.promises.getProject = sinon
        .stub()
        .resolves(this.fakeProject)
      this.UserGetter.promises.getUser.resolves(this.owner)

      this.callback = sinon.stub()
      this.next = sinon.stub()
    })

    describe('when the token is valid', function () {
      beforeEach(function (done) {
        this.res.render.callsFake(() => done())
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
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteHandler.promises.getInviteByToken.callCount.should.equal(
          1
        )
        this.CollaboratorsInviteHandler.promises.getInviteByToken
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
          .calledWith(this.project_id)
          .should.equal(true)
      })
    })

    describe('when user is already a member of the project', function () {
      beforeEach(function (done) {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject = sinon
          .stub()
          .resolves(true)
        this.res.redirect.callsFake(() => done())
        this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should redirect to the project page', function () {
        this.res.redirect.callCount.should.equal(1)
        this.res.redirect
          .calledWith(`/project/${this.project_id}`)
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
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should not call getInviteByToken', function () {
        this.CollaboratorsInviteHandler.promises.getInviteByToken.callCount.should.equal(
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
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject = sinon
          .stub()
          .rejects(new Error('woops'))
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
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should not call getInviteByToken', function () {
        this.CollaboratorsInviteHandler.promises.getInviteByToken.callCount.should.equal(
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
        this.CollaboratorsInviteHandler.promises.getInviteByToken.rejects(
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
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteHandler.promises.getInviteByToken.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
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
        this.CollaboratorsInviteHandler.promises.getInviteByToken.resolves(null)
        this.res.render.callsFake(() => done())
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
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteHandler.promises.getInviteByToken.callCount.should.equal(
          1
        )
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
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
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteHandler.promises.getInviteByToken.callCount.should.equal(
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
        this.res.render.callsFake(() => done())
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
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteHandler.promises.getInviteByToken.callCount.should.equal(
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
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteHandler.promises.getInviteByToken.callCount.should.equal(
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
        this.res.render.callsFake(() => done())
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
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function () {
        this.CollaboratorsInviteHandler.promises.getInviteByToken.callCount.should.equal(
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

  describe('resendInvite', function () {
    beforeEach(function () {
      this.req.params = {
        Project_id: this.project_id,
        invite_id: (this.invite_id = 'thuseoautoh'),
      }
      this.req.session = {
        user: { _id: (this.current_user_id = 'current-user-id') },
      }
      this.res.render = sinon.stub()
      this.res.sendStatus = sinon.stub()
      this.CollaboratorsInviteHandler.promises.resendInvite = sinon
        .stub()
        .resolves(null)
      this.CollaboratorsInviteController.promises._checkRateLimit = sinon
        .stub()
        .resolves(true)
      this.callback = sinon.stub()
      this.next = sinon.stub()
    })

    describe('when resendInvite does not produce an error', function () {
      beforeEach(function (done) {
        this.res.sendStatus.callsFake(() => done())
        this.CollaboratorsInviteController.resendInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce a 201 response', function () {
        this.res.sendStatus.callCount.should.equal(1)
        this.res.sendStatus.calledWith(201).should.equal(true)
      })

      it('should have called resendInvite', function () {
        this.CollaboratorsInviteHandler.promises.resendInvite.callCount.should.equal(
          1
        )
      })

      it('should check the rate limit', function () {
        this.CollaboratorsInviteController.promises._checkRateLimit.callCount.should.equal(
          1
        )
      })
    })

    describe('when resendInvite produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteHandler.promises.resendInvite = sinon
          .stub()
          .rejects(new Error('woops'))
        this.next.callsFake(() => done())
        this.CollaboratorsInviteController.resendInvite(
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

      it('should have called resendInvite', function () {
        this.CollaboratorsInviteHandler.promises.resendInvite.callCount.should.equal(
          1
        )
      })
    })
  })

  describe('revokeInvite', function () {
    beforeEach(function () {
      this.req.params = {
        Project_id: this.project_id,
        invite_id: (this.invite_id = 'thuseoautoh'),
      }
      this.current_user = { _id: (this.current_user_id = 'current-user-id') }
      this.req.session = { user: this.current_user }
      this.res.render = sinon.stub()
      this.res.sendStatus = sinon.stub()
      this.CollaboratorsInviteHandler.promises.revokeInvite = sinon
        .stub()
        .resolves(null)
      this.callback = sinon.stub()
      this.next = sinon.stub()
    })

    describe('when revokeInvite does not produce an error', function () {
      beforeEach(function (done) {
        this.res.sendStatus.callsFake(() => done())
        this.CollaboratorsInviteController.revokeInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce a 201 response', function () {
        this.res.sendStatus.callCount.should.equal(1)
        this.res.sendStatus.calledWith(201).should.equal(true)
      })

      it('should have called revokeInvite', function () {
        this.CollaboratorsInviteHandler.promises.revokeInvite.callCount.should.equal(
          1
        )
      })

      it('should have called emitToRoom', function () {
        this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
        this.EditorRealTimeController.emitToRoom
          .calledWith(this.project_id, 'project:membership:changed')
          .should.equal(true)
      })
    })

    describe('when revokeInvite produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteHandler.promises.revokeInvite = sinon
          .stub()
          .rejects(new Error('woops'))
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
        Project_id: this.project_id,
        token: (this.token = 'mock-token'),
      }
      this.req.session = {
        user: { _id: (this.current_user_id = 'current-user-id') },
      }
      this.res.render = sinon.stub()
      this.res.redirect = sinon.stub()
      this.CollaboratorsInviteHandler.promises.acceptInvite = sinon
        .stub()
        .resolves(null)
      this.callback = sinon.stub()
      this.next = sinon.stub()
    })

    describe('when acceptInvite does not produce an error', function () {
      beforeEach(function (done) {
        this.res.redirect.callsFake(() => done())
        this.CollaboratorsInviteController.acceptInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should redirect to project page', function () {
        this.res.redirect.callCount.should.equal(1)
        this.res.redirect
          .calledWith(`/project/${this.project_id}`)
          .should.equal(true)
      })

      it('should have called acceptInvite', function () {
        this.CollaboratorsInviteHandler.promises.acceptInvite
          .calledWith(this.project_id, this.token)
          .should.equal(true)
      })

      it('should have called emitToRoom', function () {
        this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
        this.EditorRealTimeController.emitToRoom
          .calledWith(this.project_id, 'project:membership:changed')
          .should.equal(true)
      })
    })

    describe('when revokeInvite produces an error', function () {
      beforeEach(function (done) {
        this.CollaboratorsInviteHandler.promises.acceptInvite = sinon
          .stub()
          .rejects(new Error('woops'))
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
  })

  describe('_checkShouldInviteEmail', function () {
    beforeEach(function () {
      this.email = 'user@example.com'
    })

    describe('when we should be restricting to existing accounts', function () {
      beforeEach(function () {
        this.settings.restrictInvitesToExistingAccounts = true
        this.call = callback => {
          this.CollaboratorsInviteController._checkShouldInviteEmail(
            this.email,
            callback
          )
        }
      })

      describe('when user account is present', function () {
        beforeEach(function () {
          this.user = { _id: ObjectId().toString() }
          this.UserGetter.promises.getUserByAnyEmail = sinon
            .stub()
            .resolves(this.user)
        })

        it('should callback with `true`', function (done) {
          this.call((err, shouldAllow) => {
            expect(err).to.equal(null)
            expect(shouldAllow).to.equal(true)
            done()
          })
        })
      })

      describe('when user account is absent', function () {
        beforeEach(function () {
          this.user = null
          this.UserGetter.promises.getUserByAnyEmail = sinon
            .stub()
            .resolves(this.user)
        })

        it('should callback with `false`', function (done) {
          this.call((err, shouldAllow) => {
            expect(err).to.equal(null)
            expect(shouldAllow).to.equal(false)
            done()
          })
        })

        it('should have called getUser', function (done) {
          this.call((err, shouldAllow) => {
            if (err) {
              return done(err)
            }
            this.UserGetter.promises.getUserByAnyEmail.callCount.should.equal(1)
            this.UserGetter.promises.getUserByAnyEmail
              .calledWith(this.email, { _id: 1 })
              .should.equal(true)
            done()
          })
        })
      })

      describe('when getUser produces an error', function () {
        beforeEach(function () {
          this.user = null
          this.UserGetter.promises.getUserByAnyEmail = sinon
            .stub()
            .rejects(new Error('woops'))
        })

        it('should callback with an error', function (done) {
          this.call((err, shouldAllow) => {
            expect(err).to.not.equal(null)
            expect(err).to.be.instanceof(Error)
            expect(shouldAllow).to.equal(undefined)
            done()
          })
        })
      })
    })
  })

  describe('_checkRateLimit', function () {
    beforeEach(function () {
      this.settings.restrictInvitesToExistingAccounts = false
      this.sendingUserId = '32312313'
      this.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser =
        sinon.stub()
      this.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser
        .withArgs(this.sendingUserId)
        .resolves(17)
    })

    it('should callback with `true` when rate limit under', function (done) {
      this.CollaboratorsInviteController._checkRateLimit(
        this.sendingUserId,
        (err, result) => {
          if (err) {
            return done(err)
          }
          expect(this.rateLimiter.consume).to.have.been.calledWith(
            this.sendingUserId
          )
          result.should.equal(true)
          done()
        }
      )
    })

    it('should callback with `false` when rate limit hit', function (done) {
      this.rateLimiter.consume.rejects({ remainingPoints: 0 })
      this.CollaboratorsInviteController._checkRateLimit(
        this.sendingUserId,
        (err, result) => {
          if (err) {
            return done(err)
          }
          expect(this.rateLimiter.consume).to.have.been.calledWith(
            this.sendingUserId
          )
          result.should.equal(false)
          done()
        }
      )
    })

    it('should allow 10x the collaborators', function (done) {
      this.CollaboratorsInviteController._checkRateLimit(
        this.sendingUserId,
        (err, result) => {
          if (err) {
            return done(err)
          }
          expect(this.rateLimiter.consume).to.have.been.calledWith(
            this.sendingUserId,
            Math.floor(40000 / 170)
          )
          done()
        }
      )
    })

    it('should allow 200 requests when collaborators is -1', function (done) {
      this.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser
        .withArgs(this.sendingUserId)
        .resolves(-1)
      this.CollaboratorsInviteController._checkRateLimit(
        this.sendingUserId,
        (err, result) => {
          if (err) {
            return done(err)
          }
          expect(this.rateLimiter.consume).to.have.been.calledWith(
            this.sendingUserId,
            Math.floor(40000 / 200)
          )
          done()
        }
      )
    })

    it('should allow 10 requests when user has no collaborators set', function (done) {
      this.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser
        .withArgs(this.sendingUserId)
        .resolves(null)
      this.CollaboratorsInviteController._checkRateLimit(
        this.sendingUserId,
        (err, result) => {
          if (err) {
            return done(err)
          }
          expect(this.rateLimiter.consume).to.have.been.calledWith(
            this.sendingUserId,
            Math.floor(40000 / 10)
          )
          done()
        }
      )
    })
  })
})
