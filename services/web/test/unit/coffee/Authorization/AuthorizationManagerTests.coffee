sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Authorization/AuthorizationManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Features/Errors/Errors.js"

describe "AuthorizationManager", ->
	beforeEach ->
		@AuthorizationManager = SandboxedModule.require modulePath, requires:
			"../Collaborators/CollaboratorsHandler": @CollaboratorsHandler = {}
			'../Project/ProjectGetter': @ProjectGetter = {}
			"../../models/User": User: @User = {}
			"../Errors/Errors": Errors
			"../TokenAccess/TokenAccessHandler": @TokenAccessHandler = {
				isValidToken: sinon.stub().callsArgWith(2, null, false, false)
			}
		@user_id = "user-id-1"
		@project_id = "project-id-1"
		@token = 'some-token'
		@callback = sinon.stub()

	describe "getPrivilegeLevelForProject", ->
		beforeEach ->
			@ProjectGetter.getProject = sinon.stub()
			@AuthorizationManager.isUserSiteAdmin = sinon.stub()
			@CollaboratorsHandler.getMemberIdPrivilegeLevel = sinon.stub()

		describe 'with a token-based project', ->
			beforeEach ->
				@ProjectGetter.getProject
					.withArgs(@project_id, { publicAccesLevel: 1 })
					.yields(null, { publicAccesLevel: "tokenBased" })

			describe "with a user_id with a privilege level", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, false)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, "readOnly")
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @token, @callback

				it "should return the user's privilege level", ->
					@callback.calledWith(null, "readOnly", false).should.equal true

			describe "with a user_id with no privilege level", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, false)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, false)
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @token, @callback

				it "should return false", ->
					@callback.calledWith(null, false, false).should.equal true

			describe "with a user_id who is an admin", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, true)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, false)
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @token, @callback

				it "should return the user as an owner", ->
					@callback.calledWith(null, "owner", false).should.equal true

			describe "with no user (anonymous)", ->

				describe 'when the token is not valid', ->

					beforeEach ->
						@TokenAccessHandler.isValidToken = sinon.stub()
							.withArgs(@project_id, @token)
							.yields(null, false, false)
						@AuthorizationManager.getPrivilegeLevelForProject null, @project_id, @token, @callback

					it "should not call CollaboratorsHandler.getMemberIdPrivilegeLevel", ->
						@CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal false

					it "should not call AuthorizationManager.isUserSiteAdmin", ->
						@AuthorizationManager.isUserSiteAdmin.called.should.equal false

					it 'should check if the token is valid', ->
						@TokenAccessHandler.isValidToken.calledWith(@project_id, @token).should.equal true

					it "should return false", ->
						@callback.calledWith(null, false, false).should.equal true

				describe 'when the token is valid for read-and-write', ->

					describe 'when read-write-sharing is not enabled', ->
						beforeEach ->
							@TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = false
							@TokenAccessHandler.isValidToken = sinon.stub()
								.withArgs(@project_id, @token)
								.yields(null, true, false)
							@AuthorizationManager.getPrivilegeLevelForProject null, @project_id, @token, @callback

						it "should not call CollaboratorsHandler.getMemberIdPrivilegeLevel", ->
							@CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal false

						it "should not call AuthorizationManager.isUserSiteAdmin", ->
							@AuthorizationManager.isUserSiteAdmin.called.should.equal false

						it 'should check if the token is valid', ->
							@TokenAccessHandler.isValidToken.calledWith(@project_id, @token).should.equal true

						it "should deny access", ->
							@callback.calledWith(null, false, false).should.equal true

					describe 'when read-write-sharing is enabled', ->
						beforeEach ->
							@TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = true
							@TokenAccessHandler.isValidToken = sinon.stub()
								.withArgs(@project_id, @token)
								.yields(null, true, false)
							@AuthorizationManager.getPrivilegeLevelForProject null, @project_id, @token, @callback

						it "should not call CollaboratorsHandler.getMemberIdPrivilegeLevel", ->
							@CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal false

						it "should not call AuthorizationManager.isUserSiteAdmin", ->
							@AuthorizationManager.isUserSiteAdmin.called.should.equal false

						it 'should check if the token is valid', ->
							@TokenAccessHandler.isValidToken.calledWith(@project_id, @token).should.equal true

						it "should give read-write access", ->
							@callback.calledWith(null, "readAndWrite", false).should.equal true

				describe 'when the token is valid for read-only', ->

					beforeEach ->
						@TokenAccessHandler.isValidToken = sinon.stub()
							.withArgs(@project_id, @token)
							.yields(null, false, true)
						@AuthorizationManager.getPrivilegeLevelForProject null, @project_id, @token, @callback

					it "should not call CollaboratorsHandler.getMemberIdPrivilegeLevel", ->
						@CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal false

					it "should not call AuthorizationManager.isUserSiteAdmin", ->
						@AuthorizationManager.isUserSiteAdmin.called.should.equal false

					it 'should check if the token is valid', ->
						@TokenAccessHandler.isValidToken.calledWith(@project_id, @token).should.equal true

					it "should give read-only access", ->
						@callback.calledWith(null, "readOnly", false).should.equal true

		describe "with a private project", ->
			beforeEach ->
				@ProjectGetter.getProject
					.withArgs(@project_id, { publicAccesLevel: 1 })
					.yields(null, { publicAccesLevel: "private" })

			describe "with a user_id with a privilege level", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, false)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, "readOnly")
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @token, @callback

				it "should return the user's privilege level", ->
					@callback.calledWith(null, "readOnly", false).should.equal true

			describe "with a user_id with no privilege level", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, false)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, false)
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @token, @callback

				it "should return false", ->
					@callback.calledWith(null, false, false).should.equal true

			describe "with a user_id who is an admin", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, true)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, false)
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @token, @callback

				it "should return the user as an owner", ->
					@callback.calledWith(null, "owner", false).should.equal true

			describe "with no user (anonymous)", ->
				beforeEach ->
					@AuthorizationManager.getPrivilegeLevelForProject null, @project_id, @token, @callback

				it "should not call CollaboratorsHandler.getMemberIdPrivilegeLevel", ->
					@CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal false

				it "should not call AuthorizationManager.isUserSiteAdmin", ->
					@AuthorizationManager.isUserSiteAdmin.called.should.equal false

				it "should return false", ->
					@callback.calledWith(null, false, false).should.equal true

		describe "with a public project", ->
			beforeEach ->
				@ProjectGetter.getProject
					.withArgs(@project_id, { publicAccesLevel: 1 })
					.yields(null, { publicAccesLevel: "readAndWrite" })

			describe "with a user_id with a privilege level", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, false)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, "readOnly")
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @token, @callback

				it "should return the user's privilege level", ->
					@callback.calledWith(null, "readOnly", false).should.equal true

			describe "with a user_id with no privilege level", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, false)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, false)
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @token, @callback

				it "should return the public privilege level", ->
					@callback.calledWith(null, "readAndWrite", true).should.equal true

			describe "with a user_id who is an admin", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, true)
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, false)
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @token, @callback

				it "should return the user as an owner", ->
					@callback.calledWith(null, "owner", false).should.equal true

			describe "with no user (anonymous)", ->
				beforeEach ->
					@AuthorizationManager.getPrivilegeLevelForProject null, @project_id, @token, @callback

				it "should not call CollaboratorsHandler.getMemberIdPrivilegeLevel", ->
					@CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal false

				it "should not call AuthorizationManager.isUserSiteAdmin", ->
					@AuthorizationManager.isUserSiteAdmin.called.should.equal false

				it "should return the public privilege level", ->
					@callback.calledWith(null, "readAndWrite", true).should.equal true

		describe "when the project doesn't exist", ->
			beforeEach ->
				@ProjectGetter.getProject
					.withArgs(@project_id, { publicAccesLevel: 1 })
					.yields(null, null)

			it "should return a NotFoundError", ->
				@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @token, (error) ->
					error.should.be.instanceof Errors.NotFoundError

		describe "when the project id is not valid", ->
			beforeEach ->
				@AuthorizationManager.isUserSiteAdmin.withArgs(@user_id).yields(null, false)
				@CollaboratorsHandler.getMemberIdPrivilegeLevel
					.withArgs(@user_id, @project_id)
					.yields(null, "readOnly")

			it "should return a error", (done)->
				@AuthorizationManager.getPrivilegeLevelForProject undefined, "not project id", @token, (err) =>
					@ProjectGetter.getProject.called.should.equal false
					expect(err).to.exist
					done()

	describe "canUserReadProject", ->
		beforeEach ->
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub()

		describe "when user is owner", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "owner", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserReadProject @user_id, @project_id, @token, (error, canRead) ->
					expect(canRead).to.equal true
					done()

		describe "when user has read-write access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "readAndWrite", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserReadProject @user_id, @project_id, @token, (error, canRead) ->
					expect(canRead).to.equal true
					done()

		describe "when user has read-only access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "readOnly", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserReadProject @user_id, @project_id, @token, (error, canRead) ->
					expect(canRead).to.equal true
					done()

		describe "when user has no access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, false, false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserReadProject @user_id, @project_id, @token, (error, canRead) ->
					expect(canRead).to.equal false
					done()

	describe "canUserWriteProjectContent", ->
		beforeEach ->
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub()

		describe "when user is owner", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "owner", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserWriteProjectContent @user_id, @project_id, @token, (error, canWrite) ->
					expect(canWrite).to.equal true
					done()

		describe "when user has read-write access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "readAndWrite", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserWriteProjectContent @user_id, @project_id, @token, (error, canWrite) ->
					expect(canWrite).to.equal true
					done()

		describe "when user has read-only access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "readOnly", false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectContent @user_id, @project_id, @token, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()

		describe "when user has no access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, false, false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectContent @user_id, @project_id, @token, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()

	describe "canUserWriteProjectSettings", ->
		beforeEach ->
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub()

		describe "when user is owner", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "owner", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @user_id, @project_id, @token, (error, canWrite) ->
					expect(canWrite).to.equal true
					done()

		describe "when user has read-write access as a collaborator", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "readAndWrite", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @user_id, @project_id, @token, (error, canWrite) ->
					expect(canWrite).to.equal true
					done()

		describe "when user has read-write access as the public", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "readAndWrite", true)

			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @user_id, @project_id, @token, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()

		describe "when user has read-only access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "readOnly", false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @user_id, @project_id, @token, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()

		describe "when user has no access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, false, false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @user_id, @project_id, @token, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()

	describe "canUserAdminProject", ->
		beforeEach ->
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub()

		describe "when user is owner", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "owner", false)

			it "should return true", (done) ->
				@AuthorizationManager.canUserAdminProject @user_id, @project_id, @token, (error, canAdmin) ->
					expect(canAdmin).to.equal true
					done()

		describe "when user has read-write access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "readAndWrite", false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserAdminProject @user_id, @project_id, @token, (error, canAdmin) ->
					expect(canAdmin).to.equal false
					done()

		describe "when user has read-only access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, "readOnly", false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserAdminProject @user_id, @project_id, @token, (error, canAdmin) ->
					expect(canAdmin).to.equal false
					done()

		describe "when user has no access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id, @token)
					.yields(null, false, false)

			it "should return false", (done) ->
				@AuthorizationManager.canUserAdminProject @user_id, @project_id, @token, (error, canAdmin) ->
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
