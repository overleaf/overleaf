should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Collaborators/CollaboratorsHandler"
expect = require("chai").expect
Errors = require "../../../../app/js/Features/Errors/Errors.js"

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
			"../Errors/Errors": Errors
			"../Project/ProjectEditorHandler": @ProjectEditorHandler = {}

		@project_id = "mock-project-id"
		@user_id = "mock-user-id"
		@adding_user_id = "adding-user-id"
		@email = "joe@sharelatex.com"
		@callback = sinon.stub()

	describe "getMemberIdsWithPrivilegeLevels", ->
		describe "with project", ->
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
						{ id: "owner-ref", privilegeLevel: "owner" }
						{ id: "read-only-ref-1", privilegeLevel: "readOnly" }
						{ id: "read-only-ref-2", privilegeLevel: "readOnly" }
						{ id: "read-write-ref-1", privilegeLevel: "readAndWrite" }
						{ id: "read-write-ref-2", privilegeLevel: "readAndWrite" }
					])
					.should.equal true

		describe "with a missing project", ->
			beforeEach ->
				@Project.findOne = sinon.stub().yields(null, null)

			it "should return a NotFoundError", (done) ->
				@CollaboratorHandler.getMemberIdsWithPrivilegeLevels @project_id, (error) ->
					error.should.be.instanceof Errors.NotFoundError
					done()

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
				{ id: "doesnt-exist", privilegeLevel: "readAndWrite" }
			])
			@UserGetter.getUser = sinon.stub()
			@UserGetter.getUser.withArgs("read-only-ref-1").yields(null, { _id: "read-only-ref-1" })
			@UserGetter.getUser.withArgs("read-only-ref-2").yields(null, { _id: "read-only-ref-2" })
			@UserGetter.getUser.withArgs("read-write-ref-1").yields(null, { _id: "read-write-ref-1" })
			@UserGetter.getUser.withArgs("read-write-ref-2").yields(null, { _id: "read-write-ref-2" })
			@UserGetter.getUser.withArgs("doesnt-exist").yields(null, null)
			@CollaboratorHandler.getMembersWithPrivilegeLevels @project_id, @callback

		it "should return an array of members with their privilege levels", ->
			@callback
				.calledWith(null, [
					{ user: { _id: "read-only-ref-1" }, privilegeLevel: "readOnly" }
					{ user: { _id: "read-only-ref-2" }, privilegeLevel: "readOnly" }
					{ user: { _id: "read-write-ref-1" }, privilegeLevel: "readAndWrite" }
					{ user: { _id: "read-write-ref-2" }, privilegeLevel: "readAndWrite" }
				])
				.should.equal true

	describe "getMemberIdPrivilegeLevel", ->
		beforeEach ->
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels
				.withArgs(@project_id)
				.yields(null, [
					{id: "member-id-1", privilegeLevel: "readAndWrite"}
					{id: "member-id-2", privilegeLevel: "readOnly"}
				])

		it "should return the privilege level if it exists", (done) ->
			@CollaboratorHandler.getMemberIdPrivilegeLevel "member-id-2", @project_id, (error, level) ->
				expect(level).to.equal "readOnly"
				done()

		it "should return false if the member has no privilege level", (done) ->
			@CollaboratorHandler.getMemberIdPrivilegeLevel "member-id-3", @project_id, (error, level) ->
				expect(level).to.equal false
				done()

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

	describe "removeUserFromAllProjects", ->
		beforeEach (done) ->
			@CollaboratorHandler.getProjectsUserIsCollaboratorOf = sinon.stub()
			@CollaboratorHandler.getProjectsUserIsCollaboratorOf.withArgs(@user_id, { _id: 1 }).yields(
				null,
				[ { _id: "read-and-write-0" }, { _id: "read-and-write-1" }, null ],
				[ { _id: "read-only-0" }, { _id: "read-only-1" }, null ]
			)
			@CollaboratorHandler.removeUserFromProject = sinon.stub().yields()
			@CollaboratorHandler.removeUserFromAllProjets @user_id, done

		it "should remove the user from each project", ->
			for project_id in ["read-and-write-0", "read-and-write-1", "read-only-0", "read-only-1"]
				@CollaboratorHandler.removeUserFromProject
					.calledWith(project_id, @user_id)
					.should.equal true

	describe 'getAllMembers', ->

		beforeEach ->
			@owning_user = {_id: 'owner-id', email: 'owner@example.com', features: {a: 1}}
			@readwrite_user = {_id: 'readwrite-id', email: 'readwrite@example.com'}
			@members = [
				{user: @owning_user,    privilegeLevel: "owner"},
				{user: @readwrite_user, privilegeLevel: "readAndWrite"}
			]
			@CollaboratorHandler.getMembersWithPrivilegeLevels = sinon.stub().callsArgWith(1, null, @members)
			@ProjectEditorHandler.buildOwnerAndMembersViews = sinon.stub().returns(@views = {
				owner: @owning_user,
				ownerFeatures: @owning_user.features,
				members: [ {_id: @readwrite_user._id, email: @readwrite_user.email} ]
			})
			@callback = sinon.stub()
			@CollaboratorHandler.getAllMembers @project_id, @callback

		it 'should not produce an error', ->
			@callback.callCount.should.equal 1
			expect(@callback.firstCall.args[0]).to.equal null

		it 'should produce a list of members', ->
			@callback.callCount.should.equal 1
			expect(@callback.firstCall.args[1]).to.deep.equal @views.members

		it 'should call getMembersWithPrivileges', ->
			@CollaboratorHandler.getMembersWithPrivilegeLevels.callCount.should.equal 1
			@CollaboratorHandler.getMembersWithPrivilegeLevels.firstCall.args[0].should.equal @project_id

		it 'should call ProjectEditorHandler.buildOwnerAndMembersViews', ->
			@ProjectEditorHandler.buildOwnerAndMembersViews.callCount.should.equal 1
			@ProjectEditorHandler.buildOwnerAndMembersViews.firstCall.args[0].should.equal @members

		describe 'when getMembersWithPrivileges produces an error', ->

			beforeEach ->
				@CollaboratorHandler.getMembersWithPrivilegeLevels = sinon.stub().callsArgWith(1, new Error('woops'))
				@ProjectEditorHandler.buildOwnerAndMembersViews = sinon.stub().returns(@views = {
					owner: @owning_user,
					ownerFeatures: @owning_user.features,
					members: [ {_id: @readwrite_user._id, email: @readwrite_user.email} ]
				})
				@callback = sinon.stub()
				@CollaboratorHandler.getAllMembers @project_id, @callback

			it 'should produce an error', ->
				@callback.callCount.should.equal 1
				expect(@callback.firstCall.args[0]).to.not.equal null
				expect(@callback.firstCall.args[0]).to.be.instanceof Error

			it 'should call getMembersWithPrivileges', ->
				@CollaboratorHandler.getMembersWithPrivilegeLevels.callCount.should.equal 1
				@CollaboratorHandler.getMembersWithPrivilegeLevels.firstCall.args[0].should.equal @project_id

			it 'should not call ProjectEditorHandler.buildOwnerAndMembersViews', ->
				@ProjectEditorHandler.buildOwnerAndMembersViews.callCount.should.equal 0
