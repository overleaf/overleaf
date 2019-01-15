expect = require("chai").expect
assert = require("chai").assert
async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
redis = require "./helpers/redis"
_ = require 'lodash'

# Currently this is testing registration via the 'public-registration' module,
# whereas in production we're using the 'overleaf-integration' module.

# Expectations
expectProjectAccess = (user, projectId, callback=(err,result)->) ->
	# should have access to project
	user.openProject projectId, (err) =>
		expect(err).to.be.oneOf [null, undefined]
		callback()

expectNoProjectAccess = (user, projectId, callback=(err,result)->) ->
	# should not have access to project page
	user.openProject projectId, (err) =>
		expect(err).to.be.instanceof Error
		callback()

# Actions
tryLoginThroughRegistrationForm = (user, email, password, callback=(err, response, body)->) ->
	user.getCsrfToken (err) ->
		return callback(err) if err?
		user.request.post {
			url: "/register"
			json:
				email: email
				password: password
		}, callback


describe "LoginRateLimit", ->

	before ->
		@user = new User()
		@badEmail = 'bademail@example.com'
		@badPassword = 'badpassword'

	it 'should rate limit login attempts after 10 within two minutes', (done) ->
		@user.request.get '/login', (err, res, body) =>
			async.timesSeries(
				15
				, (n, cb) =>
					@user.getCsrfToken (error) =>
						return cb(error) if error?
						@user.request.post {
							url: "/login"
							json:
								email: @badEmail
								password: @badPassword
						}, (err, response, body) =>
							cb(null, body?.message?.text)
				, (err, results) =>
					# ten incorrect-credentials messages, then five rate-limit messages
					expect(results.length).to.equal 15
					assert.deepEqual(
						results,
						_.concat(
							_.fill([1..10], 'Your email or password is incorrect. Please try again'),
							_.fill([1..5], 'This account has had too many login requests. Please wait 2 minutes before trying to log in again')
						)
					)
					done()
			)


describe "CSRF protection", ->

	beforeEach ->
		@user = new User()
		@email = "test+#{Math.random()}@example.com"
		@password = "password11"

	afterEach ->
		@user.full_delete_user(@email)

	it 'should register with the csrf token', (done) ->
		@user.request.get '/login', (err, res, body) =>
			@user.getCsrfToken (error) =>
				@user.request.post {
					url: "/register"
					json:
						email: @email
						password: @password
					headers:{
						"x-csrf-token": @user.csrfToken
					}
				}, (error, response, body) =>
					expect(err?).to.equal false
					expect(response.statusCode).to.equal 200
					done()

	it 'should fail with no csrf token', (done) ->
		@user.request.get '/login', (err, res, body) =>
			@user.getCsrfToken (error) =>
				@user.request.post {
					url: "/register"
					json:
						email: @email
						password: @password
					headers:{
						"x-csrf-token": ""
					}
				}, (error, response, body) =>
					expect(response.statusCode).to.equal 403
					done()

	it 'should fail with a stale csrf token', (done) ->
		@user.request.get '/login', (err, res, body) =>
			@user.getCsrfToken (error) =>
				oldCsrfToken = @user.csrfToken
				@user.logout (err) =>
					@user.request.post {
						url: "/register"
						json:
							email: @email
							password: @password
						headers:{
							"x-csrf-token": oldCsrfToken
						}
					}, (error, response, body) =>
						expect(response.statusCode).to.equal 403
						done()

describe "Register", ->
	before ->
		@user = new User()

	it 'Set emails attribute', (done) ->
		@user.register (error, user) =>
			expect(error).to.not.exist
			user.email.should.equal @user.email
			user.emails.should.exist
			user.emails.should.be.a 'array'
			user.emails.length.should.equal 1
			user.emails[0].email.should.equal @user.email
			done()

describe "Register with bonus referal id", ->
	before (done) ->
		@user1 = new User()
		@user2 = new User()
		async.series [
			(cb) => @user1.register cb
			(cb) => @user2.registerWithQuery '?r=' + @user1.referal_id  + '&rm=d&rs=b', cb
		], done

	it 'Adds a referal when an id is supplied and the referal source is "bonus"', (done) ->
		@user1.get (error, user) =>
			expect(error).to.not.exist
			user.refered_user_count.should.eql 1

			done()

describe "LoginViaRegistration", ->

	before (done) ->
		@timeout(60000)
		@user1 = new User()
		@user2 = new User()
		async.series [
			(cb) => @user1.login cb
			(cb) => @user1.logout cb
			(cb) => redis.clearUserSessions @user1, cb
			(cb) => @user2.login cb
			(cb) => @user2.logout cb
			(cb) => redis.clearUserSessions @user2, cb
		], done
		@project_id = null

	describe "[Security] Trying to register/login as another user", ->

		it 'should not allow sign in with secondary email', (done) ->
			secondaryEmail = "acceptance-test-secondary@example.com"
			@user1.addEmail secondaryEmail, (err) =>
				@user1.loginWith secondaryEmail, (err) =>
					expect(err?).to.equal false
					@user1.isLoggedIn (err, isLoggedIn) ->
						expect(isLoggedIn).to.equal false
						done()

		it 'should have user1 login', (done) ->
			@user1.login (err) ->
				expect(err?).to.equal false
				done()

		it 'should have user1 create a project', (done) ->
			@user1.createProject 'Private Project', (err, project_id) =>
				expect(err?).to.equal false
				@project_id = project_id
				done()

		it 'should ensure user1 can access their project', (done) ->
			expectProjectAccess @user1, @project_id, done

		it 'should ensure user2 cannot access the project', (done) ->
			expectNoProjectAccess @user2, @project_id, done

		it 'should prevent user2 from login/register with user1 email address', (done) ->
			tryLoginThroughRegistrationForm @user2, @user1.email, 'totally_not_the_right_password', (err, response, body) =>
				expect(body.redir?).to.equal false
				expect(body.message?).to.equal true
				expect(body.message).to.have.all.keys('type', 'text')
				expect(body.message.type).to.equal 'error'
				done()

		it 'should still ensure user2 cannot access the project', (done) ->
			expectNoProjectAccess @user2, @project_id, done
