sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Authentication/AuthenticationController.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
tk = require("timekeeper")
MockRequest = require("../helpers/MockRequest")
MockResponse = require("../helpers/MockResponse")
ObjectId = require("mongojs").ObjectId

describe "AuthenticationController", ->
	beforeEach ->
		@AuthenticationController = SandboxedModule.require modulePath, requires:
			"./AuthenticationManager": @AuthenticationManager = {}
			"../User/UserGetter" : @UserGetter = {}
			"../User/UserUpdater" : @UserUpdater = {}
			"../../infrastructure/Metrics": @Metrics = { inc: sinon.stub() }
			"../Security/LoginRateLimiter": @LoginRateLimiter = { processLoginRequest:sinon.stub(), recordSuccessfulLogin:sinon.stub() }
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
		@user =
			_id: ObjectId()
			email: @email = "USER@example.com"
			first_name: "bob"
			last_name: "brown"
			referal_id: 1234
			isAdmin: false
		@password = "banana"
		@req = new MockRequest()
		@res = new MockResponse()
		@callback = @next = sinon.stub()
		tk.freeze(Date.now())


	afterEach ->
		tk.reset()

	describe "login", ->
		beforeEach ->
			@AuthenticationController._recordFailedLogin = sinon.stub()
			@AuthenticationController._recordSuccessfulLogin = sinon.stub()
			@AuthenticationController._establishUserSession = sinon.stub().callsArg(2)
			@req.body =
				email: @email
				password: @password
				redir: @redir = "/path/to/redir/to"

		describe "when the users rate limit", ->

			it "should block the request if the limit has been exceeded", (done)->
				@LoginRateLimiter.processLoginRequest.callsArgWith(1, null, false)
				@res =
					send: (code)=>
						@res.statusCode.should.equal 429
						done()
				@AuthenticationController.login(@req, @res)
			
		describe 'when the user is authenticated', ->
			beforeEach ->
				@LoginRateLimiter.processLoginRequest.callsArgWith(1, null, true)
				@AuthenticationManager.authenticate = sinon.stub().callsArgWith(2, null, @user)
				@AuthenticationController.login(@req, @res)

			it "should attempt to authorise the user", ->
				@AuthenticationManager.authenticate
					.calledWith(email: @email.toLowerCase(), @password)
					.should.equal true

			it "should establish the user's session", ->
				@AuthenticationController._establishUserSession
					.calledWith(@req, @user)
					.should.equal true

			it "should redirect the user to the specified location", ->
				expect(@res.body).to.deep.equal redir: @redir

			it "should record the successful login", ->
				@AuthenticationController._recordSuccessfulLogin
					.calledWith(@user._id)
					.should.equal true

			it "should tell the rate limiter that there was a success for that email", ->
				@LoginRateLimiter.recordSuccessfulLogin.calledWith(@email.toLowerCase()).should.equal true

			it "should log the successful login", ->
				@logger.log
					.calledWith(email: @email.toLowerCase(), user_id: @user._id.toString(), "successful log in")
					.should.equal true
				

		describe 'when the user is not authenticated', ->
			beforeEach ->
				@LoginRateLimiter.processLoginRequest.callsArgWith(1, null, true)
				@AuthenticationManager.authenticate = sinon.stub().callsArgWith(2, null, null)
				@AuthenticationController.login(@req, @res)

			it "should return an error", ->
				# @res.body.should.exist
				expect(@res.body.message).to.exist
					# message:
					# 	text: 'Your email or password were incorrect. Please try again',
					# 	type: 'error'

			it "should not establish a session", ->
				@AuthenticationController._establishUserSession.called.should.equal false

			it "should record a failed login", ->
				@AuthenticationController._recordFailedLogin.called.should.equal true

			it "should log the failed login", ->
				@logger.log
					.calledWith(email: @email.toLowerCase(), "failed log in")
					.should.equal true

		describe "with a URL to a different domain", ->
			beforeEach ->
				@LoginRateLimiter.processLoginRequest.callsArgWith(1, null, true)
				@req.body.redir = "http://www.facebook.com/test"
				@AuthenticationManager.authenticate = sinon.stub().callsArgWith(2, null, @user)
				@AuthenticationController.login(@req, @res)

			it "should only redirect to the local path", ->
				expect(@res.body).to.deep.equal redir: "/test"

	describe "getLoggedInUserId", ->

		beforeEach ->
			@req = 
				session :{}

		it "should return the user id from the session", (done)->
			@user_id = "2134"
			@req.session.user = 
				_id:@user_id
			@AuthenticationController.getLoggedInUserId @req, (err, user_id)=>
				expect(user_id).to.equal @user_id
				done()

		it "should return null if there is no user on the session", (done)->
			@AuthenticationController.getLoggedInUserId @req, (err, user_id)=>
				expect(user_id).to.be.null
				done()

		it "should return null if there is no session", (done)->
			@req = {}
			@AuthenticationController.getLoggedInUserId @req, (err, user_id)=>
				expect(user_id).to.be.null
				done()

		it "should return null if there is no req", (done)->
			@req = {}
			@AuthenticationController.getLoggedInUserId @req, (err, user_id)=>
				expect(user_id).to.be.null
				done()

	describe "getLoggedInUser", ->
		beforeEach ->
			@UserGetter.getUser = sinon.stub().callsArgWith(1, null, @user)
			
		describe "with an established session", ->
			beforeEach ->
				@req.session =
					user: @user
				@AuthenticationController.getLoggedInUser(@req, {}, @callback)

			it "should look up the user in the database", ->
				@UserGetter.getUser
					.calledWith(@user._id)
					.should.equal true

			it "should return the user", ->
				@callback.calledWith(null, @user).should.equal true

		describe "with an auth token, but without auth_token_allowed set to true", ->
			beforeEach ->
				@req.query =
					auth_token: "auth-token"
				@AuthenticationController.getLoggedInUser(@req, {}, @callback)

			it "should not look up the user in the database", ->
				@UserGetter.getUser.called.should.equal false

			it "should return null in the callback", ->
				@callback.calledWith(null, null).should.equal true

		describe "with an auth token and auth_token_allowed set to true", ->
			beforeEach ->
				@req.query =
					auth_token: "auth-token"
				@AuthenticationController.getLoggedInUser(@req, {allow_auth_token: true}, @callback)

			it "should look up the user in the database", ->
				@UserGetter.getUser
					.calledWith(auth_token: @req.query.auth_token)
					.should.equal true

			it "should return the user", ->
				@callback.calledWith(null, @user).should.equal true

	describe "requireLogin", ->
		beforeEach ->
			@user =
				_id: "user-id-123"
				email: "user@sharelatex.com"
			
		describe "when loading from the database", ->
			beforeEach ->
				@middleware = @AuthenticationController.requireLogin(@options = { allow_auth_token: true, load_from_db: true })

			describe "when the user is logged in", ->
				beforeEach ->
					@AuthenticationController.getLoggedInUser = sinon.stub().callsArgWith(2, null, @user)
					@middleware(@req, @res, @next)

				it "should call getLoggedInUser with the passed options", ->
					@AuthenticationController.getLoggedInUser.calledWith(@req, { allow_auth_token: true }).should.equal true

				it "should set the user property on the request", ->
					@req.user.should.deep.equal @user

				it "should call the next method in the chain", ->
					@next.called.should.equal true

			describe "when the user is not logged in", ->
				beforeEach ->
					@AuthenticationController._redirectToLoginOrRegisterPage = sinon.stub()
					@AuthenticationController.getLoggedInUser = sinon.stub().callsArgWith(2, null, null)
					@middleware(@req, @res, @next)

				it "should redirect to the register page", ->
					@AuthenticationController._redirectToLoginOrRegisterPage.calledWith(@req, @res).should.equal true

		describe "when not loading from the database", ->
			beforeEach ->
				@middleware = @AuthenticationController.requireLogin(@options = { load_from_db: false })

			describe "when the user is logged in", ->
				beforeEach ->
					@req.session =
						user: @user = {
							_id: "user-id-123"
							email: "user@sharelatex.com"
						}
					@middleware(@req, @res, @next)

				it "should set the user property on the request", ->
					@req.user.should.deep.equal @user

				it "should call the next method in the chain", ->
					@next.called.should.equal true

			describe "when the user is not logged in", ->
				beforeEach ->
					@req.session = {}
					@AuthenticationController._redirectToLoginOrRegisterPage = sinon.stub()
					@req.query = {}
					@middleware(@req, @res, @next)

				it "should redirect to the register or login page", ->
					@AuthenticationController._redirectToLoginOrRegisterPage.calledWith(@req, @res).should.equal true

		describe "when not loading from the database but an auth_token is provided", ->
			beforeEach ->
				@AuthenticationController.getLoggedInUser = sinon.stub().callsArgWith(2, null, @user)
				@middleware = @AuthenticationController.requireLogin(@options = { load_from_db: false, allow_auth_token: true })
				@req.query = auth_token: @auth_token = "auth-token-provided"
				@middleware(@req, @res, @next)

			it "should try to load the user from the database anyway", ->
				@AuthenticationController.getLoggedInUser
					.calledWith(@req, {allow_auth_token: true})
					.should.equal true



		describe "_redirectToLoginOrRegisterPage", ->

			beforeEach ->
				@middleware = @AuthenticationController.requireLogin(@options = { load_from_db: false })
				@req.session = {}
				@AuthenticationController._redirectToRegisterPage = sinon.stub()
				@AuthenticationController._redirectToLoginPage = sinon.stub()
				@req.query = {}

			describe "they have come directly to the url", ->
				beforeEach -> 
					@req.query = {}
					@middleware(@req, @res, @next)

				it "should redirect to the login page", ->
					@AuthenticationController._redirectToRegisterPage.calledWith(@req, @res).should.equal false
					@AuthenticationController._redirectToLoginPage.calledWith(@req, @res).should.equal true

			describe "they have come via a templates link", ->

				beforeEach -> 
					@req.query.zipUrl = "something"
					@middleware(@req, @res, @next)

				it "should redirect to the register page", ->
					@AuthenticationController._redirectToRegisterPage.calledWith(@req, @res).should.equal true
					@AuthenticationController._redirectToLoginPage.calledWith(@req, @res).should.equal false

			describe "they have been invited to a project", ->
				
				beforeEach -> 
					@req.query.project_name = "something"
					@middleware(@req, @res, @next)

				it "should redirect to the register page", ->
					@AuthenticationController._redirectToRegisterPage.calledWith(@req, @res).should.equal true
					@AuthenticationController._redirectToLoginPage.calledWith(@req, @res).should.equal false




	describe "_redirectToRegisterPage", ->
		beforeEach ->
			@req.path = "/target/url"
			@req.query =
				extra_query: "foo"
			@AuthenticationController._redirectToRegisterPage(@req, @res)

		it "should redirect to the register page with a query string attached", ->
			@res.redirectedTo
				.should.equal "/register?extra_query=foo&redir=%2Ftarget%2Furl"

		it "should log out a message", ->
			@logger.log
				.calledWith(url: @url, "user not logged in so redirecting to register page")
				.should.equal true

	describe "_redirectToLoginPage", ->
		beforeEach ->
			@req.path = "/target/url"
			@req.query =
				extra_query: "foo"
			@AuthenticationController._redirectToLoginPage(@req, @res)

		it "should redirect to the register page with a query string attached", ->
			@res.redirectedTo.should.equal "/login?extra_query=foo&redir=%2Ftarget%2Furl"


	describe "_recordSuccessfulLogin", ->
		beforeEach ->
			@UserUpdater.updateUser = sinon.stub().callsArg(2)
			@AuthenticationController._recordSuccessfulLogin(@user._id, @callback)
			
		it "should increment the user.login.success metric", ->
			@Metrics.inc
				.calledWith("user.login.success")
				.should.equal true

		it "should update the user's login count and last logged in date", ->
			@UserUpdater.updateUser.args[0][1]["$set"]["lastLoggedIn"].should.not.equal undefined
			@UserUpdater.updateUser.args[0][1]["$inc"]["loginCount"].should.equal 1

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "_recordFailedLogin", ->
		beforeEach ->
			@AuthenticationController._recordFailedLogin(@callback)
			
		it "should increment the user.login.failed metric", ->
			@Metrics.inc
				.calledWith("user.login.failed")
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "_establishUserSession", ->
		beforeEach ->
			@req.session =
				save: sinon.stub().callsArg(0)
			@AuthenticationController._establishUserSession @req, @user, @callback

		it "should set the session user to a basic version of the user", ->
			@req.session.user._id.should.equal @user._id
			@req.session.user.email.should.equal @user.email
			@req.session.user.first_name.should.equal @user.first_name
			@req.session.user.last_name.should.equal @user.last_name
			@req.session.user.referal_id.should.equal @user.referal_id
			@req.session.user.isAdmin.should.equal @user.isAdmin

		it "should return the callback", ->
			@callback.called.should.equal true

