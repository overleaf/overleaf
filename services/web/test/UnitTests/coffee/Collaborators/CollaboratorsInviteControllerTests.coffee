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
		@CollaboratorsInviteController = SandboxedModule.require modulePath, requires:
			"../Project/ProjectGetter": @ProjectGetter = {}
			"./CollaboratorsInviteHandler": @CollaboratorsInviteHandler = {}
			"../Editor/EditorRealTimeController": @EditorRealTimeController = {}
			'../Subscription/LimitationsManager' : @LimitationsManager = {}
			'../Project/ProjectEditorHandler' : @ProjectEditorHandler = {}
			'../User/UserGetter': @UserGetter = {}
		@res = new MockResponse()
		@req = new MockRequest()

		@project_id = "project-id-123"
		@callback = sinon.stub()

	describe "viewInvite", ->

		beforeEach ->
			@req.params =
				Project_id: @project_id
				token: "some-opaque-token"
			@req.session =
				user: _id: @current_user_id = "current-user-id"
			@res.render = sinon.stub()
			@invite = {
				_id: ObjectId(),
				token: "htnseuthaouse",
				sendingUserId: ObjectId(),
				projectId: @projectId,
				targetEmail: 'user@example.com'
				createdAt: new Date(),
				expiresAt: new Date()
			}
			@CollaboratorsInviteHandler.getInviteByToken = sinon.stub().callsArgWith(2, null, @invite)
			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when the token is valid', ->

			beforeEach ->
				@CollaboratorsInviteHandler.getInviteByToken.callsArgWith(2, null, @invite)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should render the view template', ->
				@res.render.callCount.should.equal 1
				@res.render.firstCall.args[0].should.equal 'project/invite'
