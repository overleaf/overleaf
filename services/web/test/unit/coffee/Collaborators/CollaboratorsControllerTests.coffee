sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Collaborators/CollaboratorsController.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"
ObjectId = require("mongojs").ObjectId

describe "CollaboratorsController", ->
	beforeEach ->
		@CollaboratorsController = SandboxedModule.require modulePath, requires:
			"../Project/ProjectGetter": @ProjectGetter = {}
			"./CollaboratorsHandler": @CollaboratorsHandler = {}
			"../Editor/EditorRealTimeController": @EditorRealTimeController = {}
			'../Subscription/LimitationsManager' : @LimitationsManager = {}
			'../Project/ProjectEditorHandler' : @ProjectEditorHandler = {}
			'../User/UserGetter': @UserGetter = {}
			'logger-sharelatex': @logger = {err: sinon.stub(), erro: sinon.stub(), log: sinon.stub()}
		@res = new MockResponse()
		@req = new MockRequest()

		@project_id = "project-id-123"
		@callback = sinon.stub()

	describe "removeUserFromProject", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id = "project-id-123"
				user_id: @user_id = "user-id-123"
			@res.sendStatus = sinon.stub()
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@CollaboratorsHandler.removeUserFromProject = sinon.stub().callsArg(2)
			@CollaboratorsController.removeUserFromProject @req, @res

		it "should from the user from the project", ->
			@CollaboratorsHandler.removeUserFromProject
				.calledWith(@project_id, @user_id)
				.should.equal true

		it "should emit a userRemovedFromProject event to the proejct", ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, 'userRemovedFromProject', @user_id)
				.should.equal true

		it "should send the back a success response", ->
			@res.sendStatus.calledWith(204).should.equal true

		it 'should have called emitToRoom', ->
			@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'project:membership:changed').should.equal true

	describe "removeSelfFromProject", ->
		beforeEach ->
			@req.session =
				user: _id: @user_id = "user-id-123"
			@req.params = Project_id: @project_id
			@res.sendStatus = sinon.stub()
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@CollaboratorsHandler.removeUserFromProject = sinon.stub().callsArg(2)
			@CollaboratorsController.removeSelfFromProject(@req, @res)

		it "should remove the logged in user from the project", ->
			@CollaboratorsHandler.removeUserFromProject
				.calledWith(@project_id, @user_id)
				.should.equal true

		it "should emit a userRemovedFromProject event to the proejct", ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, 'userRemovedFromProject', @user_id)
				.should.equal true

		it "should return a success code", ->
			@res.sendStatus.calledWith(204).should.equal true

	describe 'getAllMembers', ->
		beforeEach ->
			@req.session =
				user: _id: @user_id = "user-id-123"
			@req.params = Project_id: @project_id
			@res.json = sinon.stub()
			@next = sinon.stub()
			@members = [{a: 1}]
			@CollaboratorsHandler.getAllInvitedMembers = sinon.stub().callsArgWith(1, null, @members)
			@CollaboratorsController.getAllMembers(@req, @res, @next)

		it 'should not produce an error', ->
			@next.callCount.should.equal 0

		it 'should produce a json response', ->
			@res.json.callCount.should.equal 1
			@res.json.calledWith({members: @members}).should.equal true

		it 'should call CollaboratorsHandler.getAllMembers', ->
			@CollaboratorsHandler.getAllInvitedMembers.callCount.should.equal 1

		describe 'when CollaboratorsHandler.getAllInvitedMembers produces an error', ->
			beforeEach ->
				@res.json = sinon.stub()
				@next = sinon.stub()
				@CollaboratorsHandler.getAllInvitedMembers = sinon.stub().callsArgWith(1, new Error('woops'))
				@CollaboratorsController.getAllMembers(@req, @res, @next)

			it 'should produce an error', ->
				@next.callCount.should.equal 1
				@next.firstCall.args[0].should.be.instanceof Error

			it 'should not produce a json response', ->
				@res.json.callCount.should.equal 0
