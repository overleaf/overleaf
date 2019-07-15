/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath =
  '../../../../app/src/Features/Collaborators/CollaboratorsInviteController.js'
const SandboxedModule = require('sandboxed-module')
const events = require('events')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const { ObjectId } = require('mongojs')

describe('CollaboratorsInviteController', function() {
  beforeEach(function() {
    this.user = { _id: 'id' }
    this.AnalyticsManger = { recordEvent: sinon.stub() }
    this.sendingUser = null
    this.AuthenticationController = {
      getSessionUser: req => {
        this.sendingUser = req.session.user
        return this.sendingUser
      }
    }

    this.RateLimiter = { addCount: sinon.stub }

    this.LimitationsManager = {}
    this.UserGetter = {
      getUserByAnyEmail: sinon.stub(),
      getUser: sinon.stub()
    }

    this.CollaboratorsInviteController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        '../Subscription/LimitationsManager': this.LimitationsManager,
        '../User/UserGetter': this.UserGetter,
        './CollaboratorsHandler': (this.CollaboratorsHandler = {}),
        './CollaboratorsInviteHandler': (this.CollaboratorsInviteHandler = {}),
        'logger-sharelatex': (this.logger = {
          err: sinon.stub(),
          error: sinon.stub(),
          warn: sinon.stub(),
          log: sinon.stub()
        }),
        '../Editor/EditorRealTimeController': (this.EditorRealTimeController = {
          emitToRoom: sinon.stub()
        }),
        '../Notifications/NotificationsBuilder': (this.NotificationsBuilder = {}),
        '../Analytics/AnalyticsManager': this.AnalyticsManger,
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        'settings-sharelatex': (this.settings = {}),
        '../../infrastructure/RateLimiter': this.RateLimiter
      }
    })
    this.res = new MockResponse()
    this.req = new MockRequest()

    this.project_id = 'project-id-123'
    return (this.callback = sinon.stub())
  })

  describe('getAllInvites', function() {
    beforeEach(function() {
      this.fakeInvites = [
        { _id: ObjectId(), one: 1 },
        { _id: ObjectId(), two: 2 }
      ]
      this.req.params = { Project_id: this.project_id }
      this.res.json = sinon.stub()
      return (this.next = sinon.stub())
    })

    describe('when all goes well', function() {
      beforeEach(function() {
        this.CollaboratorsInviteHandler.getAllInvites = sinon
          .stub()
          .callsArgWith(1, null, this.fakeInvites)
        return this.CollaboratorsInviteController.getAllInvites(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not produce an error', function() {
        return this.next.callCount.should.equal(0)
      })

      it('should produce a list of invite objects', function() {
        this.res.json.callCount.should.equal(1)
        return this.res.json
          .calledWith({ invites: this.fakeInvites })
          .should.equal(true)
      })

      it('should have called CollaboratorsInviteHandler.getAllInvites', function() {
        this.CollaboratorsInviteHandler.getAllInvites.callCount.should.equal(1)
        return this.CollaboratorsInviteHandler.getAllInvites
          .calledWith(this.project_id)
          .should.equal(true)
      })
    })

    describe('when CollaboratorsInviteHandler.getAllInvites produces an error', function() {
      beforeEach(function() {
        this.CollaboratorsInviteHandler.getAllInvites = sinon
          .stub()
          .callsArgWith(1, new Error('woops'))
        return this.CollaboratorsInviteController.getAllInvites(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce an error', function() {
        this.next.callCount.should.equal(1)
        return this.next.firstCall.args[0].should.be.instanceof(Error)
      })
    })
  })

  describe('inviteToProject', function() {
    beforeEach(function() {
      this.targetEmail = 'user@example.com'
      this.req.params = { Project_id: this.project_id }
      this.current_user = { _id: (this.current_user_id = 'current-user-id') }
      this.req.session = { user: this.current_user }
      this.req.body = {
        email: this.targetEmail,
        privileges: (this.privileges = 'readAndWrite')
      }
      this.res.json = sinon.stub()
      this.res.sendStatus = sinon.stub()
      this.invite = {
        _id: ObjectId(),
        token: 'htnseuthaouse',
        sendingUserId: this.current_user_id,
        projectId: this.targetEmail,
        targetEmail: 'user@example.com',
        createdAt: new Date()
      }
      this.LimitationsManager.canAddXCollaborators = sinon
        .stub()
        .callsArgWith(2, null, true)
      this.CollaboratorsInviteHandler.inviteToProject = sinon
        .stub()
        .callsArgWith(4, null, this.invite)
      this.err = new Error('woops')
      this.callback = sinon.stub()
      return (this.next = sinon.stub())
    })

    describe('when all goes well', function() {
      beforeEach(function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .callsArgWith(1, null, true)
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .yields(null, true)
        this.LimitationsManager.canAddXCollaborators = sinon
          .stub()
          .callsArgWith(2, null, true)
        return this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce json response', function() {
        this.res.json.callCount.should.equal(1)
        return { invite: this.invite }.should.deep.equal(
          this.res.json.firstCall.args[0]
        )
      })

      it('should have called canAddXCollaborators', function() {
        this.LimitationsManager.canAddXCollaborators.callCount.should.equal(1)
        return this.LimitationsManager.canAddXCollaborators
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should have called _checkShouldInviteEmail', function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        return this.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(this.targetEmail)
          .should.equal(true)
      })

      it('should have called inviteToProject', function() {
        this.CollaboratorsInviteHandler.inviteToProject.callCount.should.equal(
          1
        )
        return this.CollaboratorsInviteHandler.inviteToProject
          .calledWith(
            this.project_id,
            this.current_user,
            this.targetEmail,
            this.privileges
          )
          .should.equal(true)
      })

      it('should have called emitToRoom', function() {
        this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
        return this.EditorRealTimeController.emitToRoom
          .calledWith(this.project_id, 'project:membership:changed')
          .should.equal(true)
      })
    })

    describe('when the user is not allowed to add more collaborators', function() {
      beforeEach(function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .callsArgWith(1, null, true)
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .yields(null, true)
        this.LimitationsManager.canAddXCollaborators = sinon
          .stub()
          .callsArgWith(2, null, false)
        return this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce json response without an invite', function() {
        this.res.json.callCount.should.equal(1)
        return { invite: null }.should.deep.equal(
          this.res.json.firstCall.args[0]
        )
      })

      it('should not have called _checkShouldInviteEmail', function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          0
        )
        return this.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(this.sendingUser, this.targetEmail)
          .should.equal(false)
      })

      it('should not have called inviteToProject', function() {
        return this.CollaboratorsInviteHandler.inviteToProject.callCount.should.equal(
          0
        )
      })
    })

    describe('when canAddXCollaborators produces an error', function() {
      beforeEach(function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .callsArgWith(1, null, true)
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .yields(null, true)
        this.LimitationsManager.canAddXCollaborators = sinon
          .stub()
          .callsArgWith(2, this.err)
        return this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function() {
        this.next.callCount.should.equal(1)
        return this.next.calledWith(this.err).should.equal(true)
      })

      it('should not have called _checkShouldInviteEmail', function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          0
        )
        return this.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(this.sendingUser, this.targetEmail)
          .should.equal(false)
      })

      it('should not have called inviteToProject', function() {
        return this.CollaboratorsInviteHandler.inviteToProject.callCount.should.equal(
          0
        )
      })
    })

    describe('when inviteToProject produces an error', function() {
      beforeEach(function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .callsArgWith(1, null, true)
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .yields(null, true)
        this.err = new Error('woops')
        this.CollaboratorsInviteHandler.inviteToProject = sinon
          .stub()
          .callsArgWith(4, this.err)
        return this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function() {
        this.next.callCount.should.equal(1)
        return this.next.calledWith(this.err).should.equal(true)
      })

      it('should have called canAddXCollaborators', function() {
        this.LimitationsManager.canAddXCollaborators.callCount.should.equal(1)
        return this.LimitationsManager.canAddXCollaborators
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should have called _checkShouldInviteEmail', function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        return this.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(this.targetEmail)
          .should.equal(true)
      })

      it('should have called inviteToProject', function() {
        this.CollaboratorsInviteHandler.inviteToProject.callCount.should.equal(
          1
        )
        return this.CollaboratorsInviteHandler.inviteToProject
          .calledWith(
            this.project_id,
            this.current_user,
            this.targetEmail,
            this.privileges
          )
          .should.equal(true)
      })
    })

    describe('when _checkShouldInviteEmail disallows the invite', function() {
      beforeEach(function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .callsArgWith(1, null, false)
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .yields(null, true)
        this.LimitationsManager.canAddXCollaborators = sinon
          .stub()
          .callsArgWith(2, null, true)
        return this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce json response with no invite, and an error property', function() {
        this.res.json.callCount.should.equal(1)
        return {
          invite: null,
          error: 'cannot_invite_non_user'
        }.should.deep.equal(this.res.json.firstCall.args[0])
      })

      it('should have called _checkShouldInviteEmail', function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        return this.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(this.targetEmail)
          .should.equal(true)
      })

      it('should not have called inviteToProject', function() {
        return this.CollaboratorsInviteHandler.inviteToProject.callCount.should.equal(
          0
        )
      })
    })

    describe('when _checkShouldInviteEmail produces an error', function() {
      beforeEach(function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .callsArgWith(1, new Error('woops'))
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .yields(null, true)
        this.LimitationsManager.canAddXCollaborators = sinon
          .stub()
          .callsArgWith(2, null, true)
        return this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function() {
        this.next.callCount.should.equal(1)
        return this.next.calledWith(this.err).should.equal(true)
      })

      it('should have called _checkShouldInviteEmail', function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          1
        )
        return this.CollaboratorsInviteController._checkShouldInviteEmail
          .calledWith(this.targetEmail)
          .should.equal(true)
      })

      it('should not have called inviteToProject', function() {
        return this.CollaboratorsInviteHandler.inviteToProject.callCount.should.equal(
          0
        )
      })
    })

    describe('when the user invites themselves to the project', function() {
      beforeEach(function() {
        this.req.session.user = { _id: 'abc', email: 'me@example.com' }
        this.req.body.email = 'me@example.com'
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .callsArgWith(1, null, true)
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .yields(null, true)
        this.LimitationsManager.canAddXCollaborators = sinon
          .stub()
          .callsArgWith(2, null, true)
        return this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should reject action, return json response with error code', function() {
        this.res.json.callCount.should.equal(1)
        return { invite: null, error: 'cannot_invite_self' }.should.deep.equal(
          this.res.json.firstCall.args[0]
        )
      })

      it('should not have called canAddXCollaborators', function() {
        return this.LimitationsManager.canAddXCollaborators.callCount.should.equal(
          0
        )
      })

      it('should not have called _checkShouldInviteEmail', function() {
        return this.CollaboratorsInviteController._checkShouldInviteEmail.callCount.should.equal(
          0
        )
      })

      it('should not have called inviteToProject', function() {
        return this.CollaboratorsInviteHandler.inviteToProject.callCount.should.equal(
          0
        )
      })

      it('should not have called emitToRoom', function() {
        return this.EditorRealTimeController.emitToRoom.callCount.should.equal(
          0
        )
      })
    })

    describe('when _checkRateLimit returns false', function() {
      beforeEach(function() {
        this.CollaboratorsInviteController._checkShouldInviteEmail = sinon
          .stub()
          .callsArgWith(1, null, true)
        this.CollaboratorsInviteController._checkRateLimit = sinon
          .stub()
          .yields(null, false)
        this.LimitationsManager.canAddXCollaborators = sinon
          .stub()
          .callsArgWith(2, null, true)
        return this.CollaboratorsInviteController.inviteToProject(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 429 response', function() {
        return this.res.sendStatus.calledWith(429).should.equal(true)
      })

      it('should not call inviteToProject', function() {
        return this.CollaboratorsInviteHandler.inviteToProject.called.should.equal(
          false
        )
      })

      it('should not call emitToRoom', function() {
        return this.EditorRealTimeController.emitToRoom.called.should.equal(
          false
        )
      })
    })
  })

  describe('viewInvite', function() {
    beforeEach(function() {
      this.token = 'some-opaque-token'
      this.req.params = {
        Project_id: this.project_id,
        token: this.token
      }
      this.req.session = {
        user: { _id: (this.current_user_id = 'current-user-id') }
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
        createdAt: new Date()
      }
      this.fakeProject = {
        _id: this.project_id,
        name: 'some project',
        owner_ref: this.invite.sendingUserId,
        collaberator_refs: [],
        readOnly_refs: []
      }
      this.owner = {
        _id: this.fakeProject.owner_ref,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com'
      }

      this.CollaboratorsHandler.isUserInvitedMemberOfProject = sinon
        .stub()
        .callsArgWith(2, null, false, null)
      this.CollaboratorsInviteHandler.getInviteByToken = sinon
        .stub()
        .callsArgWith(2, null, this.invite)
      this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, this.fakeProject)
      this.UserGetter.getUser.callsArgWith(2, null, this.owner)

      this.callback = sinon.stub()
      return (this.next = sinon.stub())
    })

    describe('when the token is valid', function() {
      beforeEach(function() {
        return this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should render the view template', function() {
        this.res.render.callCount.should.equal(1)
        return this.res.render
          .calledWith('project/invite/show')
          .should.equal(true)
      })

      it('should not call next', function() {
        return this.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsHandler.isUserInvitedMemberOfProject', function() {
        this.CollaboratorsHandler.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        return this.CollaboratorsHandler.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function() {
        this.CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal(
          1
        )
        return this.CollaboratorsInviteHandler.getInviteByToken
          .calledWith(this.fakeProject._id, this.invite.token)
          .should.equal(true)
      })

      it('should call User.getUser', function() {
        this.UserGetter.getUser.callCount.should.equal(1)
        return this.UserGetter.getUser
          .calledWith({ _id: this.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should call ProjectGetter.getProject', function() {
        this.ProjectGetter.getProject.callCount.should.equal(1)
        return this.ProjectGetter.getProject
          .calledWith(this.project_id)
          .should.equal(true)
      })
    })

    describe('when user is already a member of the project', function() {
      beforeEach(function() {
        this.CollaboratorsHandler.isUserInvitedMemberOfProject = sinon
          .stub()
          .callsArgWith(2, null, true, null)
        return this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should redirect to the project page', function() {
        this.res.redirect.callCount.should.equal(1)
        return this.res.redirect
          .calledWith(`/project/${this.project_id}`)
          .should.equal(true)
      })

      it('should not call next with an error', function() {
        return this.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsHandler.isUserInvitedMemberOfProject', function() {
        this.CollaboratorsHandler.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        return this.CollaboratorsHandler.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should not call getInviteByToken', function() {
        return this.CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal(
          0
        )
      })

      it('should not call User.getUser', function() {
        return this.UserGetter.getUser.callCount.should.equal(0)
      })

      it('should not call ProjectGetter.getProject', function() {
        return this.ProjectGetter.getProject.callCount.should.equal(0)
      })
    })

    describe('when isUserInvitedMemberOfProject produces an error', function() {
      beforeEach(function() {
        this.CollaboratorsHandler.isUserInvitedMemberOfProject = sinon
          .stub()
          .callsArgWith(2, new Error('woops'))
        return this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function() {
        this.next.callCount.should.equal(1)
        return expect(this.next.firstCall.args[0]).to.be.instanceof(Error)
      })

      it('should call CollaboratorsHandler.isUserInvitedMemberOfProject', function() {
        this.CollaboratorsHandler.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        return this.CollaboratorsHandler.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should not call getInviteByToken', function() {
        return this.CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal(
          0
        )
      })

      it('should not call User.getUser', function() {
        return this.UserGetter.getUser.callCount.should.equal(0)
      })

      it('should not call ProjectGetter.getProject', function() {
        return this.ProjectGetter.getProject.callCount.should.equal(0)
      })
    })

    describe('when the getInviteByToken produces an error', function() {
      beforeEach(function() {
        this.err = new Error('woops')
        this.CollaboratorsInviteHandler.getInviteByToken.callsArgWith(
          2,
          this.err
        )
        return this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with the error', function() {
        this.next.callCount.should.equal(1)
        return this.next.calledWith(this.err).should.equal(true)
      })

      it('should call CollaboratorsHandler.isUserInvitedMemberOfProject', function() {
        this.CollaboratorsHandler.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        return this.CollaboratorsHandler.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function() {
        this.CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal(
          1
        )
        return this.CollaboratorsHandler.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should not call User.getUser', function() {
        return this.UserGetter.getUser.callCount.should.equal(0)
      })

      it('should not call ProjectGetter.getProject', function() {
        return this.ProjectGetter.getProject.callCount.should.equal(0)
      })
    })

    describe('when the getInviteByToken does not produce an invite', function() {
      beforeEach(function() {
        this.CollaboratorsInviteHandler.getInviteByToken.callsArgWith(
          2,
          null,
          null
        )
        return this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should render the not-valid view template', function() {
        this.res.render.callCount.should.equal(1)
        return this.res.render
          .calledWith('project/invite/not-valid')
          .should.equal(true)
      })

      it('should not call next', function() {
        return this.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsHandler.isUserInvitedMemberOfProject', function() {
        this.CollaboratorsHandler.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        return this.CollaboratorsHandler.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function() {
        this.CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal(
          1
        )
        return this.CollaboratorsHandler.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should not call User.getUser', function() {
        return this.UserGetter.getUser.callCount.should.equal(0)
      })

      it('should not call ProjectGetter.getProject', function() {
        return this.ProjectGetter.getProject.callCount.should.equal(0)
      })
    })

    describe('when User.getUser produces an error', function() {
      beforeEach(function() {
        this.UserGetter.getUser.callsArgWith(2, new Error('woops'))
        return this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce an error', function() {
        this.next.callCount.should.equal(1)
        return expect(this.next.firstCall.args[0]).to.be.instanceof(Error)
      })

      it('should call CollaboratorsHandler.isUserInvitedMemberOfProject', function() {
        this.CollaboratorsHandler.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        return this.CollaboratorsHandler.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function() {
        return this.CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal(
          1
        )
      })

      it('should call User.getUser', function() {
        this.UserGetter.getUser.callCount.should.equal(1)
        return this.UserGetter.getUser
          .calledWith({ _id: this.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should not call ProjectGetter.getProject', function() {
        return this.ProjectGetter.getProject.callCount.should.equal(0)
      })
    })

    describe('when User.getUser does not find a user', function() {
      beforeEach(function() {
        this.UserGetter.getUser.callsArgWith(2, null, null)
        return this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should render the not-valid view template', function() {
        this.res.render.callCount.should.equal(1)
        return this.res.render
          .calledWith('project/invite/not-valid')
          .should.equal(true)
      })

      it('should not call next', function() {
        return this.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsHandler.isUserInvitedMemberOfProject', function() {
        this.CollaboratorsHandler.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        return this.CollaboratorsHandler.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function() {
        return this.CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal(
          1
        )
      })

      it('should call User.getUser', function() {
        this.UserGetter.getUser.callCount.should.equal(1)
        return this.UserGetter.getUser
          .calledWith({ _id: this.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should not call ProjectGetter.getProject', function() {
        return this.ProjectGetter.getProject.callCount.should.equal(0)
      })
    })

    describe('when getProject produces an error', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject.callsArgWith(2, new Error('woops'))
        return this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce an error', function() {
        this.next.callCount.should.equal(1)
        return expect(this.next.firstCall.args[0]).to.be.instanceof(Error)
      })

      it('should call CollaboratorsHandler.isUserInvitedMemberOfProject', function() {
        this.CollaboratorsHandler.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        return this.CollaboratorsHandler.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function() {
        return this.CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal(
          1
        )
      })

      it('should call User.getUser', function() {
        this.UserGetter.getUser.callCount.should.equal(1)
        return this.UserGetter.getUser
          .calledWith({ _id: this.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should call ProjectGetter.getProject', function() {
        return this.ProjectGetter.getProject.callCount.should.equal(1)
      })
    })

    describe('when Project.getUser does not find a user', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject.callsArgWith(2, null, null)
        return this.CollaboratorsInviteController.viewInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should render the not-valid view template', function() {
        this.res.render.callCount.should.equal(1)
        return this.res.render
          .calledWith('project/invite/not-valid')
          .should.equal(true)
      })

      it('should not call next', function() {
        return this.next.callCount.should.equal(0)
      })

      it('should call CollaboratorsHandler.isUserInvitedMemberOfProject', function() {
        this.CollaboratorsHandler.isUserInvitedMemberOfProject.callCount.should.equal(
          1
        )
        return this.CollaboratorsHandler.isUserInvitedMemberOfProject
          .calledWith(this.current_user_id, this.project_id)
          .should.equal(true)
      })

      it('should call getInviteByToken', function() {
        return this.CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal(
          1
        )
      })

      it('should call getUser', function() {
        this.UserGetter.getUser.callCount.should.equal(1)
        return this.UserGetter.getUser
          .calledWith({ _id: this.fakeProject.owner_ref })
          .should.equal(true)
      })

      it('should call ProjectGetter.getProject', function() {
        return this.ProjectGetter.getProject.callCount.should.equal(1)
      })
    })
  })

  describe('resendInvite', function() {
    beforeEach(function() {
      this.req.params = {
        Project_id: this.project_id,
        invite_id: (this.invite_id = 'thuseoautoh')
      }
      this.req.session = {
        user: { _id: (this.current_user_id = 'current-user-id') }
      }
      this.res.render = sinon.stub()
      this.res.sendStatus = sinon.stub()
      this.CollaboratorsInviteHandler.resendInvite = sinon
        .stub()
        .callsArgWith(3, null)
      this.CollaboratorsInviteController._checkRateLimit = sinon
        .stub()
        .yields(null, true)
      this.callback = sinon.stub()
      return (this.next = sinon.stub())
    })

    describe('when resendInvite does not produce an error', function() {
      beforeEach(function() {
        return this.CollaboratorsInviteController.resendInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce a 201 response', function() {
        this.res.sendStatus.callCount.should.equal(1)
        return this.res.sendStatus.calledWith(201).should.equal(true)
      })

      it('should have called resendInvite', function() {
        return this.CollaboratorsInviteHandler.resendInvite.callCount.should.equal(
          1
        )
      })

      it('should check the rate limit', function() {
        return this.CollaboratorsInviteController._checkRateLimit.callCount.should.equal(
          1
        )
      })
    })

    describe('when resendInvite produces an error', function() {
      beforeEach(function() {
        this.err = new Error('woops')
        this.CollaboratorsInviteHandler.resendInvite = sinon
          .stub()
          .callsArgWith(3, this.err)
        return this.CollaboratorsInviteController.resendInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not produce a 201 response', function() {
        return this.res.sendStatus.callCount.should.equal(0)
      })

      it('should call next with the error', function() {
        this.next.callCount.should.equal(1)
        return this.next.calledWith(this.err).should.equal(true)
      })

      it('should have called resendInvite', function() {
        return this.CollaboratorsInviteHandler.resendInvite.callCount.should.equal(
          1
        )
      })
    })
  })

  describe('revokeInvite', function() {
    beforeEach(function() {
      this.req.params = {
        Project_id: this.project_id,
        invite_id: (this.invite_id = 'thuseoautoh')
      }
      this.current_user = { _id: (this.current_user_id = 'current-user-id') }
      this.req.session = { user: this.current_user }
      this.res.render = sinon.stub()
      this.res.sendStatus = sinon.stub()
      this.CollaboratorsInviteHandler.revokeInvite = sinon
        .stub()
        .callsArgWith(2, null)
      this.callback = sinon.stub()
      return (this.next = sinon.stub())
    })

    describe('when revokeInvite does not produce an error', function() {
      beforeEach(function() {
        return this.CollaboratorsInviteController.revokeInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should produce a 201 response', function() {
        this.res.sendStatus.callCount.should.equal(1)
        return this.res.sendStatus.calledWith(201).should.equal(true)
      })

      it('should have called revokeInvite', function() {
        return this.CollaboratorsInviteHandler.revokeInvite.callCount.should.equal(
          1
        )
      })

      it('should have called emitToRoom', function() {
        this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
        return this.EditorRealTimeController.emitToRoom
          .calledWith(this.project_id, 'project:membership:changed')
          .should.equal(true)
      })
    })

    describe('when revokeInvite produces an error', function() {
      beforeEach(function() {
        this.err = new Error('woops')
        this.CollaboratorsInviteHandler.revokeInvite = sinon
          .stub()
          .callsArgWith(2, this.err)
        return this.CollaboratorsInviteController.revokeInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not produce a 201 response', function() {
        return this.res.sendStatus.callCount.should.equal(0)
      })

      it('should call next with the error', function() {
        this.next.callCount.should.equal(1)
        return this.next.calledWith(this.err).should.equal(true)
      })

      it('should have called revokeInvite', function() {
        return this.CollaboratorsInviteHandler.revokeInvite.callCount.should.equal(
          1
        )
      })
    })
  })

  describe('acceptInvite', function() {
    beforeEach(function() {
      this.req.params = {
        Project_id: this.project_id,
        token: (this.token = 'mock-token')
      }
      this.req.session = {
        user: { _id: (this.current_user_id = 'current-user-id') }
      }
      this.res.render = sinon.stub()
      this.res.redirect = sinon.stub()
      this.CollaboratorsInviteHandler.acceptInvite = sinon
        .stub()
        .callsArgWith(3, null)
      this.callback = sinon.stub()
      return (this.next = sinon.stub())
    })

    describe('when acceptInvite does not produce an error', function() {
      beforeEach(function() {
        return this.CollaboratorsInviteController.acceptInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should redirect to project page', function() {
        this.res.redirect.callCount.should.equal(1)
        return this.res.redirect
          .calledWith(`/project/${this.project_id}`)
          .should.equal(true)
      })

      it('should have called acceptInvite', function() {
        return this.CollaboratorsInviteHandler.acceptInvite
          .calledWith(this.project_id, this.token)
          .should.equal(true)
      })

      it('should have called emitToRoom', function() {
        this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
        return this.EditorRealTimeController.emitToRoom
          .calledWith(this.project_id, 'project:membership:changed')
          .should.equal(true)
      })
    })

    describe('when revokeInvite produces an error', function() {
      beforeEach(function() {
        this.err = new Error('woops')
        this.CollaboratorsInviteHandler.acceptInvite = sinon
          .stub()
          .callsArgWith(3, this.err)
        return this.CollaboratorsInviteController.acceptInvite(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not redirect to project page', function() {
        return this.res.redirect.callCount.should.equal(0)
      })

      it('should call next with the error', function() {
        this.next.callCount.should.equal(1)
        return this.next.calledWith(this.err).should.equal(true)
      })

      it('should have called acceptInvite', function() {
        return this.CollaboratorsInviteHandler.acceptInvite.callCount.should.equal(
          1
        )
      })
    })
  })

  describe('_checkShouldInviteEmail', function() {
    beforeEach(function() {
      return (this.email = 'user@example.com')
    })

    describe('when we should be restricting to existing accounts', function() {
      beforeEach(function() {
        this.settings.restrictInvitesToExistingAccounts = true
        return (this.call = callback => {
          return this.CollaboratorsInviteController._checkShouldInviteEmail(
            this.email,
            callback
          )
        })
      })

      describe('when user account is present', function() {
        beforeEach(function() {
          this.user = { _id: ObjectId().toString() }
          return (this.UserGetter.getUserByAnyEmail = sinon
            .stub()
            .callsArgWith(2, null, this.user))
        })

        it('should callback with `true`', function(done) {
          return this.call((err, shouldAllow) => {
            expect(err).to.equal(null)
            expect(shouldAllow).to.equal(true)
            return done()
          })
        })
      })

      describe('when user account is absent', function() {
        beforeEach(function() {
          this.user = null
          return (this.UserGetter.getUserByAnyEmail = sinon
            .stub()
            .callsArgWith(2, null, this.user))
        })

        it('should callback with `false`', function(done) {
          return this.call((err, shouldAllow) => {
            expect(err).to.equal(null)
            expect(shouldAllow).to.equal(false)
            return done()
          })
        })

        it('should have called getUser', function(done) {
          return this.call((err, shouldAllow) => {
            this.UserGetter.getUserByAnyEmail.callCount.should.equal(1)
            this.UserGetter.getUserByAnyEmail
              .calledWith(this.email, { _id: 1 })
              .should.equal(true)
            return done()
          })
        })
      })

      describe('when getUser produces an error', function() {
        beforeEach(function() {
          this.user = null
          return (this.UserGetter.getUserByAnyEmail = sinon
            .stub()
            .callsArgWith(2, new Error('woops')))
        })

        it('should callback with an error', function(done) {
          return this.call((err, shouldAllow) => {
            expect(err).to.not.equal(null)
            expect(err).to.be.instanceof(Error)
            expect(shouldAllow).to.equal(undefined)
            return done()
          })
        })
      })
    })
  })

  describe('_checkRateLimit', function() {
    beforeEach(function() {
      this.settings.restrictInvitesToExistingAccounts = false
      this.sendingUserId = '32312313'
      this.LimitationsManager.allowedNumberOfCollaboratorsForUser = sinon.stub()
      return this.LimitationsManager.allowedNumberOfCollaboratorsForUser
        .withArgs(this.sendingUserId)
        .yields(null, 17)
    })

    it('should callback with `true` when rate limit under', function(done) {
      this.RateLimiter.addCount = sinon.stub().callsArgWith(1, null, true)
      return this.CollaboratorsInviteController._checkRateLimit(
        this.sendingUserId,
        (err, result) => {
          this.RateLimiter.addCount.called.should.equal(true)
          result.should.equal(true)
          return done()
        }
      )
    })

    it('should callback with `false` when rate limit hit', function(done) {
      this.RateLimiter.addCount = sinon.stub().callsArgWith(1, null, false)
      return this.CollaboratorsInviteController._checkRateLimit(
        this.sendingUserId,
        (err, result) => {
          this.RateLimiter.addCount.called.should.equal(true)
          result.should.equal(false)
          return done()
        }
      )
    })

    it('should call rate limiter with 10x the collaborators', function(done) {
      this.RateLimiter.addCount = sinon.stub().callsArgWith(1, null, true)
      return this.CollaboratorsInviteController._checkRateLimit(
        this.sendingUserId,
        (err, result) => {
          this.RateLimiter.addCount.args[0][0].throttle.should.equal(170)
          return done()
        }
      )
    })

    it('should call rate limiter with 200 when collaborators is -1', function(done) {
      this.LimitationsManager.allowedNumberOfCollaboratorsForUser
        .withArgs(this.sendingUserId)
        .yields(null, -1)
      this.RateLimiter.addCount = sinon.stub().callsArgWith(1, null, true)
      return this.CollaboratorsInviteController._checkRateLimit(
        this.sendingUserId,
        (err, result) => {
          this.RateLimiter.addCount.args[0][0].throttle.should.equal(200)
          return done()
        }
      )
    })

    it('should call rate limiter with 10 when user has no collaborators set', function(done) {
      this.LimitationsManager.allowedNumberOfCollaboratorsForUser
        .withArgs(this.sendingUserId)
        .yields(null)
      this.RateLimiter.addCount = sinon.stub().callsArgWith(1, null, true)
      return this.CollaboratorsInviteController._checkRateLimit(
        this.sendingUserId,
        (err, result) => {
          this.RateLimiter.addCount.args[0][0].throttle.should.equal(10)
          return done()
        }
      )
    })
  })
})
