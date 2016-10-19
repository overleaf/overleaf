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
			"../User/UserHandler": @UserHandler = {setupLoginData:sinon.stub()}
			"../Analytics/AnalyticsManager": @AnalyticsManager = { recordEvent: sinon.stub() }
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub(), err: sinon.stub() }
			"settings-sharelatex": {}
			"passport": @passport =
				authenticate: sinon.stub().returns(sinon.stub())
			"../User/UserSessionsManager": @UserSessionsManager =
				trackSession: sinon.stub()
				untrackSession: sinon.stub()
				revokeAllUserSessions: sinon.stub().callsArgWith(1, null)
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

	describe 'isUserLoggedIn', () ->

		beforeEach ->
			@stub = sinon.stub(@AuthenticationController, 'getLoggedInUserId')

		afterEach ->
			@stub.restore()

		it 'should do the right thing in all cases', () ->
			@AuthenticationController.getLoggedInUserId.returns('some_id')
			expect(@AuthenticationController.isUserLoggedIn(@req)).to.equal true
			@AuthenticationController.getLoggedInUserId.returns(null)
			expect(@AuthenticationController.isUserLoggedIn(@req)).to.equal false
			@AuthenticationController.getLoggedInUserId.returns(false)
			expect(@AuthenticationController.isUserLoggedIn(@req)).to.equal false
			@AuthenticationController.getLoggedInUserId.returns(undefined)
			expect(@AuthenticationController.isUserLoggedIn(@req)).to.equal false

	describe 'setInSessionUser', () ->

		beforeEach ->
			@user = {
				_id: 'id'
				first_name: 'a'
				last_name:  'b'
				email:      'c'
			}
			@req.session.passport = {user: @user}
			@req.session.user = @user

		it 'should update the right properties', () ->
			@AuthenticationController.setInSessionUser(@req, {first_name: 'new_first_name', email: 'new_email'})
			expectedUser = {
				_id: 'id'
				first_name: 'new_first_name'
				last_name:  'b'
				email:      'new_email'
			}
			expect(@req.session.passport.user).to.deep.equal(expectedUser)
			expect(@req.session.user).to.deep.equal(expectedUser)

	describe 'passportLogin', ->

		beforeEach ->
			@info = null
			@req.login = sinon.stub().callsArgWith(1, null)
			@res.json = sinon.stub()
			@req.session = @session = {passport: {user: @user}}
			@req.session.destroy = sinon.stub()
			@req.session.save = sinon.stub().callsArgWith(0, null)
			@req.sessionStore = {generate: sinon.stub()}
			@passport.authenticate.callsArgWith(1, null, @user, @info)

		it 'should call passport.authenticate', () ->
			@AuthenticationController.passportLogin @req, @res, @next
			@passport.authenticate.callCount.should.equal 1

		describe 'when authenticate produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@passport.authenticate.callsArgWith(1, @err)

			it 'should return next with an error', () ->
				@AuthenticationController.passportLogin @req, @res, @next
				@next.calledWith(@err).should.equal true

		describe 'when authenticate produces a user', ->

			beforeEach ->
				@req._redir = 'some_redirect'
				@passport.authenticate.callsArgWith(1, null, @user, @info)

			afterEach ->
				delete @req._redir

			it 'should call req.login', () ->
				@AuthenticationController.passportLogin @req, @res, @next
				@req.login.callCount.should.equal 1
				@req.login.calledWith(@user).should.equal true

			it 'should send a json response with redirect', () ->
				@AuthenticationController.passportLogin @req, @res, @next
				@res.json.callCount.should.equal 1
				@res.json.calledWith({redir: @req._redir}).should.equal true

			describe 'when session.save produces an error', () ->
				beforeEach ->
					@req.session.save = sinon.stub().callsArgWith(0, new Error('woops'))

				it 'should return next with an error', () ->
					@AuthenticationController.passportLogin @req, @res, @next
					@next.calledWith(@err).should.equal true

				it 'should not return json', () ->
					@AuthenticationController.passportLogin @req, @res, @next
					@res.json.callCount.should.equal 0

		describe 'when authenticate does not produce a user', ->

			beforeEach ->
				@info = {text: 'a', type: 'b'}
				@passport.authenticate.callsArgWith(1, null, false, @info)

			it 'should not call req.login', () ->
				@AuthenticationController.passportLogin @req, @res, @next
				@req.login.callCount.should.equal 0

			it 'should send a json response with redirect', () ->
				@AuthenticationController.passportLogin @req, @res, @next
				@res.json.callCount.should.equal 1
				@res.json.calledWith({message: @info}).should.equal true

	describe 'getSessionUser', ->

		it 'should get the user object from session', ->
			@req.session =
				passport:
					user: {_id: 'one'}
			user = @AuthenticationController.getSessionUser(@req)
			expect(user).to.deep.equal {_id: 'one'}

		it 'should work with legacy sessions', ->
			@req.session =
				user: {_id: 'one'}
			user = @AuthenticationController.getSessionUser(@req)
			expect(user).to.deep.equal {_id: 'one'}

	describe "doPassportLogin", ->
		beforeEach ->
			@AuthenticationController._recordFailedLogin = sinon.stub()
			@AuthenticationController._recordSuccessfulLogin = sinon.stub()
			# @AuthenticationController.establishUserSession = sinon.stub().callsArg(2)
			@req.body =
				email: @email
				password: @password
				redir: @redir = "/path/to/redir/to"
			@cb = sinon.stub()

		describe "when the users rate limit", ->

			beforeEach ->
				@LoginRateLimiter.processLoginRequest.callsArgWith(1, null, false)

			it "should block the request if the limit has been exceeded", (done)->
				@AuthenticationController.doPassportLogin(@req, @req.body.email, @req.body.password, @cb)
				@cb.callCount.should.equal 1
				@cb.calledWith(null, null).should.equal true
				done()

		describe 'when the user is authenticated', ->
			beforeEach ->
				@cb = sinon.stub()
				@LoginRateLimiter.processLoginRequest.callsArgWith(1, null, true)
				@AuthenticationManager.authenticate = sinon.stub().callsArgWith(2, null, @user)
				@AuthenticationController.doPassportLogin(@req, @req.body.email, @req.body.password, @cb)

			it "should attempt to authorise the user", ->
				@AuthenticationManager.authenticate
					.calledWith(email: @email.toLowerCase(), @password)
					.should.equal true

			it "should setup the user data in the background", ->
				@UserHandler.setupLoginData.calledWith(@user).should.equal true

			it "should establish the user's session", ->
				@cb.calledWith(null, @user).should.equal true

			it "should set res.session.justLoggedIn", ->
				@req.session.justLoggedIn.should.equal true

			it "should redirect the user to the specified location", ->
				expect(@req._redir).to.deep.equal @redir

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

			it "should track the login event", ->
				@AnalyticsManager.recordEvent
					.calledWith(@user._id, "user-logged-in")
					.should.equal true

		describe 'when the user is not authenticated', ->
			beforeEach ->
				@LoginRateLimiter.processLoginRequest.callsArgWith(1, null, true)
				@AuthenticationManager.authenticate = sinon.stub().callsArgWith(2, null, null)
				@cb = sinon.stub()
				@AuthenticationController.doPassportLogin(@req, @req.body.email, @req.body.password, @cb)

			it "should not establish the login", ->
				@cb.callCount.should.equal 1
				@cb.calledWith(null, false)
				# @res.body.should.exist
				expect(@cb.lastCall.args[2]).to.contain.all.keys ['text', 'type']
					# message:
					# 	text: 'Your email or password were incorrect. Please try again',
					# 	type: 'error'

			it "should not setup the user data in the background", ->
				@UserHandler.setupLoginData.called.should.equal false

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
				@cb = sinon.stub()
				@AuthenticationController.doPassportLogin(@req, @req.body.email, @req.body.password, @cb)

			it "should only redirect to the local path", ->
				expect(@req._redir).to.equal "/test"

	describe "getLoggedInUserId", ->

		beforeEach ->
			@req =
				session :{}

		it "should return the user id from the session", ()->
			@user_id = "2134"
			@req.session.user =
				_id:@user_id
			result = @AuthenticationController.getLoggedInUserId @req
			expect(result).to.equal @user_id

		it 'should return user for passport session', () ->
			@user_id = "2134"
			@req.session = {
				passport: {
					user: {
						_id:@user_id
					}
				}
		 	}
			result = @AuthenticationController.getLoggedInUserId @req
			expect(result).to.equal @user_id

		it "should return null if there is no user on the session", ()->
			result = @AuthenticationController.getLoggedInUserId @req
			expect(result).to.equal null

		it "should return null if there is no session", ()->
			@req = {}
			result = @AuthenticationController.getLoggedInUserId @req
			expect(result).to.equal null

		it "should return null if there is no req", ()->
			@req = {}
			result = @AuthenticationController.getLoggedInUserId @req
			expect(result).to.equal null

	describe "requireLogin", ->
		beforeEach ->
			@user =
				_id: "user-id-123"
				email: "user@sharelatex.com"
			@middleware = @AuthenticationController.requireLogin()

		describe "when the user is logged in", ->
			beforeEach ->
				@req.session =
					user: @user = {
						_id: "user-id-123"
						email: "user@sharelatex.com"
					}
				@middleware(@req, @res, @next)

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

	describe "requireGlobalLogin", ->
		beforeEach ->
			@req.headers = {}
			@AuthenticationController.httpAuth = sinon.stub()

		describe "with white listed url", ->
			beforeEach ->
				@AuthenticationController.addEndpointToLoginWhitelist "/login"
				@req._parsedUrl.pathname = "/login"
				@AuthenticationController.requireGlobalLogin @req, @res, @next

			it "should call next() directly", ->
				@next.called.should.equal true

		describe "with white listed url and a query string", ->
			beforeEach ->
				@AuthenticationController.addEndpointToLoginWhitelist "/login"
				@req._parsedUrl.pathname = "/login"
				@req.url = "/login?query=something"
				@AuthenticationController.requireGlobalLogin @req, @res, @next

			it "should call next() directly", ->
				@next.called.should.equal true

		describe "with http auth", ->
			beforeEach ->
				@req.headers["authorization"] = "Mock Basic Auth"
				@AuthenticationController.requireGlobalLogin @req, @res, @next

			it "should pass the request onto httpAuth", ->
				@AuthenticationController.httpAuth
					.calledWith(@req, @res, @next)
					.should.equal true

		describe "with a user session", ->
			beforeEach ->
				@req.session =
					user: {"mock": "user", "_id": "some_id"}
				@AuthenticationController.requireGlobalLogin @req, @res, @next

			it "should call next() directly", ->
				@next.called.should.equal true

		describe "with no login credentials", ->
			beforeEach ->
				@req.session = {}
				@AuthenticationController.requireGlobalLogin @req, @res, @next

			it "should redirect to the /login page", ->
				@res.redirectedTo.should.equal "/login"

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
