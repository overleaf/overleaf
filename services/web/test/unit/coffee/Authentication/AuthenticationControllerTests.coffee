sinon = require('sinon')
chai = require('chai')
sinonChai = require "sinon-chai"
chai.use sinonChai
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
		tk.freeze(Date.now())
		@UserModel = findOne: sinon.stub()
		@AuthenticationController = SandboxedModule.require modulePath, requires:
			"./AuthenticationManager": @AuthenticationManager = {}
			"../User/UserUpdater" : @UserUpdater = {updateUser:sinon.stub()}
			"metrics-sharelatex": @Metrics = { inc: sinon.stub() }
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
			"../../infrastructure/Modules": @Modules = {hooks: {fire: sinon.stub().callsArgWith(2, null, [])}}
			"../SudoMode/SudoModeHandler": @SudoModeHandler = {activateSudoMode: sinon.stub().callsArgWith(1, null)}
			"../Notifications/NotificationsBuilder": @NotificationsBuilder =
				ipMatcherAffiliation: sinon.stub()
			"../V1/V1Api": @V1Api = request: sinon.stub()
			"../../models/User": { User: @UserModel }
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
			@req.session = @session = {
				passport: {user: @user},
				postLoginRedirect: "/path/to/redir/to"
			}
			@req.session.destroy = sinon.stub().callsArgWith(0, null)
			@req.session.save = sinon.stub().callsArgWith(0, null)
			@req.sessionStore = {generate: sinon.stub()}
			@AuthenticationController.finishLogin = sinon.stub()
			@passport.authenticate.callsArgWith(1, null, @user, @info)
			@err = new Error('woops')

		it 'should call passport.authenticate', () ->
			@AuthenticationController.passportLogin @req, @res, @next
			@passport.authenticate.callCount.should.equal 1

		describe 'when authenticate produces an error', ->

			beforeEach ->
				@passport.authenticate.callsArgWith(1, @err)

			it 'should return next with an error', () ->
				@AuthenticationController.passportLogin @req, @res, @next
				@next.calledWith(@err).should.equal true

		describe 'when authenticate produces a user', ->

			beforeEach ->
				@req.session.postLoginRedirect = 'some_redirect'
				@passport.authenticate.callsArgWith(1, null, @user, @info)

			afterEach ->
				delete @req.session.postLoginRedirect

			it 'should call finishLogin', () ->
				@AuthenticationController.passportLogin @req, @res, @next
				@AuthenticationController.finishLogin.callCount.should.equal 1
				@AuthenticationController.finishLogin.calledWith(@user).should.equal true

		describe 'when authenticate does not produce a user', ->

			beforeEach ->
				@info = {text: 'a', type: 'b'}
				@passport.authenticate.callsArgWith(1, null, false, @info)

			it 'should not call finishLogin', () ->
				@AuthenticationController.passportLogin @req, @res, @next
				@AuthenticationController.finishLogin.callCount.should.equal 0

			it 'should not send a json response with redirect', () ->
				@AuthenticationController.passportLogin @req, @res, @next
				@res.json.callCount.should.equal 1
				@res.json.calledWith({message: @info}).should.equal true
				expect(@res.json.lastCall.args[0].redir?).to.equal false

	describe 'afterLoginSessionSetup', ->

		beforeEach ->
			@req.login = sinon.stub().callsArgWith(1, null)
			@req.session = @session = {passport: {user: @user}}
			@req.session =
				passport: {user: {_id: "one"}}
			@req.session.destroy = sinon.stub().callsArgWith(0, null)
			@req.session.save = sinon.stub().callsArgWith(0, null)
			@req.sessionStore = {generate: sinon.stub()}
			@UserSessionsManager.trackSession = sinon.stub()
			@call = (callback) =>
				@AuthenticationController.afterLoginSessionSetup @req, @user, callback

		it 'should not produce an error', (done) ->
			@call (err) =>
				expect(err).to.equal null
				done()

		it 'should call req.login', (done) ->
			@call (err) =>
				@req.login.callCount.should.equal 1
				done()

		it 'should call req.session.save', (done) ->
			@call (err) =>
				@req.session.save.callCount.should.equal 1
				done()

		it 'should call UserSessionsManager.trackSession', (done) ->
			@call (err) =>
				@UserSessionsManager.trackSession.callCount.should.equal 1
				done()

		describe 'when req.session.save produces an error', ->

			beforeEach ->
				@req.session.save = sinon.stub().callsArgWith(0, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.be.oneOf [null, undefined]
					expect(err).to.be.instanceof Error
					done()

			it 'should not call UserSessionsManager.trackSession', (done) ->
				@call (err) =>
					@UserSessionsManager.trackSession.callCount.should.equal 0
					done()

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
			@Modules.hooks.fire = sinon.stub().callsArgWith(3, null, [])
			# @AuthenticationController.establishUserSession = sinon.stub().callsArg(2)
			@req.body =
				email: @email
				password: @password
				session:
					postLoginRedirect: "/path/to/redir/to"
			@cb = sinon.stub()

		describe "when the preDoPassportLogin hooks produce an info object", ->
			beforeEach ->
				@Modules.hooks.fire = sinon.stub().callsArgWith(3, null, [null, {redir: '/somewhere'}, null])

			it "should stop early and call done with this info object", (done) ->
				@AuthenticationController.doPassportLogin(@req, @req.body.email, @req.body.password, @cb)
				@cb.callCount.should.equal 1
				@cb.calledWith(null, false, {redir: '/somewhere'}).should.equal true
				@LoginRateLimiter.processLoginRequest.callCount.should.equal 0
				done()

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
				@req.sessionID = Math.random()
				@AuthenticationController.doPassportLogin(@req, @req.body.email, @req.body.password, @cb)

			it "should attempt to authorise the user", ->
				@AuthenticationManager.authenticate
					.calledWith(email: @email.toLowerCase(), @password)
					.should.equal true

			it "should establish the user's session", ->
				@cb.calledWith(null, @user).should.equal true

		describe '_loginAsyncHandlers', ->
			beforeEach ->
				@UserHandler.setupLoginData = sinon.stub()
				@LoginRateLimiter.recordSuccessfulLogin = sinon.stub()
				@AuthenticationController._recordSuccessfulLogin = sinon.stub()
				@AnalyticsManager.recordEvent = sinon.stub()
				@AnalyticsManager.identifyUser = sinon.stub()
				@AuthenticationController._loginAsyncHandlers(@req, @user)

			it "should call identifyUser", ->
				@AnalyticsManager.identifyUser.calledWith(@user._id, @req.sessionID).should.equal true

			it "should setup the user data in the background", ->
				@UserHandler.setupLoginData.calledWith(@user).should.equal true

			it "should set res.session.justLoggedIn", ->
				@req.session.justLoggedIn.should.equal true

			it "should record the successful login", ->
				@AuthenticationController._recordSuccessfulLogin
					.calledWith(@user._id)
					.should.equal true

			it "should tell the rate limiter that there was a success for that email", ->
				@LoginRateLimiter.recordSuccessfulLogin.calledWith(@user.email).should.equal true

			it "should log the successful login", ->
				@logger.log
					.calledWith(email: @user.email, user_id: @user._id.toString(), "successful log in")
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

	describe "requireOauth", ->
		beforeEach ->
			@res.send = sinon.stub()
			@res.status = sinon.stub().returns(@res)
			@middleware = @AuthenticationController.requireOauth()

		describe "when token not provided", ->
			beforeEach ->
				@middleware(@req, @res, @next)

			it "should return 401 error", ->
				@res.status.should.have.been.calledWith 401

		describe "when token provided", ->
			beforeEach ->
				@V1Api.request = sinon.stub().yields("error", {}, {})
				@req.token = "foo"
				@middleware(@req, @res, @next)

			it "should make request to v1 api with token", ->
				@V1Api.request.should.have.been.calledWith {
					expectedStatusCodes: [401]
					json: token: "foo"
					method: "POST"
					uri: "/api/v1/sharelatex/oauth_authorize"
				}

		describe "when v1 api returns error", ->
			beforeEach ->
				@V1Api.request = sinon.stub().yields("error", {}, {})
				@req.token = "foo"
				@middleware(@req, @res, @next)

			it "should return status", ->
				@next.should.have.been.calledWith "error"

		describe "when v1 api status code is not 200", ->
			beforeEach ->
				@V1Api.request = sinon.stub().yields(null, {statusCode: 401}, {})
				@req.token = "foo"
				@middleware(@req, @res, @next)

			it "should return status", ->
				@res.status.should.have.been.calledWith 401

		describe "when v1 api returns authorized profile and access token", ->
			beforeEach ->
				@oauth_authorize =
					access_token: "access_token"
					user_profile: id: "overleaf-id"
				@V1Api.request = sinon.stub().yields(null, {statusCode: 200}, @oauth_authorize)
				@req.token = "foo"

			describe "in all cases", ->
				beforeEach ->
					@middleware(@req, @res, @next)

				it "should find user", ->
					@UserModel.findOne.should.have.been.calledWithMatch { "overleaf.id": "overleaf-id" }

			describe "when user find returns error", ->
				beforeEach ->
					@UserModel.findOne = sinon.stub().yields("error")
					@middleware(@req, @res, @next)

				it "should return error", ->
					@next.should.have.been.calledWith "error"

			describe "when user is not found", ->
				beforeEach ->
					@UserModel.findOne = sinon.stub().yields(null, null)
					@middleware(@req, @res, @next)

				it "should return unauthorized", ->
					@res.status.should.have.been.calledWith 401

			describe "when user is found", ->
				beforeEach ->
					@UserModel.findOne = sinon.stub().yields(null, "user")
					@middleware(@req, @res, @next)

				it "should add user to request", ->
					@req.oauth_user.should.equal "user"

				it "should add access_token to request", ->
					@req.oauth.access_token.should.equal "access_token"

	describe "requireGlobalLogin", ->
		beforeEach ->
			@req.headers = {}
			@AuthenticationController.httpAuth = sinon.stub()
			@setRedirect = sinon.spy(@AuthenticationController, 'setRedirectInSession')

		afterEach ->
			@setRedirect.restore()

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

			it 'should have called setRedirectInSession', ->
				@setRedirect.callCount.should.equal 1

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
			@req.session.postLoginRedirect.should.equal '/target/url?extra_query=foo'
			@res.redirectedTo.should.equal "/register?extra_query=foo"

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
			@req.session.postLoginRedirect.should.equal '/target/url?extra_query=foo'
			@res.redirectedTo.should.equal "/login?extra_query=foo"


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


	describe 'setRedirectInSession', ->
		beforeEach ->
			@req = {session: {}}
			@req.path = "/somewhere"
			@req.query = {one: "1"}

		it 'should set redirect property on session', ->
			@AuthenticationController.setRedirectInSession(@req)
			expect(@req.session.postLoginRedirect).to.equal "/somewhere?one=1"

		it 'should set the supplied value', ->
			@AuthenticationController.setRedirectInSession(@req, '/somewhere/specific')
			expect(@req.session.postLoginRedirect).to.equal "/somewhere/specific"

		describe 'with a png', ->
			beforeEach ->
				@req = {session: {}}

			it 'should not set the redirect', ->
				@AuthenticationController.setRedirectInSession(@req, '/something.png')
				expect(@req.session.postLoginRedirect).to.equal undefined

		describe 'with a js path', ->

			beforeEach ->
				@req = {session: {}}

			it 'should not set the redirect', ->
				@AuthenticationController.setRedirectInSession(@req, '/js/something.js')
				expect(@req.session.postLoginRedirect).to.equal undefined

	describe '_getRedirectFromSession', ->
		beforeEach ->
			@req = {session: {postLoginRedirect: "/a?b=c"}}

		it 'should get redirect property from session', ->
			expect(@AuthenticationController._getRedirectFromSession(@req)).to.equal "/a?b=c"

	describe '_clearRedirectFromSession', ->
		beforeEach ->
			@req = {session: {postLoginRedirect: "/a?b=c"}}

		it 'should remove the redirect property from session', ->
			@AuthenticationController._clearRedirectFromSession(@req)
			expect(@req.session.postLoginRedirect).to.equal undefined


	describe 'finishLogin', ->
		# - get redirect
		# - async handlers
		# - afterLoginSessionSetup
		# - clear redirect
		# - issue redir, two ways
		beforeEach ->
			@AuthenticationController._getRedirectFromSession = sinon.stub().returns '/some/page'
			@AuthenticationController._loginAsyncHandlers = sinon.stub()
			@AuthenticationController.afterLoginSessionSetup = sinon.stub().callsArgWith(2, null)
			@AuthenticationController._clearRedirectFromSession = sinon.stub()
			@req.headers = {accept: 'application/json, whatever'}
			@res.json = sinon.stub()
			@res.redirect = sinon.stub()

		it 'should extract the redirect from the session', () ->
			@AuthenticationController.finishLogin(@user, @req, @res, @next)
			expect(@AuthenticationController._getRedirectFromSession.callCount).to.equal 1
			expect(@AuthenticationController._getRedirectFromSession.calledWith(@req)).to.equal true

		it 'should call the async handlers', () ->
			@AuthenticationController.finishLogin(@user, @req, @res, @next)
			expect(@AuthenticationController._loginAsyncHandlers.callCount).to.equal 1
			expect(@AuthenticationController._loginAsyncHandlers.calledWith(@req, @user)).to.equal true

		it 'should call afterLoginSessionSetup', () ->
			@AuthenticationController.finishLogin(@user, @req, @res, @next)
			expect(@AuthenticationController.afterLoginSessionSetup.callCount).to.equal 1
			expect(@AuthenticationController.afterLoginSessionSetup.calledWith(@req, @user)).to.equal true

		it 'should clear redirect from session', () ->
			@AuthenticationController.finishLogin(@user, @req, @res, @next)
			expect(@AuthenticationController._clearRedirectFromSession.callCount).to.equal 1
			expect(@AuthenticationController._clearRedirectFromSession.calledWith(@req)).to.equal true

		it 'should issue a json response with a redirect', () ->
			@AuthenticationController.finishLogin(@user, @req, @res, @next)
			expect(@res.json.callCount).to.equal 1
			expect(@res.redirect.callCount).to.equal 0
			expect(@res.json.calledWith({ redir: '/some/page' })).to.equal true

		describe 'with a non-json request', ->
			beforeEach ->
				@req.headers = {}
				@res.json = sinon.stub()
				@res.redirect = sinon.stub()

			it 'should issue a plain redirect', () ->
				@AuthenticationController.finishLogin(@user, @req, @res, @next)
				expect(@res.json.callCount).to.equal 0
				expect(@res.redirect.callCount).to.equal 1
				expect(@res.redirect.calledWith('/some/page')).to.equal true
