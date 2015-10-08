should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Collaborators/CollaboratorsHandler"
expect = require("chai").expect

describe "CollaboratorsHandler", ->
	beforeEach ->
		@CollaboratorHandler = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": @logger = { log: sinon.stub(), err: sinon.stub() }
			'../User/UserCreator': @UserCreator = {}
			"../../models/Project": Project: @Project = {}
			"../Project/ProjectEntityHandler": @ProjectEntityHandler = {}

		@project_id = "mock-project-id"
		@user_id = "mock-user-id"
		@callback = sinon.stub()

	describe "removeUserFromProject", ->
		beforeEach ->
			@Project.update = sinon.stub().callsArg(2)
			@CollaboratorHandler.removeUserFromProject @project_id, @user_id, @callback

		it "should remove the user from mongo", ->
			@Project.update
				.calledWith({
					_id: @project_id
				}, {
					"$pull":{collaberator_refs:@user_id, readOnly_refs:@user_id}
				})
				.should.equal true
	
	describe "addUserToProject", ->
		beforeEach ->
			@Project.update = sinon.stub().callsArg(2)
			@ProjectEntityHandler.flushProjectToThirdPartyDataStore = sinon.stub().callsArg(1)
			
		describe "as readOnly", ->
			beforeEach ->
				@CollaboratorHandler.addUserToProject @project_id, @user_id, "readOnly", @callback

			it "should add the user to the readOnly_refs", ->
				@Project.update
					.calledWith({
						_id: @project_id
					}, {
						"$push":{ readOnly_refs: @user_id }
					})
					.should.equal true
			
			it "should flush the project to the TPDS", ->
				@ProjectEntityHandler.flushProjectToThirdPartyDataStore
					.calledWith(@project_id)
					.should.equal true
					
		describe "as readAndWrite", ->
			beforeEach ->
				@CollaboratorHandler.addUserToProject @project_id, @user_id, "readAndWrite", @callback

			it "should add the user to the collaberator_refs", ->
				@Project.update
					.calledWith({
						_id: @project_id
					}, {
						"$push":{ collaberator_refs: @user_id }
					})
					.should.equal true
			
			it "should flush the project to the TPDS", ->
				@ProjectEntityHandler.flushProjectToThirdPartyDataStore
					.calledWith(@project_id)
					.should.equal true
		
		describe "with invalid privilegeLevel", ->
			beforeEach ->
				@CollaboratorHandler.addUserToProject @project_id, @user_id, "notValid", @callback

			it "should call the callback with an error", ->
				@callback.calledWith(new Error()).should.equal true
	
	describe "addEmailToProject", ->
		beforeEach ->
			@UserCreator.getUserOrCreateHoldingAccount = sinon.stub().callsArgWith(1, null, @user = {_id: @user_id})
			@CollaboratorHandler.addUserToProject = sinon.stub().callsArg(3)

		describe "with a valid email", ->
			beforeEach ->
				@CollaboratorHandler.addEmailToProject @project_id, (@email = "Joe@example.com"), (@privilegeLevel = "readAndWrite"), @callback
			
			it "should get the user with the lowercased email", ->
				@UserCreator.getUserOrCreateHoldingAccount
					.calledWith(@email.toLowerCase())
					.should.equal true
		
			it "should add the user to the project by id", ->
				@CollaboratorHandler.addUserToProject
					.calledWith(@project_id, @user_id, @privilegeLevel)
					.should.equal true
			
			it "should return the callback with the user_id", ->
				@callback.calledWith(null, @user_id).should.equal true
		
		describe "with an invalid email", ->
			beforeEach ->
				@CollaboratorHandler.addEmailToProject @project_id, "not-and-email", (@privilegeLevel = "readAndWrite"), @callback
		
			it "should call the callback with an error", ->
				@callback.calledWith(new Error()).should.equal true
			
			it "should not add any users to the proejct", ->
				@CollaboratorHandler.addUserToProject.called.should.equal false




