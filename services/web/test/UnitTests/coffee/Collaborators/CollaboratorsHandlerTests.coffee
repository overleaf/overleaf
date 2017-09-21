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
				@Project.findOne.withArgs(
					{_id: @project_id},
					{owner_ref: 1, collaberator_refs: 1, readOnly_refs: 1, tokenAccessReadOnly_refs: 1, tokenAccessReadAndWrite_refs: 1}
				).yields(null, @project = {
					owner_ref: [ "owner-ref" ]
					readOnly_refs: [ "read-only-ref-1", "read-only-ref-2" ]
					collaberator_refs: [ "read-write-ref-1", "read-write-ref-2" ]
				})
				@CollaboratorHandler.getMemberIdsWithPrivilegeLevels @project_id, @callback

			it "should return an array of member ids with their privilege levels", ->
				@callback
					.calledWith(null, [
						{ id: "owner-ref", privilegeLevel: "owner", source: 'owner'}
						{ id: "read-only-ref-1", privilegeLevel: "readOnly", source: 'invite'}
						{ id: "read-only-ref-2", privilegeLevel: "readOnly", source: 'invite'}
						{ id: "read-write-ref-1", privilegeLevel: "readAndWrite", source: 'invite'}
						{ id: "read-write-ref-2", privilegeLevel: "readAndWrite", source: 'invite' }
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
				.yields(null, [{id: "member-id-1", source: 'invite'}, {id: "member-id-2", source: 'token'}])
			@CollaboratorHandler.getMemberIds @project_id, @callback

		it "should return the ids", ->
			@callback
				.calledWith(null, ["member-id-1", "member-id-2"])
				.should.equal true

	describe "getInvitedMemberIds", ->
		beforeEach ->
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels
				.withArgs(@project_id)
				.yields(null, [{id: "member-id-1", source: 'invite'}, {id: "member-id-2", source: 'token'}])
			@CollaboratorHandler.getInvitedMemberIds @project_id, @callback

		it "should return the invited ids", ->
			@callback
				.calledWith(null, ["member-id-1"])
				.should.equal true

	describe "getMembersWithPrivilegeLevels", ->
		beforeEach ->
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels.withArgs(@project_id).yields(null, [
				{ id: "read-only-ref-1", privilegeLevel: "readOnly", source: 'token' }
				{ id: "read-only-ref-2", privilegeLevel: "readOnly", source: 'invite' }
				{ id: "read-write-ref-1", privilegeLevel: "readAndWrite", source: 'token' }
				{ id: "read-write-ref-2", privilegeLevel: "readAndWrite", source: 'invite' }
				{ id: "doesnt-exist", privilegeLevel: "readAndWrite", source: 'invite' }
			])
			@UserGetter.getUserById = sinon.stub()
			@UserGetter.getUserById.withArgs("read-only-ref-1").yields(null, { _id: "read-only-ref-1" })
			@UserGetter.getUserById.withArgs("read-only-ref-2").yields(null, { _id: "read-only-ref-2" })
			@UserGetter.getUserById.withArgs("read-write-ref-1").yields(null, { _id: "read-write-ref-1" })
			@UserGetter.getUserById.withArgs("read-write-ref-2").yields(null, { _id: "read-write-ref-2" })
			@UserGetter.getUserById.withArgs("doesnt-exist").yields(null, null)
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

	describe "getInvitedMembersWithPrivilegeLevels", ->
		beforeEach ->
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels.withArgs(@project_id).yields(null, [
				{ id: "read-only-ref-1", privilegeLevel: "readOnly", source: 'token' }
				{ id: "read-only-ref-2", privilegeLevel: "readOnly", source: 'invite' }
				{ id: "read-write-ref-1", privilegeLevel: "readAndWrite", source: 'token' }
				{ id: "read-write-ref-2", privilegeLevel: "readAndWrite", source: 'invite' }
				{ id: "doesnt-exist", privilegeLevel: "readAndWrite", source: 'invite' }
			])
			@UserGetter.getUserById = sinon.stub()
			@UserGetter.getUserById.withArgs("read-only-ref-1").yields(null, { _id: "read-only-ref-1" })
			@UserGetter.getUserById.withArgs("read-only-ref-2").yields(null, { _id: "read-only-ref-2" })
			@UserGetter.getUserById.withArgs("read-write-ref-1").yields(null, { _id: "read-write-ref-1" })
			@UserGetter.getUserById.withArgs("read-write-ref-2").yields(null, { _id: "read-write-ref-2" })
			@UserGetter.getUserById.withArgs("doesnt-exist").yields(null, null)
			@CollaboratorHandler.getInvitedMembersWithPrivilegeLevels @project_id, @callback

		it "should return an array of invited members with their privilege levels", ->
			@callback
				.calledWith(null, [
					{ user: { _id: "read-only-ref-2" }, privilegeLevel: "readOnly" }
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

	describe "isUserInvitedMemberOfProject", ->
		beforeEach ->
			@CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()

		describe "when user is a member of the project", ->
			beforeEach ->
				@CollaboratorHandler.getMemberIdsWithPrivilegeLevels.withArgs(@project_id).yields(null, [
					{ id: "not-the-user", privilegeLevel: "readOnly", source: 'invite' }
					{ id: @user_id, privilegeLevel: "readAndWrite", source: 'invite' }
				])
				@CollaboratorHandler.isUserInvitedMemberOfProject @user_id, @project_id, @callback

			it "should return true and the privilegeLevel", ->
				@callback
					.calledWith(null, true, "readAndWrite")
					.should.equal true

		describe "when user is not a member of the project", ->
			beforeEach ->
				@CollaboratorHandler.getMemberIdsWithPrivilegeLevels.withArgs(@project_id).yields(null, [
					{ id: "not-the-user", privilegeLevel: "readOnly" }
				])
				@CollaboratorHandler.isUserInvitedMemberOfProject @user_id, @project_id, @callback

			it "should return false", ->
				@callback
					.calledWith(null, false, null)
					.should.equal true

	describe "getProjectsUserIsMemberOf", ->
		beforeEach ->
			@fields = "mock fields"
			@Project.find = sinon.stub()
			@Project.find.withArgs({collaberator_refs:@user_id}, @fields).yields(null, ["mock-read-write-project-1", "mock-read-write-project-2"])
			@Project.find.withArgs({readOnly_refs:@user_id}, @fields).yields(null, ["mock-read-only-project-1", "mock-read-only-project-2"])
			@Project.find.withArgs({tokenAccessReadAndWrite_refs:@user_id}, @fields).yields(null, ["mock-token-read-write-project-1", "mock-token-read-write-project-2"])
			@Project.find.withArgs({tokenAccessReadOnly_refs:@user_id}, @fields).yields(null, ["mock-token-read-only-project-1", "mock-token-read-only-project-2"])
			@CollaboratorHandler.getProjectsUserIsMemberOf @user_id, @fields, @callback

		it "should call the callback with the projects", ->
			@callback
				.calledWith(
					null,
					{
						readAndWrite:      ["mock-read-write-project-1", "mock-read-write-project-2"],
						readOnly:          ["mock-read-only-project-1", "mock-read-only-project-2"],
						tokenReadAndWrite: ["mock-token-read-write-project-1", "mock-token-read-write-project-2"],
						tokenReadOnly:     ["mock-token-read-only-project-1", "mock-token-read-only-project-2"]
					}
				)
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

	describe "removeUserFromAllProjects", ->
		beforeEach (done) ->
			@CollaboratorHandler.getProjectsUserIsMemberOf = sinon.stub()
			@CollaboratorHandler.getProjectsUserIsMemberOf.withArgs(@user_id, { _id: 1 }).yields(
				null,
				{
					readAndWrite:      [ { _id: "read-and-write-0" }, { _id: "read-and-write-1" }, null ],
					readOnly:          [ { _id: "read-only-0" }, { _id: "read-only-1" }, null ]
					tokenReadAndWrite: [ { _id: "token-read-and-write-0" }, { _id: "token-read-and-write-1" }, null ]
					tokenReadOnly:     [ { _id: "token-read-only-0" }, { _id: "token-read-only-1" }, null ]
				}
			)
			@CollaboratorHandler.removeUserFromProject = sinon.stub().yields()
			@CollaboratorHandler.removeUserFromAllProjets @user_id, done

		it "should remove the user from each project", ->
			expectedProjects = [
				"read-and-write-0", "read-and-write-1",
				"read-only-0", "read-only-1",
				"token-read-and-write-0", "token-read-and-write-1",
				"token-read-only-0", "token-read-only-1",
			]
			for project_id in expectedProjects
				@CollaboratorHandler.removeUserFromProject
					.calledWith(project_id, @user_id)
					.should.equal true

	describe 'getAllInvitedMembers', ->

		beforeEach ->
			@owning_user = {_id: 'owner-id', email: 'owner@example.com', features: {a: 1}}
			@readwrite_user = {_id: 'readwrite-id', email: 'readwrite@example.com'}
			@members = [
				{user: @owning_user,    privilegeLevel: "owner"},
				{user: @readwrite_user, privilegeLevel: "readAndWrite"}
			]
			@CollaboratorHandler.getInvitedMembersWithPrivilegeLevels = sinon.stub().callsArgWith(1, null, @members)
			@ProjectEditorHandler.buildOwnerAndMembersViews = sinon.stub().returns(@views = {
				owner: @owning_user,
				ownerFeatures: @owning_user.features,
				members: [ {_id: @readwrite_user._id, email: @readwrite_user.email} ]
			})
			@callback = sinon.stub()
			@CollaboratorHandler.getAllInvitedMembers @project_id, @callback

		it 'should not produce an error', ->
			@callback.callCount.should.equal 1
			expect(@callback.firstCall.args[0]).to.equal null

		it 'should produce a list of members', ->
			@callback.callCount.should.equal 1
			expect(@callback.firstCall.args[1]).to.deep.equal @views.members

		it 'should call getMembersWithPrivileges', ->
			@CollaboratorHandler.getInvitedMembersWithPrivilegeLevels.callCount.should.equal 1
			@CollaboratorHandler.getInvitedMembersWithPrivilegeLevels.firstCall.args[0].should.equal @project_id

		it 'should call ProjectEditorHandler.buildOwnerAndMembersViews', ->
			@ProjectEditorHandler.buildOwnerAndMembersViews.callCount.should.equal 1
			@ProjectEditorHandler.buildOwnerAndMembersViews.firstCall.args[0].should.equal @members

		describe 'when getMembersWithPrivileges produces an error', ->

			beforeEach ->
				@CollaboratorHandler.getInvitedMembersWithPrivilegeLevels = sinon.stub().callsArgWith(1, new Error('woops'))
				@ProjectEditorHandler.buildOwnerAndMembersViews = sinon.stub().returns(@views = {
					owner: @owning_user,
					ownerFeatures: @owning_user.features,
					members: [ {_id: @readwrite_user._id, email: @readwrite_user.email} ]
				})
				@callback = sinon.stub()
				@CollaboratorHandler.getAllInvitedMembers @project_id, @callback

			it 'should produce an error', ->
				@callback.callCount.should.equal 1
				expect(@callback.firstCall.args[0]).to.not.equal null
				expect(@callback.firstCall.args[0]).to.be.instanceof Error

			it 'should call getMembersWithPrivileges', ->
				@CollaboratorHandler.getInvitedMembersWithPrivilegeLevels.callCount.should.equal 1
				@CollaboratorHandler.getInvitedMembersWithPrivilegeLevels.firstCall.args[0].should.equal @project_id

			it 'should not call ProjectEditorHandler.buildOwnerAndMembersViews', ->
				@ProjectEditorHandler.buildOwnerAndMembersViews.callCount.should.equal 0
