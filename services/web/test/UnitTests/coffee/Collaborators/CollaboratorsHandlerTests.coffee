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
			'../User/UserGetter': @UserGetter = {}
			"../Contacts/ContactManager": @ContactManager = {}
			"../../models/Project": Project: @Project = {}
			"../Project/ProjectEntityHandler": @ProjectEntityHandler = {}
			"./CollaboratorsEmailHandler": @CollaboratorsEmailHandler = {}

		@project_id = "mock-project-id"
		@user_id = "mock-user-id"
		@adding_user_id = "adding-user-id"
		@email = "joe@sharelatex.com"
		@callback = sinon.stub()
	
	describe "getMemberIdsWithPrivilegeLevels", ->
		beforeEach ->
			@Project.findOne = sinon.stub()
			@Project.findOne.withArgs({_id: @project_id}, {owner_ref: 1, collaberator_refs: 1, readOnly_refs: 1}).yields(null, @project = {
				owner_ref: [ "owner-ref" ]
				readOnly_refs: [ "read-only-ref-1", "read-only-ref-2" ]
				collaberator_refs: [ "read-write-ref-1", "read-write-ref-2" ]
			})
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels @project_id, @callback

		it "should return an array of member ids with their privilege levels", ->
			@callback
				.calledWith(null, [
					{ id: "owner-ref", privilegeLevel: "admin" }
					{ id: "read-only-ref-1", privilegeLevel: "readOnly" }
					{ id: "read-only-ref-2", privilegeLevel: "readOnly" }
					{ id: "read-write-ref-1", privilegeLevel: "readAndWrite" }
					{ id: "read-write-ref-2", privilegeLevel: "readAndWrite" }
				])
				.should.equal true
	
	describe "getMemberIds", ->
		beforeEach ->
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels
				.withArgs(@project_id)
				.yields(null, [{id: "member-id-1"}, {id: "member-id-2"}])
			@CollaboratorHandler.getMemberIds @project_id, @callback

		it "should return the ids", ->
			@callback
				.calledWith(null, ["member-id-1", "member-id-2"])
				.should.equal true
	
	describe "getMembersWithPrivilegeLevels", ->
		beforeEach ->
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels.withArgs(@project_id).yields(null, [
				{ id: "read-only-ref-1", privilegeLevel: "readOnly" }
				{ id: "read-only-ref-2", privilegeLevel: "readOnly" }
				{ id: "read-write-ref-1", privilegeLevel: "readAndWrite" }
				{ id: "read-write-ref-2", privilegeLevel: "readAndWrite" }
			])
			@UserGetter.getUser = sinon.stub()
			@UserGetter.getUser.withArgs("read-only-ref-1").yields(null, { _id: "read-only-ref-1" })
			@UserGetter.getUser.withArgs("read-only-ref-2").yields(null, { _id: "read-only-ref-2" })
			@UserGetter.getUser.withArgs("read-write-ref-1").yields(null, { _id: "read-write-ref-1" })
			@UserGetter.getUser.withArgs("read-write-ref-2").yields(null, { _id: "read-write-ref-2" })
			@CollaboratorHandler.getMembersWithPrivilegeLevels @project_id, @callback
		
		it "should return an array of members with their privilege levels", ->
			@callback
				.calledWith(undefined, [
					{ user: { _id: "read-only-ref-1" }, privilegeLevel: "readOnly" }
					{ user: { _id: "read-only-ref-2" }, privilegeLevel: "readOnly" }
					{ user: { _id: "read-write-ref-1" }, privilegeLevel: "readAndWrite" }
					{ user: { _id: "read-write-ref-2" }, privilegeLevel: "readAndWrite" }
				])
				.should.equal true
	
	describe "isUserMemberOfProject", ->
		beforeEach ->
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()

		describe "when user is a member of the project", ->
			beforeEach ->
				@CollaboratorHandler.getMemberIdsWithPrivilegeLevels.withArgs(@project_id).yields(null, [
					{ id: "not-the-user", privilegeLevel: "readOnly" }
					{ id: @user_id, privilegeLevel: "readAndWrite" }
				])
				@CollaboratorHandler.isUserMemberOfProject @user_id, @project_id, @callback
			
			it "should return true and the privilegeLevel", ->
				@callback
					.calledWith(null, true, "readAndWrite")
					.should.equal true

		describe "when user is not a member of the project", ->
			beforeEach ->
				@CollaboratorHandler.getMemberIdsWithPrivilegeLevels.withArgs(@project_id).yields(null, [
					{ id: "not-the-user", privilegeLevel: "readOnly" }
				])
				@CollaboratorHandler.isUserMemberOfProject @user_id, @project_id, @callback
			
			it "should return false", ->
				@callback
					.calledWith(null, false, null)
					.should.equal true
	
	describe "getProjectsUserIsCollaboratorOf", ->
		beforeEach ->
			@fields = "mock fields"
			@Project.find = sinon.stub()
			@Project.find.withArgs({collaberator_refs:@user_id}, @fields).yields(null, ["mock-read-write-project-1", "mock-read-write-project-2"])
			@Project.find.withArgs({readOnly_refs:@user_id}, @fields).yields(null, ["mock-read-only-project-1", "mock-read-only-project-2"])
			@CollaboratorHandler.getProjectsUserIsCollaboratorOf @user_id, @fields, @callback
		
		it "should call the callback with the projects", ->
			@callback
				.calledWith(null, ["mock-read-write-project-1", "mock-read-write-project-2"], ["mock-read-only-project-1", "mock-read-only-project-2"])
				.should.equal true

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
			@Project.findOne = sinon.stub().callsArgWith(2, null, @project = {})
			@ProjectEntityHandler.flushProjectToThirdPartyDataStore = sinon.stub().callsArg(1)
			@CollaboratorHandler.addEmailToProject = sinon.stub().callsArgWith(4, null, @user_id)
			@UserGetter.getUser = sinon.stub().callsArgWith(2, null, @user = { _id: @user_id, email: @email })
			@CollaboratorsEmailHandler.notifyUserOfProjectShare = sinon.stub()
			@ContactManager.addContact = sinon.stub()
			
		describe "as readOnly", ->
			beforeEach ->
				@CollaboratorHandler.addUserIdToProject @project_id, @adding_user_id, @user_id, "readOnly", @callback

			it "should add the user to the readOnly_refs", ->
				@Project.update
					.calledWith({
						_id: @project_id
					}, {
						"$addToSet":{ readOnly_refs: @user_id }
					})
					.should.equal true
			
			it "should flush the project to the TPDS", ->
				@ProjectEntityHandler.flushProjectToThirdPartyDataStore
					.calledWith(@project_id)
					.should.equal true

			it "should send an email to the shared-with user", ->
				@CollaboratorsEmailHandler.notifyUserOfProjectShare
					.calledWith(@project_id, @email)
					.should.equal true
			
			it "should add the user as a contact for the adding user", ->
				@ContactManager.addContact
					.calledWith(@adding_user_id, @user_id)
					.should.equal true
					
		describe "as readAndWrite", ->
			beforeEach ->
				@CollaboratorHandler.addUserIdToProject @project_id, @adding_user_id, @user_id, "readAndWrite", @callback

			it "should add the user to the collaberator_refs", ->
				@Project.update
					.calledWith({
						_id: @project_id
					}, {
						"$addToSet":{ collaberator_refs: @user_id }
					})
					.should.equal true
			
			it "should flush the project to the TPDS", ->
				@ProjectEntityHandler.flushProjectToThirdPartyDataStore
					.calledWith(@project_id)
					.should.equal true
		
		describe "with invalid privilegeLevel", ->
			beforeEach ->
				@CollaboratorHandler.addUserIdToProject @project_id, @adding_user_id, @user_id, "notValid", @callback

			it "should call the callback with an error", ->
				@callback.calledWith(new Error()).should.equal true
		
		describe "when user already exists as a collaborator", ->
			beforeEach ->
				@project.collaberator_refs = [@user_id]
				@CollaboratorHandler.addUserIdToProject @project_id, @adding_user_id, @user_id, "readAndWrite", @callback

			it "should not add the user again", ->
				@Project.update.called.should.equal false
	
	describe "addEmailToProject", ->
		beforeEach ->
			@UserCreator.getUserOrCreateHoldingAccount = sinon.stub().callsArgWith(1, null, @user = {_id: @user_id})
			@CollaboratorHandler.addUserIdToProject = sinon.stub().callsArg(4)

		describe "with a valid email", ->
			beforeEach ->
				@CollaboratorHandler.addEmailToProject @project_id, @adding_user_id, (@email = "Joe@example.com"), (@privilegeLevel = "readAndWrite"), @callback
			
			it "should get the user with the lowercased email", ->
				@UserCreator.getUserOrCreateHoldingAccount
					.calledWith(@email.toLowerCase())
					.should.equal true
		
			it "should add the user to the project by id", ->
				@CollaboratorHandler.addUserIdToProject
					.calledWith(@project_id, @adding_user_id, @user_id, @privilegeLevel)
					.should.equal true
			
			it "should return the callback with the user_id", ->
				@callback.calledWith(null, @user_id).should.equal true
		
		describe "with an invalid email", ->
			beforeEach ->
				@CollaboratorHandler.addEmailToProject @project_id, @adding_user_id, "not-and-email", (@privilegeLevel = "readAndWrite"), @callback
		
			it "should call the callback with an error", ->
				@callback.calledWith(new Error()).should.equal true
			
			it "should not add any users to the proejct", ->
				@CollaboratorHandler.addUserIdToProject.called.should.equal false




