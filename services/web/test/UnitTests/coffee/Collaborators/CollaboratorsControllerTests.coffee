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
		@res = new MockResponse()
		@req = new MockRequest()

		@project_id = "project-id-123"
		@callback = sinon.stub()

	describe "getCollaborators", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
			@members = [
				{
					user: { _id: "admin-id", email: "admin@example.com", first_name: "Joe", last_name: "Admin", foo: "bar" }
					privilegeLevel: "admin"
				},
				{
					user: { _id: "rw-id", email: "rw@example.com", first_name: "Jane", last_name: "Write", foo: "bar" }
					privilegeLevel: "readAndWrite"
				},
				{
					user: { _id: "ro-id", email: "ro@example.com", first_name: "Joe", last_name: "Read", foo: "bar" }
					privilegeLevel: "readOnly"
				}
			]
			@CollaboratorsHandler.getMembersWithPrivilegeLevels = sinon.stub()
			@CollaboratorsHandler.getMembersWithPrivilegeLevels
				.withArgs(@project_id)
				.yields(null, @members)
			@res.json = sinon.stub()
			@CollaboratorsController.getCollaborators(@req, @res)

		it "should return the formatted collaborators", ->
			@res.json
				.calledWith([
					{
						id: "admin-id", email: "admin@example.com", first_name: "Joe", last_name: "Admin"
						permissions: ["read", "write", "admin"]
						owner: true
					}
					{
						id: "rw-id", email: "rw@example.com", first_name: "Jane", last_name: "Write"
						permissions: ["read", "write"]
						owner: false
					}
					{
						id: "ro-id", email: "ro@example.com", first_name: "Joe", last_name: "Read"
						permissions: ["read"]
						owner: false
					}
				])
				.should.equal true

	describe "addUserToProject", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
			@req.body =
				email: @email = "Joe@example.com"
				privileges: @privileges = "readOnly"
			@req.session =
				user: _id: @adding_user_id = "adding-user-id"
			@res.json = sinon.stub()
			@user_id = "mock-user-id"
			@raw_user = {
				_id: @user_id, email: "joe@example.com", first_name: "Joe", last_name: "Example", unused: "foo"
			}
			@user_view = {
				id: @user_id, first_name: "Joe", last_name: "Example", email: "joe@example.com"
			}
			@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, null, true)
			@ProjectEditorHandler.buildUserModelView = sinon.stub().returns(@user_view)
			@CollaboratorsHandler.addEmailToProject = sinon.stub().callsArgWith(4, null, @user_id)
			@UserGetter.getUser = sinon.stub().callsArgWith(1, null, @user)
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@callback = sinon.stub()

		describe "when the project can accept more collaborators", ->
			beforeEach ->
				@CollaboratorsController.addUserToProject @req, @res, @next

			it "should add the user to the project", ->
				@CollaboratorsHandler.addEmailToProject
					.calledWith(@project_id, @adding_user_id, @email.toLowerCase(), @privileges)
					.should.equal true

			it "should emit a userAddedToProject event", ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "userAddedToProject", @user_view, @privileges)
					.should.equal true

			it "should send the user as the response body", ->
				@res.json
					.calledWith({
						user: @user_view
					})
					.should.equal true

		describe "when the project cannot accept more collaborators", ->
			beforeEach ->
				@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, null, false)
				@CollaboratorsController.addUserToProject @req, @res, @next
		
			it "should not add the user to the project", ->
				@CollaboratorsHandler.addEmailToProject.called.should.equal false
		
			it "should not emit a userAddedToProject event", ->
				@EditorRealTimeController.emitToRoom.called.should.equal false

			it "should send user: false as the response body", ->
				@res.json
					.calledWith({
						user: false
					})
					.should.equal true

		describe "when the email is not valid", ->
			beforeEach ->
				@req.body.email = "not-valid"
				@res.status = sinon.stub().returns @res
				@res.send = sinon.stub()
				@CollaboratorsController.addUserToProject @req, @res, @next
		
			it "should not add the user to the project", ->
				@CollaboratorsHandler.addEmailToProject.called.should.equal false
		
			it "should not emit a userAddedToProject event", ->
				@EditorRealTimeController.emitToRoom.called.should.equal false

			it "should return a 400 response", ->
				@res.status.calledWith(400).should.equal true
				@res.send.calledWith("invalid email address").should.equal true
			
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

