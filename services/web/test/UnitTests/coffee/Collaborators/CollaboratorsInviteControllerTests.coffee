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
		@User = class User
			constructor: (options={}) -> this
			@findOne: sinon.stub()
		@Project = class Project
			constructor: () ->
				this
			@findOne: sinon.stub()
		@CollaboratorsInviteController = SandboxedModule.require modulePath, requires:
			"../Project/ProjectGetter": @ProjectGetter = {}
			"./CollaboratorsInviteHandler": @CollaboratorsInviteHandler = {}
			"../Editor/EditorRealTimeController": @EditorRealTimeController = {}
			'../Subscription/LimitationsManager' : @LimitationsManager = {}
			'../Project/ProjectEditorHandler' : @ProjectEditorHandler = {}
			'../User/UserGetter': @UserGetter = {}
			'../../models/Project': {Project: @Project}
			'../../models/User': {User; @User}
			'logger-sharelatex': @logger = {err: sinon.stub(), error: sinon.stub(), log: sinon.stub()}
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
			@req.session =
				user: _id: @current_user_id = "current-user-id"
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
				@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, null, true)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			it 'should produce json response', ->
				@res.json.callCount.should.equal 1
				({invite: @invite}).should.deep.equal(@res.json.firstCall.args[0])

			it 'should have called canAddXCollaborators', ->
				@LimitationsManager.canAddXCollaborators.callCount.should.equal 1
				@LimitationsManager.canAddXCollaborators.calledWith(@project_id).should.equal true

			it 'should have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 1
				@CollaboratorsInviteHandler.inviteToProject.calledWith(@project_id,@current_user_id,@targetEmail,@privileges).should.equal true

		describe 'when the user is not allowed to add more collaborators', ->

			beforeEach ->
				@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, null, false)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			it 'should produce json response without an invite', ->
				@res.json.callCount.should.equal 1
				({invite: null}).should.deep.equal(@res.json.firstCall.args[0])

			it 'should not have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 0

		describe 'when canAddXCollaborators produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, @err)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			it 'should call next with an error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should not have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 0

		describe 'when inviteToProject produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@CollaboratorsInviteHandler.inviteToProject = sinon.stub().callsArgWith(4, @err)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			it 'should call next with an error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should have called canAddXCollaborators', ->
				@LimitationsManager.canAddXCollaborators.callCount.should.equal 1
				@LimitationsManager.canAddXCollaborators.calledWith(@project_id).should.equal true

			it 'should have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 1
				@CollaboratorsInviteHandler.inviteToProject.calledWith(@project_id,@current_user_id,@targetEmail,@privileges).should.equal true

	describe "viewInvite", ->

		beforeEach ->
			@req.params =
				Project_id: @project_id
				token: "some-opaque-token"
			@req.session =
				user: _id: @current_user_id = "current-user-id"
			@res.render = sinon.stub()
			@res.sendStatus = sinon.stub()
			@invite = {
				_id: ObjectId(),
				token: "htnseuthaouse",
				sendingUserId: ObjectId(),
				projectId: @project_id,
				targetEmail: 'user@example.com'
				createdAt: new Date(),
			}
			@fakeProject =
				_id: @project_id
				name: "some project"
				owner_ref: @invite.sendingUserId
			@owner =
				_id: @fakeProject.owner_ref
				first_name: "John"
				last_name: "Doe"
				email: "john@example.com"
			@Project.findOne.callsArgWith(2, null, @fakeProject)
			@User.findOne.callsArgWith(2, null, @owner)
			@CollaboratorsInviteHandler.getInviteByToken = sinon.stub().callsArgWith(2, null, @invite)
			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when the token is valid', ->

			beforeEach ->
				@CollaboratorsInviteHandler.getInviteByToken.callsArgWith(2, null, @invite)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should render the view template', ->
				@res.render.callCount.should.equal 1
				@res.render.calledWith('project/invite/show').should.equal true

			it 'should not call next', ->
				@next.callCount.should.equal 0

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1

		describe 'when the getInviteByToken produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@CollaboratorsInviteHandler.getInviteByToken.callsArgWith(2, @err)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should call next with the error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1

		describe 'when the getInviteByToken does not produce an invite', ->

			beforeEach ->
				@CollaboratorsInviteHandler.getInviteByToken.callsArgWith(2, null, null)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should render the not-valid view template', ->
				@res.render.callCount.should.equal 1
				@res.render.calledWith('project/invite/not-valid').should.equal true

			it 'should not call next', ->
				@next.callCount.should.equal 0

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1

	describe "revokeInvite", ->

		beforeEach ->
			@req.params =
				Project_id: @project_id
				invite_id: @invite_id = "thuseoautoh"
			@req.session =
				user: _id: @current_user_id = "current-user-id"
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
				invite_id: @invite_id = "thuseoautoh"
			@req.session =
				user: _id: @current_user_id = "current-user-id"
			@req.body =
				token: "thsueothaueotauahsuet"
			@res.render = sinon.stub()
			@res.redirect = sinon.stub()
			@CollaboratorsInviteHandler.acceptInvite = sinon.stub().callsArgWith(4, null)
			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when acceptInvite does not produce an error', ->

			beforeEach ->
				@CollaboratorsInviteController.acceptInvite @req, @res, @next

			it 'should redirect to project page', () ->
				@res.redirect.callCount.should.equal 1
				@res.redirect.calledWith("/project/#{@project_id}").should.equal true

			it 'should have called acceptInvite', ->
				@CollaboratorsInviteHandler.acceptInvite.callCount.should.equal 1

		describe 'when revokeInvite produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@CollaboratorsInviteHandler.acceptInvite = sinon.stub().callsArgWith(4, @err)
				@CollaboratorsInviteController.acceptInvite @req, @res, @next

			it 'should not redirect to project page', ->
				@res.redirect.callCount.should.equal 0

			it 'should call next with the error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should have called acceptInvite', ->
				@CollaboratorsInviteHandler.acceptInvite.callCount.should.equal 1
