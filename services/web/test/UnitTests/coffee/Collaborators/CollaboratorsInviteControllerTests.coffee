sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Collaborators/CollaboratorsInviteController.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"
ObjectId = require("mongojs").ObjectId

describe "CollaboratorsInviteController", ->
	beforeEach ->
		@user =
			_id: 'id'
		@AnalyticsManger = recordEvent: sinon.stub()
		@AuthenticationController =
			getSessionUser: (req) => req.session.user
		@CollaboratorsInviteController = SandboxedModule.require modulePath, requires:
			"../Project/ProjectGetter": @ProjectGetter = {}
			'../Subscription/LimitationsManager' : @LimitationsManager = {}
			'../User/UserGetter': @UserGetter = {getUser: sinon.stub()}
			"./CollaboratorsHandler": @CollaboratorsHandler = {}
			"./CollaboratorsInviteHandler": @CollaboratorsInviteHandler = {}
			'logger-sharelatex': @logger = {err: sinon.stub(), error: sinon.stub(), log: sinon.stub()}
			"../Editor/EditorRealTimeController": @EditorRealTimeController = {emitToRoom: sinon.stub()}
			"../Notifications/NotificationsBuilder": @NotificationsBuilder = {}
			"../Analytics/AnalyticsManager": @AnalyticsManger
			'../Authentication/AuthenticationController': @AuthenticationController
			'settings-sharelatex': @settings = {}
		@res = new MockResponse()
		@req = new MockRequest()

		@project_id = "project-id-123"
		@callback = sinon.stub()

	describe 'getAllInvites', ->

		beforeEach ->
			@fakeInvites = [
				{_id: ObjectId(), one: 1},
				{_id: ObjectId(), two: 2}
			]
			@req.params =
				Project_id: @project_id
			@res.json = sinon.stub()
			@next = sinon.stub()

		describe 'when all goes well', ->

			beforeEach ->
				@CollaboratorsInviteHandler.getAllInvites = sinon.stub().callsArgWith(1, null, @fakeInvites)
				@CollaboratorsInviteController.getAllInvites @req, @res, @next

			it 'should not produce an error', ->
				@next.callCount.should.equal 0

			it 'should produce a list of invite objects', ->
				@res.json.callCount.should.equal 1
				@res.json.calledWith({invites: @fakeInvites}).should.equal true

			it 'should have called CollaboratorsInviteHandler.getAllInvites', ->
				@CollaboratorsInviteHandler.getAllInvites.callCount.should.equal 1
				@CollaboratorsInviteHandler.getAllInvites.calledWith(@project_id).should.equal true

		describe 'when CollaboratorsInviteHandler.getAllInvites produces an error', ->

			beforeEach ->
				@CollaboratorsInviteHandler.getAllInvites = sinon.stub().callsArgWith(1, new Error('woops'))
				@CollaboratorsInviteController.getAllInvites @req, @res, @next

			it 'should produce an error', ->
				@next.callCount.should.equal 1
				@next.firstCall.args[0].should.be.instanceof Error

	describe 'inviteToProject', ->

		beforeEach ->
			@targetEmail = "user@example.com"
			@req.params =
				Project_id: @project_id
			@current_user =
				_id: @current_user_id = "current-user-id"
			@req.session =
				user: @current_user
			@req.body =
				email: @targetEmail
				privileges: @privileges = "readAndWrite"
			@res.json = sinon.stub()
			@res.sendStatus = sinon.stub()
			@invite = {
				_id: ObjectId(),
				token: "htnseuthaouse",
				sendingUserId: @current_user_id,
				projectId: @targetEmail,
				targetEmail: 'user@example.com'
				createdAt: new Date(),
			}
			@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, null, true)
			@CollaboratorsInviteHandler.inviteToProject = sinon.stub().callsArgWith(4, null, @invite)
			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when all goes well', ->

			beforeEach ->
				@_checkShouldInviteEmail = sinon.stub(
					@CollaboratorsInviteController, '_checkShouldInviteEmail'
				).callsArgWith(1, null, true)
				@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, null, true)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			afterEach ->
				@_checkShouldInviteEmail.restore()

			it 'should produce json response', ->
				@res.json.callCount.should.equal 1
				({invite: @invite}).should.deep.equal(@res.json.firstCall.args[0])

			it 'should have called canAddXCollaborators', ->
				@LimitationsManager.canAddXCollaborators.callCount.should.equal 1
				@LimitationsManager.canAddXCollaborators.calledWith(@project_id).should.equal true

			it 'should have called _checkShouldInviteEmail', ->
				@_checkShouldInviteEmail.callCount.should.equal 1
				@_checkShouldInviteEmail.calledWith(@targetEmail).should.equal true

			it 'should have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 1
				@CollaboratorsInviteHandler.inviteToProject.calledWith(@project_id,@current_user,@targetEmail,@privileges).should.equal true

			it 'should have called emitToRoom', ->
				@EditorRealTimeController.emitToRoom.callCount.should.equal 1
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'project:membership:changed').should.equal true

		describe 'when the user is not allowed to add more collaborators', ->

			beforeEach ->
				@_checkShouldInviteEmail = sinon.stub(
					@CollaboratorsInviteController, '_checkShouldInviteEmail'
				).callsArgWith(1, null, true)
				@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, null, false)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			afterEach ->
				@_checkShouldInviteEmail.restore()

			it 'should produce json response without an invite', ->
				@res.json.callCount.should.equal 1
				({invite: null}).should.deep.equal(@res.json.firstCall.args[0])

			it 'should not have called _checkShouldInviteEmail', ->
				@_checkShouldInviteEmail.callCount.should.equal 0
				@_checkShouldInviteEmail.calledWith(@targetEmail).should.equal false

			it 'should not have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 0

		describe 'when canAddXCollaborators produces an error', ->

			beforeEach ->
				@_checkShouldInviteEmail = sinon.stub(
					@CollaboratorsInviteController, '_checkShouldInviteEmail'
				).callsArgWith(1, null, true)
				@err = new Error('woops')
				@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, @err)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			afterEach ->
				@_checkShouldInviteEmail.restore()

			it 'should call next with an error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should not have called _checkShouldInviteEmail', ->
				@_checkShouldInviteEmail.callCount.should.equal 0
				@_checkShouldInviteEmail.calledWith(@targetEmail).should.equal false

			it 'should not have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 0

		describe 'when inviteToProject produces an error', ->

			beforeEach ->
				@_checkShouldInviteEmail = sinon.stub(
					@CollaboratorsInviteController, '_checkShouldInviteEmail'
				).callsArgWith(1, null, true)
				@err = new Error('woops')
				@CollaboratorsInviteHandler.inviteToProject = sinon.stub().callsArgWith(4, @err)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			afterEach ->
				@_checkShouldInviteEmail.restore()

			it 'should call next with an error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should have called canAddXCollaborators', ->
				@LimitationsManager.canAddXCollaborators.callCount.should.equal 1
				@LimitationsManager.canAddXCollaborators.calledWith(@project_id).should.equal true

			it 'should have called _checkShouldInviteEmail', ->
				@_checkShouldInviteEmail.callCount.should.equal 1
				@_checkShouldInviteEmail.calledWith(@targetEmail).should.equal true

			it 'should have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 1
				@CollaboratorsInviteHandler.inviteToProject.calledWith(@project_id,@current_user,@targetEmail,@privileges).should.equal true

		describe 'when _checkShouldInviteEmail disallows the invite', ->

			beforeEach ->
				@_checkShouldInviteEmail = sinon.stub(
					@CollaboratorsInviteController, '_checkShouldInviteEmail'
				).callsArgWith(1, null, false)
				@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, null, true)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			afterEach ->
				@_checkShouldInviteEmail.restore()

			it 'should produce json response with no invite, and an error property', ->
				@res.json.callCount.should.equal 1
				({invite: null, error: 'cannot_invite_non_user'}).should.deep.equal(@res.json.firstCall.args[0])

			it 'should have called _checkShouldInviteEmail', ->
				@_checkShouldInviteEmail.callCount.should.equal 1
				@_checkShouldInviteEmail.calledWith(@targetEmail).should.equal true

			it 'should not have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 0

		describe 'when _checkShouldInviteEmail produces an error', ->

			beforeEach ->
				@_checkShouldInviteEmail = sinon.stub(
					@CollaboratorsInviteController, '_checkShouldInviteEmail'
				).callsArgWith(1, new Error('woops'))
				@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, null, true)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			afterEach ->
				@_checkShouldInviteEmail.restore()

			it 'should call next with an error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should have called _checkShouldInviteEmail', ->
				@_checkShouldInviteEmail.callCount.should.equal 1
				@_checkShouldInviteEmail.calledWith(@targetEmail).should.equal true

			it 'should not have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 0

	describe "viewInvite", ->

		beforeEach ->
			@token = "some-opaque-token"
			@req.params =
				Project_id: @project_id
				token: @token
			@req.session =
				user: _id: @current_user_id = "current-user-id"
			@res.render = sinon.stub()
			@res.redirect = sinon.stub()
			@res.sendStatus = sinon.stub()
			@invite = {
				_id: ObjectId(),
				token: @token,
				sendingUserId: ObjectId(),
				projectId: @project_id,
				targetEmail: 'user@example.com'
				createdAt: new Date(),
			}
			@fakeProject =
				_id: @project_id
				name: "some project"
				owner_ref: @invite.sendingUserId
				collaberator_refs: []
				readOnly_refs: []
			@owner =
				_id: @fakeProject.owner_ref
				first_name: "John"
				last_name: "Doe"
				email: "john@example.com"

			@CollaboratorsHandler.isUserMemberOfProject = sinon.stub().callsArgWith(2, null, false, null)
			@CollaboratorsInviteHandler.getInviteByToken = sinon.stub().callsArgWith(2, null, @invite)
			@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, @fakeProject)
			@UserGetter.getUser.callsArgWith(2, null, @owner)

			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when the token is valid', ->

			beforeEach ->
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should render the view template', ->
				@res.render.callCount.should.equal 1
				@res.render.calledWith('project/invite/show').should.equal true

			it 'should not call next', ->
				@next.callCount.should.equal 0

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1
				@CollaboratorsInviteHandler.getInviteByToken.calledWith(@fakeProject._id, @invite.token).should.equal true

			it 'should call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 1
				@UserGetter.getUser.calledWith({_id: @fakeProject.owner_ref}).should.equal true

			it 'should call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 1
				@ProjectGetter.getProject.calledWith(@project_id).should.equal true

		describe 'when user is already a member of the project', ->

			beforeEach ->
				@CollaboratorsHandler.isUserMemberOfProject = sinon.stub().callsArgWith(2, null, true, null)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should redirect to the project page', ->
				@res.redirect.callCount.should.equal 1
				@res.redirect.calledWith("/project/#{@project_id}").should.equal true

			it 'should not call next with an error', ->
				@next.callCount.should.equal 0

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should not call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 0

			it 'should not call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 0

			it 'should not call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 0

		describe 'when isUserMemberOfProject produces an error', ->

			beforeEach ->
				@CollaboratorsHandler.isUserMemberOfProject = sinon.stub().callsArgWith(2, new Error('woops'))
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should call next with an error', ->
				@next.callCount.should.equal 1
				expect(@next.firstCall.args[0]).to.be.instanceof Error

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should not call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 0

			it 'should not call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 0

			it 'should not call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 0

		describe 'when the getInviteByToken produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@CollaboratorsInviteHandler.getInviteByToken.callsArgWith(2, @err)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should call next with the error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should not call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 0

			it 'should not call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 0

		describe 'when the getInviteByToken does not produce an invite', ->

			beforeEach ->
				@CollaboratorsInviteHandler.getInviteByToken.callsArgWith(2, null, null)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should render the not-valid view template', ->
				@res.render.callCount.should.equal 1
				@res.render.calledWith('project/invite/not-valid').should.equal true

			it 'should not call next', ->
				@next.callCount.should.equal 0

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should not call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 0

			it 'should not call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 0

		describe 'when User.getUser produces an error', ->

			beforeEach ->
				@UserGetter.getUser.callsArgWith(2, new Error('woops'))
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should produce an error', ->
				@next.callCount.should.equal 1
				expect(@next.firstCall.args[0]).to.be.instanceof Error

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1

			it 'should call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 1
				@UserGetter.getUser.calledWith({_id: @fakeProject.owner_ref}).should.equal true

			it 'should not call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 0

		describe 'when User.getUser does not find a user', ->

			beforeEach ->
				@UserGetter.getUser.callsArgWith(2, null, null)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should render the not-valid view template', ->
				@res.render.callCount.should.equal 1
				@res.render.calledWith('project/invite/not-valid').should.equal true

			it 'should not call next', ->
				@next.callCount.should.equal 0

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1

			it 'should call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 1
				@UserGetter.getUser.calledWith({_id: @fakeProject.owner_ref}).should.equal true

			it 'should not call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 0

		describe 'when getProject produces an error', ->

			beforeEach ->
				@ProjectGetter.getProject.callsArgWith(2, new Error('woops'))
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should produce an error', ->
				@next.callCount.should.equal 1
				expect(@next.firstCall.args[0]).to.be.instanceof Error

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1

			it 'should call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 1
				@UserGetter.getUser.calledWith({_id: @fakeProject.owner_ref}).should.equal true

			it 'should call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 1

		describe 'when Project.getUser does not find a user', ->

			beforeEach ->
				@ProjectGetter.getProject.callsArgWith(2, null, null)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should render the not-valid view template', ->
				@res.render.callCount.should.equal 1
				@res.render.calledWith('project/invite/not-valid').should.equal true

			it 'should not call next', ->
				@next.callCount.should.equal 0

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1

			it 'should call getUser', ->
				@UserGetter.getUser.callCount.should.equal 1
				@UserGetter.getUser.calledWith({_id: @fakeProject.owner_ref}).should.equal true

			it 'should call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 1

	describe "resendInvite", ->

		beforeEach ->
			@req.params =
				Project_id: @project_id
				invite_id: @invite_id = "thuseoautoh"
			@req.session =
				user: _id: @current_user_id = "current-user-id"
			@res.render = sinon.stub()
			@res.sendStatus = sinon.stub()
			@CollaboratorsInviteHandler.resendInvite = sinon.stub().callsArgWith(3, null)
			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when resendInvite does not produce an error', ->

			beforeEach ->
				@CollaboratorsInviteController.resendInvite @req, @res, @next

			it 'should produce a 201 response', ->
				@res.sendStatus.callCount.should.equal 1
				@res.sendStatus.calledWith(201).should.equal true

			it 'should have called resendInvite', ->
				@CollaboratorsInviteHandler.resendInvite.callCount.should.equal 1

		describe 'when resendInvite produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@CollaboratorsInviteHandler.resendInvite = sinon.stub().callsArgWith(3, @err)
				@CollaboratorsInviteController.resendInvite @req, @res, @next

			it 'should not produce a 201 response', ->
				@res.sendStatus.callCount.should.equal 0

			it 'should call next with the error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should have called resendInvite', ->
				@CollaboratorsInviteHandler.resendInvite.callCount.should.equal 1

	describe "revokeInvite", ->

		beforeEach ->
			@req.params =
				Project_id: @project_id
				invite_id: @invite_id = "thuseoautoh"
			@current_user =
				_id: @current_user_id = "current-user-id"
			@req.session =
				user: @current_user
			@res.render = sinon.stub()
			@res.sendStatus = sinon.stub()
			@CollaboratorsInviteHandler.revokeInvite = sinon.stub().callsArgWith(2, null)
			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when revokeInvite does not produce an error', ->

			beforeEach ->
				@CollaboratorsInviteController.revokeInvite @req, @res, @next

			it 'should produce a 201 response', ->
				@res.sendStatus.callCount.should.equal 1
				@res.sendStatus.calledWith(201).should.equal true

			it 'should have called revokeInvite', ->
				@CollaboratorsInviteHandler.revokeInvite.callCount.should.equal 1

			it 'should have called emitToRoom', ->
				@EditorRealTimeController.emitToRoom.callCount.should.equal 1
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'project:membership:changed').should.equal true

		describe 'when revokeInvite produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@CollaboratorsInviteHandler.revokeInvite = sinon.stub().callsArgWith(2, @err)
				@CollaboratorsInviteController.revokeInvite @req, @res, @next

			it 'should not produce a 201 response', ->
				@res.sendStatus.callCount.should.equal 0

			it 'should call next with the error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should have called revokeInvite', ->
				@CollaboratorsInviteHandler.revokeInvite.callCount.should.equal 1

	describe "acceptInvite", ->

		beforeEach ->
			@req.params =
				Project_id: @project_id
				token: @token = "mock-token"
			@req.session =
				user: _id: @current_user_id = "current-user-id"
			@res.render = sinon.stub()
			@res.redirect = sinon.stub()
			@CollaboratorsInviteHandler.acceptInvite = sinon.stub().callsArgWith(3, null)
			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when acceptInvite does not produce an error', ->

			beforeEach ->
				@CollaboratorsInviteController.acceptInvite @req, @res, @next

			it 'should redirect to project page', () ->
				@res.redirect.callCount.should.equal 1
				@res.redirect.calledWith("/project/#{@project_id}").should.equal true

			it 'should have called acceptInvite', ->
				@CollaboratorsInviteHandler.acceptInvite
					.calledWith(@project_id, @token)
					.should.equal true

			it 'should have called emitToRoom', ->
				@EditorRealTimeController.emitToRoom.callCount.should.equal 1
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'project:membership:changed').should.equal true

		describe 'when revokeInvite produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@CollaboratorsInviteHandler.acceptInvite = sinon.stub().callsArgWith(3, @err)
				@CollaboratorsInviteController.acceptInvite @req, @res, @next

			it 'should not redirect to project page', ->
				@res.redirect.callCount.should.equal 0

			it 'should call next with the error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should have called acceptInvite', ->
				@CollaboratorsInviteHandler.acceptInvite.callCount.should.equal 1

	describe '_checkShouldInviteEmail', ->

		beforeEach ->
			@email = 'user@example.com'
			@call = (callback) =>
				@CollaboratorsInviteController._checkShouldInviteEmail @email, callback

		describe 'when we should be restricting to existing accounts', ->

			beforeEach ->
				@settings.restrictInvitesToExistingAccounts = true

			describe 'when user account is present', ->

				beforeEach ->
					@user = {_id: ObjectId().toString()}
					@UserGetter.getUser = sinon.stub().callsArgWith(2, null, @user)

				it 'should callback with `true`', (done) ->
					@call (err, shouldAllow) =>
						expect(err).to.equal null
						expect(shouldAllow).to.equal true
						done()

			describe 'when user account is absent', ->

				beforeEach ->
					@user = null
					@UserGetter.getUser = sinon.stub().callsArgWith(2, null, @user)

				it 'should callback with `false`', (done) ->
					@call (err, shouldAllow) =>
						expect(err).to.equal null
						expect(shouldAllow).to.equal false
						done()

				it 'should have called getUser', (done) ->
					@call (err, shouldAllow) =>
						@UserGetter.getUser.callCount.should.equal 1
						@UserGetter.getUser.calledWith({email: @email}, {_id: 1}).should.equal true
						done()

			describe 'when getUser produces an error', ->

				beforeEach ->
					@user = null
					@UserGetter.getUser = sinon.stub().callsArgWith(2, new Error('woops'))

				it 'should callback with an error', (done) ->
					@call (err, shouldAllow) =>
						expect(err).to.not.equal null
						expect(err).to.be.instanceof Error
						expect(shouldAllow).to.equal undefined
						done()

		describe 'when we should not be restricting', ->

			beforeEach ->
				@settings.restrictInvitesToExistingAccounts = false

			it 'should callback with `true`', (done) ->
				@call (err, shouldAllow) =>
					expect(err).to.equal null
					expect(shouldAllow).to.equal true
					done()

			it 'should not have called getUser', (done) ->
				@call (err, shouldAllow) =>
					@UserGetter.getUser.callCount.should.equal 0
					done()
