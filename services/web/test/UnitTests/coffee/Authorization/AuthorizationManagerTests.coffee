sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Authorization/AuthorizationManager.js"
SandboxedModule = require('sandboxed-module')

describe "AuthorizationManager", ->
	beforeEach ->
		@AuthorizationManager = SandboxedModule.require modulePath, requires:
			"../Collaborators/CollaboratorsHandler": @CollaboratorsHandler = {}
			"../../models/Project": Project: @Project = {}
			"../../models/User": User: @User = {}
		@user_id = "user-id-1"
		@project_id = "project-id-1"
		@callback = sinon.stub()

	describe "getPrivilegeLevelForProject", ->
		beforeEach ->
			@Project.findOne = sinon.stub()
			@CollaboratorsHandler.getMemberIdPrivilegeLevel = sinon.stub()

		describe "with a private project", ->
			beforeEach ->
				@Project.findOne
					.withArgs({ _id: @project_id }, { publicAccesLevel: 1 })
					.yields(null, { publicAccesLevel: "private" })
			
			describe "with a user_id with a privilege level", ->
				beforeEach ->
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, "readOnly")
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @callback
				
				it "should return the user's privilege level", ->
					@callback.calledWith(null, "readOnly", false).should.equal true
			
			describe "with a user_id with no privilege level", ->
				beforeEach ->
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, false)
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @callback
				
				it "should return false", ->
					@callback.calledWith(null, false, false).should.equal true
			
			describe "with no user (anonymous)", ->
				beforeEach ->
					@AuthorizationManager.getPrivilegeLevelForProject null, @project_id, @callback
				
				it "should not call CollaboratorsHandler.getMemberIdPrivilegeLevel", ->
					@CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal false
				
				it "should return false", ->
					@callback.calledWith(null, false, false).should.equal true

		describe "with a public project", ->
			beforeEach ->
				@Project.findOne
					.withArgs({ _id: @project_id }, { publicAccesLevel: 1 })
					.yields(null, { publicAccesLevel: "readAndWrite" })
			
			describe "with a user_id with a privilege level", ->
				beforeEach ->
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, "readOnly")
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @callback
				
				it "should return the user's privilege level", ->
					@callback.calledWith(null, "readOnly", false).should.equal true
			
			describe "with a user_id with no privilege level", ->
				beforeEach ->
					@CollaboratorsHandler.getMemberIdPrivilegeLevel
						.withArgs(@user_id, @project_id)
						.yields(null, false)
					@AuthorizationManager.getPrivilegeLevelForProject @user_id, @project_id, @callback
				
				it "should return the public privilege level", ->
					@callback.calledWith(null, "readAndWrite", true).should.equal true
			
			describe "with no user (anonymous)", ->
				beforeEach ->
					@AuthorizationManager.getPrivilegeLevelForProject null, @project_id, @callback
				
				it "should not call CollaboratorsHandler.getMemberIdPrivilegeLevel", ->
					@CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal false
				
				it "should return the public privilege level", ->
					@callback.calledWith(null, "readAndWrite", true).should.equal true
	
	describe "canUserReadProject", ->
		beforeEach ->
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub()
		
		describe "when user is owner", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "owner", false)
			
			it "should return true", (done) ->
				@AuthorizationManager.canUserReadProject @user_id, @project_id, (error, canRead) ->
					expect(canRead).to.equal true
					done()
		
		describe "when user has read-write access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "readAndWrite", false)
			
			it "should return true", (done) ->
				@AuthorizationManager.canUserReadProject @user_id, @project_id, (error, canRead) ->
					expect(canRead).to.equal true
					done()
		
		describe "when user has read-only access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "readOnly", false)
			
			it "should return true", (done) ->
				@AuthorizationManager.canUserReadProject @user_id, @project_id, (error, canRead) ->
					expect(canRead).to.equal true
					done()
		
		describe "when user has no access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, false, false)
			
			it "should return false", (done) ->
				@AuthorizationManager.canUserReadProject @user_id, @project_id, (error, canRead) ->
					expect(canRead).to.equal false
					done()

	describe "canUserWriteProjectContent", ->
		beforeEach ->
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub()
		
		describe "when user is owner", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "owner", false)
			
			it "should return true", (done) ->
				@AuthorizationManager.canUserWriteProjectContent @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal true
					done()
		
		describe "when user has read-write access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "readAndWrite", false)
			
			it "should return true", (done) ->
				@AuthorizationManager.canUserWriteProjectContent @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal true
					done()
		
		describe "when user has read-only access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "readOnly", false)
			
			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectContent @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()
		
		describe "when user has no access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, false, false)
			
			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectContent @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()

	describe "canUserWriteProjectSettings", ->
		beforeEach ->
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub()
		
		describe "when user is owner", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "owner", false)
			
			it "should return true", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal true
					done()
		
		describe "when user has read-write access as a collaborator", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "readAndWrite", false)
			
			it "should return true", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal true
					done()
		
		describe "when user has read-write access as the public", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "readAndWrite", true)
			
			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()
		
		describe "when user has read-only access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "readOnly", false)
			
			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()
		
		describe "when user has no access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, false, false)
			
			it "should return false", (done) ->
				@AuthorizationManager.canUserWriteProjectSettings @user_id, @project_id, (error, canWrite) ->
					expect(canWrite).to.equal false
					done()

	describe "canUserAdminProject", ->
		beforeEach ->
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub()
		
		describe "when user is owner", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "owner", false)
			
			it "should return true", (done) ->
				@AuthorizationManager.canUserAdminProject @user_id, @project_id, (error, canAdmin) ->
					expect(canAdmin).to.equal true
					done()
		
		describe "when user has read-write access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "readAndWrite", false)
			
			it "should return false", (done) ->
				@AuthorizationManager.canUserAdminProject @user_id, @project_id, (error, canAdmin) ->
					expect(canAdmin).to.equal false
					done()
		
		describe "when user has read-only access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, "readOnly", false)
			
			it "should return false", (done) ->
				@AuthorizationManager.canUserAdminProject @user_id, @project_id, (error, canAdmin) ->
					expect(canAdmin).to.equal false
					done()
		
		describe "when user has no access", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.withArgs(@user_id, @project_id)
					.yields(null, false, false)
			
			it "should return false", (done) ->
				@AuthorizationManager.canUserAdminProject @user_id, @project_id, (error, canAdmin) ->
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
