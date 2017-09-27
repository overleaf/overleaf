sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Authorization/AuthorizationManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Features/Errors/Errors.js"
MockRequest = require '../helpers/MockRequest'

describe "AuthorizationManager", ->
	beforeEach ->
		@AuthorizationManager = SandboxedModule.require modulePath, requires:
			"../Collaborators/CollaboratorsHandler": @CollaboratorsHandler = {}
			"../../models/Project": Project: @Project = {}
			"../../models/User": User: @User = {}
			"../Errors/Errors": Errors
			"../TokenAccess/TokenAccessHandler": @TokenAccessHandler = {
				requestHasReadOnlyTokenAccess: sinon.stub().callsArgWith(2, null, false)
			}
		@user_id = "user-id-1"
		@project_id = "project-id-1"
		@callback = sinon.stub()

	describe "getPrivilegeLevelForProject", ->
		beforeEach ->
			@Project.findOne = sinon.stub()
			@AuthorizationManager.isUserSiteAdmin = sinon.stub()
			@CollaboratorsHandler.getMemberIdPrivilegeLevel = sinon.stub()

		describe "with a private project", ->
			beforeEach ->
				@req = new MockRequest()
				@Project.findOne
					.withArgs({ _id: @project_id }, { publicAccesLevel: 1 })
					.yields(null, { publicAccesLevel: "private" })

			describe "with a user_id with a privilege level", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, false)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, "readOnly")
					@AuthorizationManager.getPrivilegeLevelForProject @req, @user_id, @project_id, @callback

				it "should return the user's privilege level", ->
					@callback.calledWith(null, "readOnly", false).should.equal true

			describe "with a user_id with no privilege level", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, false)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, false)
					@AuthorizationManager.getPrivilegeLevelForProject @req, @user_id, @project_id, @callback

				it "should return false", ->
					@callback.calledWith(null, false, false).should.equal true

			describe "with a user_id who is an admin", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, true)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, false)
					@AuthorizationManager.getPrivilegeLevelForProject @req, @user_id, @project_id, @callback

				it "should return the user as an owner", ->
					@callback.calledWith(null, "owner", false).should.equal true

			describe "with no user (anonymous)", ->
				beforeEach ->
					@AuthorizationManager.getPrivilegeLevelForProject @req, null, @project_id, @callback

				it "should not call CollaboratorsHandler.getMemberIdPrivilegeLevel", ->
					@CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal false

				it "should not call AuthorizationManager.isUserSiteAdmin", ->
					@AuthorizationManager.isUserSiteAdmin.called.should.equal false

				it "should return false", ->
					@callback.calledWith(null, false, false).should.equal true

		describe "with a public project", ->
			beforeEach ->
				@Project.findOne
					.withArgs({ _id: @project_id }, { publicAccesLevel: 1 })
					.yields(null, { publicAccesLevel: "readAndWrite" })

			describe "with a user_id with a privilege level", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, false)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, "readOnly")
					@AuthorizationManager.getPrivilegeLevelForProject @req, @user_id, @project_id, @callback

				it "should return the user's privilege level", ->
					@callback.calledWith(null, "readOnly", false).should.equal true

			describe "with a user_id with no privilege level", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, false)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, false)
					@AuthorizationManager.getPrivilegeLevelForProject @req, @user_id, @project_id, @callback

				it "should return the public privilege level", ->
					@callback.calledWith(null, "readAndWrite", true).should.equal true

			describe "with a user_id who is an admin", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, true)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, false)
					@AuthorizationManager.getPrivilegeLevelForProject @req, @user_id, @project_id, @callback

				it "should return the user as an owner", ->
					@callback.calledWith(null, "owner", false).should.equal true

			describe "with no user (anonymous)", ->
				beforeEach ->
					@AuthorizationManager.getPrivilegeLevelForProject @req, null, @project_id, @callback

				it "should not call CollaboratorsHandler.getMemberIdPrivilegeLevel", ->
					@CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal false

				it "should not call AuthorizationManager.isUserSiteAdmin", ->
					@AuthorizationManager.isUserSiteAdmin.called.should.equal false

				it "should return the public privilege level", ->
					@callback.calledWith(null, "readAndWrite", true).should.equal true

		describe "when the project doesn't exist", ->
			beforeEach ->
				@Project.findOne
					.withArgs({ _id: @project_id }, { publicAccesLevel: 1 })
					.yields(null, null)

			it "should return a NotFoundError", ->
				@AuthorizationManager.getPrivilegeLevelForProject @req, @user_id, @project_id, (error) ->
					error.should.be.instanceof Errors.NotFoundError

		describe "when the project id is not valid", ->
			beforeEach ->
				@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, false)
				@CollaboratorsHandler.getMemberIdPrivilegeLevel
					.withArgs(@user_id, @project_id)
					.yields(null, "readOnly")

			it "should return a error", (done)->
				@AuthorizationManager.getPrivilegeLevelForProject @req, undefined, "not project id", (err) =>
					@Project.findOne.called.should.equal false
					expect(err).to.exist
					done()

	describe "canUserReadProject", ->
		beforeEach ->
			@req = new MockRequest()
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub()

		describe "when user is owner", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "owner", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserReadProject @req, @user_id, @project_id, (error, canRead) ->
					expect(canRead).to.equal true
					done()

		describe "when user has read-write access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "readAndWrite", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserReadProject @req, @user_id, @project_id, (error, canRead) ->
					expect(canRead).to.equal true
					done()

		describe "when user has read-only access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "readOnly", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserReadProject @req, @user_id, @project_id, (error, canRead) ->
					expect(canRead).to.equal true
					done()

		describe "when user has no access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, false, false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserReadProject @req, @user_id, @project_id, (error, canRead) ->
					expect(canRead).to.equal false
					done()

	describe "canUserWriteProjectContent", ->
		beforeEach ->
			@req = new MockRequest()
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub()

		describe "when user is owner", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "owner", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserWriteProjectContent @req, @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal true
					done()

		describe "when user has read-write access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "readAndWrite", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserWriteProjectContent @req, @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal true
					done()

		describe "when user has read-only access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "readOnly", false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectContent @req, @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()

		describe "when user has no access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, false, false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectContent @req, @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()

	describe "canUserWriteProjectSettings", ->
		beforeEach ->
			@req = new MockRequest()
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub()

		describe "when user is owner", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "owner", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @req, @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal true
					done()

		describe "when user has read-write access as a collaborator", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "readAndWrite", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @req, @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal true
					done()

		describe "when user has read-write access as the public", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "readAndWrite", true)

			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @req, @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()

		describe "when user has read-only access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "readOnly", false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @req, @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()

		describe "when user has no access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, false, false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @req, @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()

	describe "canUserAdminProject", ->
		beforeEach ->
			@req = new MockRequest()
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub()

		describe "when user is owner", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "owner", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserAdminProject @req, @user_id, @project_id, (error, canAdmin) ->
					expect(canAdmin).to.equal true
					done()

		describe "when user has read-write access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "readAndWrite", false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserAdminProject @req, @user_id, @project_id, (error, canAdmin) ->
					expect(canAdmin).to.equal false
					done()

		describe "when user has read-only access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, "readOnly", false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserAdminProject @req, @user_id, @project_id, (error, canAdmin) ->
					expect(canAdmin).to.equal false
					done()

		describe "when user has no access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@req, @user_id, @project_id)
					.yields(null, false, false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserAdminProject @req, @user_id, @project_id, (error, canAdmin) ->
					expect(canAdmin).to.equal false
					done()

	describe "isUserSiteAdmin", ->
		beforeEach ->
			@User.findOne = sinon.stub()

		describe "when user is admin", ->
			beforeEach ->
				@User.findOne
					.withArgs({ _id: @user_id }, { isAdmin: 1 })
					.yields(null, { isAdmin: true })

			it "should return true", (done) ->
				@AuthorizationManager.isUserSiteAdmin @user_id, (error, isAdmin) ->
					expect(isAdmin).to.equal true
					done()

		describe "when user is not admin", ->
			beforeEach ->
				@User.findOne
					.withArgs({ _id: @user_id }, { isAdmin: 1 })
					.yields(null, { isAdmin: false })

			it "should return false", (done) ->
				@AuthorizationManager.isUserSiteAdmin @user_id, (error, isAdmin) ->
					expect(isAdmin).to.equal false
					done()

		describe "when user is not found", ->
			beforeEach ->
				@User.findOne
					.withArgs({ _id: @user_id }, { isAdmin: 1 })
					.yields(null, null)

			it "should return false", (done) ->
				@AuthorizationManager.isUserSiteAdmin @user_id, (error, isAdmin) ->
					expect(isAdmin).to.equal false
					done()

		describe "when no user is passed", ->
			it "should return false", (done) ->
				@AuthorizationManager.isUserSiteAdmin null, (error, isAdmin) =>
					@User.findOne.called.should.equal false
					expect(isAdmin).to.equal false
					done()
