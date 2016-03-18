sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Authorization/AuthorizationMiddlewear.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Features/Errors/Errors.js"

describe "AuthorizationMiddlewear", ->
	beforeEach ->
		@AuthorizationMiddlewear = SandboxedModule.require modulePath, requires:
			"./AuthorizationManager": @AuthorizationManager = {}
			"logger-sharelatex": {log: () ->}
			"mongojs": ObjectId: @ObjectId = {}
			"../Errors/Errors": Errors
		@user_id = "user-id-123"
		@project_id = "project-id-123"
		@req = {}
		@res = {}
		@ObjectId.isValid = sinon.stub()
		@ObjectId.isValid.withArgs(@project_id).returns true
		@next = sinon.stub()
	
	METHODS_TO_TEST = {
		"ensureUserCanReadProject": "canUserReadProject"
		"ensureUserCanWriteProjectSettings": "canUserWriteProjectSettings"
		"ensureUserCanWriteProjectContent": "canUserWriteProjectContent"
		"ensureUserCanAdminProject": "canUserAdminProject"
	}
	for middlewearMethod, managerMethod of METHODS_TO_TEST
		do (middlewearMethod, managerMethod) ->
			describe middlewearMethod, ->
				beforeEach ->
					@req.params =
						project_id: @project_id
					@AuthorizationManager[managerMethod] = sinon.stub()
					@AuthorizationMiddlewear.redirectToRestricted = sinon.stub()
				
				describe "with missing project_id", ->
					beforeEach ->
						@req.params = {}
					
					it "should return an error to next", ->
						@AuthorizationMiddlewear[middlewearMethod] @req, @res, @next
						@next.calledWith(new Error()).should.equal true

				describe "with logged in user", ->
					beforeEach ->
						@req.session =
							user: _id: @user_id

					describe "when user has permission", ->
						beforeEach ->
							@AuthorizationManager[managerMethod]
								.withArgs(@user_id, @project_id)
								.yields(null, true)
						
						it "should return next", ->
							@AuthorizationMiddlewear[middlewearMethod] @req, @res, @next
							@next.called.should.equal true

					describe "when user doesn't have permission", ->
						beforeEach ->
							@AuthorizationManager[managerMethod]
								.withArgs(@user_id, @project_id)
								.yields(null, false)
						
						it "should redirect to redirectToRestricted", ->
							@AuthorizationMiddlewear[middlewearMethod] @req, @res, @next
							@next.called.should.equal false
							@AuthorizationMiddlewear.redirectToRestricted
								.calledWith(@req, @res, @next)
								.should.equal true
				
				describe "with anonymous user", ->
					describe "when user has permission", ->
						beforeEach ->
							@AuthorizationManager[managerMethod]
								.withArgs(null, @project_id)
								.yields(null, true)
						
						it "should return next", ->
							@AuthorizationMiddlewear[middlewearMethod] @req, @res, @next
							@next.called.should.equal true

					describe "when user doesn't have permission", ->
						beforeEach ->
							@AuthorizationManager[managerMethod]
								.withArgs(null, @project_id)
								.yields(null, false)
						
						it "should redirect to redirectToRestricted", ->
							@AuthorizationMiddlewear[middlewearMethod] @req, @res, @next
							@next.called.should.equal false
							@AuthorizationMiddlewear.redirectToRestricted
								.calledWith(@req, @res, @next)
								.should.equal true
				
				describe "with malformed project id", ->
					beforeEach ->
						@req.params =
							project_id: "blah"
						@ObjectId.isValid = sinon.stub().returns false
					
					it "should return a not found error", (done) ->
						@AuthorizationMiddlewear[middlewearMethod] @req, @res, (error) ->
							error.should.be.instanceof Errors.NotFoundError
							done()
	
	describe "ensureUserIsSiteAdmin", ->
		beforeEach ->
			@AuthorizationManager.isUserSiteAdmin = sinon.stub()
			@AuthorizationMiddlewear.redirectToRestricted = sinon.stub()

		describe "with logged in user", ->
			beforeEach ->
				@req.session =
					user: _id: @user_id

			describe "when user has permission", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin
						.withArgs(@user_id)
						.yields(null, true)
				
				it "should return next", ->
					@AuthorizationMiddlewear.ensureUserIsSiteAdmin @req, @res, @next
					@next.called.should.equal true

			describe "when user doesn't have permission", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin
						.withArgs(@user_id)
						.yields(null, false)
				
				it "should redirect to redirectToRestricted", ->
					@AuthorizationMiddlewear.ensureUserIsSiteAdmin @req, @res, @next
					@next.called.should.equal false
					@AuthorizationMiddlewear.redirectToRestricted
						.calledWith(@req, @res, @next)
						.should.equal true
		
		describe "with anonymous user", ->
			describe "when user has permission", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin
						.withArgs(null)
						.yields(null, true)
				
				it "should return next", ->
					@AuthorizationMiddlewear.ensureUserIsSiteAdmin @req, @res, @next
					@next.called.should.equal true

			describe "when user doesn't have permission", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin
						.withArgs(null)
						.yields(null, false)
				
				it "should redirect to redirectToRestricted", ->
					@AuthorizationMiddlewear.ensureUserIsSiteAdmin @req, @res, @next
					@next.called.should.equal false
					@AuthorizationMiddlewear.redirectToRestricted
						.calledWith(@req, @res, @next)
						.should.equal true
	
	describe "ensureUserCanReadMultipleProjects", ->
		beforeEach ->
			@AuthorizationManager.canUserReadProject = sinon.stub()
			@AuthorizationMiddlewear.redirectToRestricted = sinon.stub()
			@req.query =
				project_ids: "project1,project2"
			
		describe "with logged in user", ->
			beforeEach ->
				@req.session =
					user: _id: @user_id

			describe "when user has permission to access all projects", ->
				beforeEach ->
					@AuthorizationManager.canUserReadProject
						.withArgs(@user_id, "project1")
						.yields(null, true)
					@AuthorizationManager.canUserReadProject
						.withArgs(@user_id, "project2")
						.yields(null, true)
				
				it "should return next", ->
					@AuthorizationMiddlewear.ensureUserCanReadMultipleProjects @req, @res, @next
					@next.called.should.equal true

			describe "when user doesn't have permission to access one of the projects", ->
				beforeEach ->
					@AuthorizationManager.canUserReadProject
						.withArgs(@user_id, "project1")
						.yields(null, true)
					@AuthorizationManager.canUserReadProject
						.withArgs(@user_id, "project2")
						.yields(null, false)
				
				it "should redirect to redirectToRestricted", ->
					@AuthorizationMiddlewear.ensureUserCanReadMultipleProjects @req, @res, @next
					@next.called.should.equal false
					@AuthorizationMiddlewear.redirectToRestricted
						.calledWith(@req, @res, @next)
						.should.equal true
		
		describe "with anonymous user", ->
			describe "when user has permission", ->
				describe "when user has permission to access all projects", ->
					beforeEach ->
						@AuthorizationManager.canUserReadProject
							.withArgs(null, "project1")
							.yields(null, true)
						@AuthorizationManager.canUserReadProject
							.withArgs(null, "project2")
							.yields(null, true)
					
					it "should return next", ->
						@AuthorizationMiddlewear.ensureUserCanReadMultipleProjects @req, @res, @next
						@next.called.should.equal true

				describe "when user doesn't have permission to access one of the projects", ->
					beforeEach ->
						@AuthorizationManager.canUserReadProject
							.withArgs(null, "project1")
							.yields(null, true)
						@AuthorizationManager.canUserReadProject
							.withArgs(null, "project2")
							.yields(null, false)
					
					it "should redirect to redirectToRestricted", ->
						@AuthorizationMiddlewear.ensureUserCanReadMultipleProjects @req, @res, @next
						@next.called.should.equal false
						@AuthorizationMiddlewear.redirectToRestricted
							.calledWith(@req, @res, @next)
							.should.equal true
