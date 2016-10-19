expect = require("chai").expect
async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
redis = require "./helpers/redis"



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
