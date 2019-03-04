sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Authorization/AuthorizationMiddleware.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Features/Errors/Errors.js"

describe "AuthorizationMiddleware", ->
	beforeEach ->
		@user_id = "user-id-123"
		@project_id = "project-id-123"
		@token = 'some-token'
		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@user_id)
			isUserLoggedIn: sinon.stub().returns(true)
		@AuthorizationMiddleware = SandboxedModule.require modulePath, requires:
			"./AuthorizationManager": @AuthorizationManager = {}
			"logger-sharelatex": {log: () ->}
			"mongojs": ObjectId: @ObjectId = {}
			"../Errors/Errors": Errors
			'../Authentication/AuthenticationController': @AuthenticationController
			"../TokenAccess/TokenAccessHandler": @TokenAccessHandler =
				getRequestToken: sinon.stub().returns(@token)
		@req = {}
		@res = {}
		@ObjectId.isValid = sinon.stub()
		@ObjectId.isValid.withArgs(@project_id).returns true
		@next = sinon.stub()

	describe "_getUserId", ->
		beforeEach ->
			@req = {}

		it "should get the user from session", (done) ->
			@AuthenticationController.getLoggedInUserId = sinon.stub().returns("1234")
			@AuthorizationMiddleware._getUserId @req, (err, user_id) =>
				expect(err).to.not.exist
				expect(user_id).to.equal "1234"
				done()

		it "should get oauth_user from request", (done) ->
			@AuthenticationController.getLoggedInUserId = sinon.stub().returns(null)
			@req.oauth_user = {_id: "5678"}
			@AuthorizationMiddleware._getUserId @req, (err, user_id) =>
				expect(err).to.not.exist
				expect(user_id).to.equal "5678"
				done()

		it "should fall back to null", (done) ->
			@AuthenticationController.getLoggedInUserId = sinon.stub().returns(null)
			@req.oauth_user = undefined
			@AuthorizationMiddleware._getUserId @req, (err, user_id) =>
				expect(err).to.not.exist
				expect(user_id).to.equal null
				done()

	METHODS_TO_TEST = {
		"ensureUserCanReadProject": "canUserReadProject"
		"ensureUserCanWriteProjectSettings": "canUserWriteProjectSettings"
		"ensureUserCanWriteProjectContent": "canUserWriteProjectContent"
		"ensureUserCanAdminProject": "canUserAdminProject"
	}
	for middlewareMethod, managerMethod of METHODS_TO_TEST
		do (middlewareMethod, managerMethod) ->
			describe middlewareMethod, ->
				beforeEach ->
					@req.params =
						project_id: @project_id
					@AuthorizationManager[managerMethod] = sinon.stub()
					@AuthorizationMiddleware.redirectToRestricted = sinon.stub()

				describe "with missing project_id", ->
					beforeEach ->
						@req.params = {}

					it "should return an error to next", ->
						@AuthorizationMiddleware[middlewareMethod] @req, @res, @next
						@next.calledWith(new Error()).should.equal true

				describe "with logged in user", ->
					beforeEach ->
						@AuthenticationController.getLoggedInUserId.returns(@user_id)

					describe "when user has permission", ->
						beforeEach ->
							@AuthorizationManager[managerMethod]
								.withArgs(@user_id, @project_id, @token)
								.yields(null, true)

						it "should return next", ->
							@AuthorizationMiddleware[middlewareMethod] @req, @res, @next
							@next.called.should.equal true

					describe "when user doesn't have permission", ->
						beforeEach ->
							@AuthorizationManager[managerMethod]
								.withArgs(@user_id, @project_id, @token)
								.yields(null, false)

						it "should redirect to redirectToRestricted", ->
							@AuthorizationMiddleware[middlewareMethod] @req, @res, @next
							@next.called.should.equal false
							@AuthorizationMiddleware.redirectToRestricted
								.calledWith(@req, @res, @next)
								.should.equal true

				describe "with anonymous user", ->
					describe "when user has permission", ->
						beforeEach ->
							@AuthenticationController.getLoggedInUserId.returns(null)
							@AuthorizationManager[managerMethod]
								.withArgs(null, @project_id, @token)
								.yields(null, true)

						it "should return next", ->
							@AuthorizationMiddleware[middlewareMethod] @req, @res, @next
							@next.called.should.equal true

					describe "when user doesn't have permission", ->
						beforeEach ->
							@AuthenticationController.getLoggedInUserId.returns(null)
							@AuthorizationManager[managerMethod]
								.withArgs(null, @project_id, @token)
								.yields(null, false)

						it "should redirect to redirectToRestricted", ->
							@AuthorizationMiddleware[middlewareMethod] @req, @res, @next
							@next.called.should.equal false
							@AuthorizationMiddleware.redirectToRestricted
								.calledWith(@req, @res, @next)
								.should.equal true

				describe "with malformed project id", ->
					beforeEach ->
						@req.params =
							project_id: "blah"
						@ObjectId.isValid = sinon.stub().returns false

					it "should return a not found error", (done) ->
						@AuthorizationMiddleware[middlewareMethod] @req, @res, (error) ->
							error.should.be.instanceof Errors.NotFoundError
							done()

	describe "ensureUserIsSiteAdmin", ->
		beforeEach ->
			@AuthorizationManager.isUserSiteAdmin = sinon.stub()
			@AuthorizationMiddleware.redirectToRestricted = sinon.stub()

		describe "with logged in user", ->
			beforeEach ->
				@AuthenticationController.getLoggedInUserId.returns(@user_id)

			describe "when user has permission", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin
						.withArgs(@user_id)
						.yields(null, true)

				it "should return next", ->
					@AuthorizationMiddleware.ensureUserIsSiteAdmin @req, @res, @next
					@next.called.should.equal true

			describe "when user doesn't have permission", ->
				beforeEach ->
					@AuthorizationManager.isUserSiteAdmin
						.withArgs(@user_id)
						.yields(null, false)

				it "should redirect to redirectToRestricted", ->
					@AuthorizationMiddleware.ensureUserIsSiteAdmin @req, @res, @next
					@next.called.should.equal false
					@AuthorizationMiddleware.redirectToRestricted
						.calledWith(@req, @res, @next)
						.should.equal true

		describe "with anonymous user", ->
			describe "when user has permission", ->
				beforeEach ->
					@AuthenticationController.getLoggedInUserId.returns(null)
					@AuthorizationManager.isUserSiteAdmin
						.withArgs(null)
						.yields(null, true)

				it "should return next", ->
					@AuthorizationMiddleware.ensureUserIsSiteAdmin @req, @res, @next
					@next.called.should.equal true

			describe "when user doesn't have permission", ->
				beforeEach ->
					@AuthenticationController.getLoggedInUserId.returns(null)
					@AuthorizationManager.isUserSiteAdmin
						.withArgs(null)
						.yields(null, false)

				it "should redirect to redirectToRestricted", ->
					@AuthorizationMiddleware.ensureUserIsSiteAdmin @req, @res, @next
					@next.called.should.equal false
					@AuthorizationMiddleware.redirectToRestricted
						.calledWith(@req, @res, @next)
						.should.equal true

	describe "ensureUserCanReadMultipleProjects", ->
		beforeEach ->
			@AuthorizationManager.canUserReadProject = sinon.stub()
			@AuthorizationMiddleware.redirectToRestricted = sinon.stub()
			@req.query =
				project_ids: "project1,project2"

		describe "with logged in user", ->
			beforeEach ->
				@AuthenticationController.getLoggedInUserId.returns(@user_id)

			describe "when user has permission to access all projects", ->
				beforeEach ->
					@AuthorizationManager.canUserReadProject
						.withArgs(@user_id, "project1", @token)
						.yields(null, true)
					@AuthorizationManager.canUserReadProject
						.withArgs(@user_id, "project2", @token)
						.yields(null, true)

				it "should return next", ->
					@AuthorizationMiddleware.ensureUserCanReadMultipleProjects @req, @res, @next
					@next.called.should.equal true

			describe "when user doesn't have permission to access one of the projects", ->
				beforeEach ->
					@AuthorizationManager.canUserReadProject
						.withArgs(@user_id, "project1", @token)
						.yields(null, true)
					@AuthorizationManager.canUserReadProject
						.withArgs(@user_id, "project2", @token)
						.yields(null, false)

				it "should redirect to redirectToRestricted", ->
					@AuthorizationMiddleware.ensureUserCanReadMultipleProjects @req, @res, @next
					@next.called.should.equal false
					@AuthorizationMiddleware.redirectToRestricted
						.calledWith(@req, @res, @next)
						.should.equal true

		describe "with anonymous user", ->
			describe "when user has permission", ->
				describe "when user has permission to access all projects", ->
					beforeEach ->
						@AuthenticationController.getLoggedInUserId.returns(null)
						@AuthorizationManager.canUserReadProject
							.withArgs(null, "project1", @token)
							.yields(null, true)
						@AuthorizationManager.canUserReadProject
							.withArgs(null, "project2", @token)
							.yields(null, true)

					it "should return next", ->
						@AuthorizationMiddleware.ensureUserCanReadMultipleProjects @req, @res, @next
						@next.called.should.equal true

				describe "when user doesn't have permission to access one of the projects", ->
					beforeEach ->
						@AuthenticationController.getLoggedInUserId.returns(null)
						@AuthorizationManager.canUserReadProject
							.withArgs(null, "project1", @token)
							.yields(null, true)
						@AuthorizationManager.canUserReadProject
							.withArgs(null, "project2", @token)
							.yields(null, false)

					it "should redirect to redirectToRestricted", ->
						@AuthorizationMiddleware.ensureUserCanReadMultipleProjects @req, @res, @next
						@next.called.should.equal false
						@AuthorizationMiddleware.redirectToRestricted
							.calledWith(@req, @res, @next)
							.should.equal true
