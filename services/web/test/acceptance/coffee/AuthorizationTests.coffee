request = require("request")
expect = require("chai").expect
async = require "async"

count = 0
BASE_URL = "http://localhost:3000"

request = request.defaults({
	baseUrl: BASE_URL,
	followRedirect: false
})

class User
	constructor: (options = {}) ->
		@email = "acceptance-test-#{count}@example.com"
		@password = "acceptance-test-#{count}-password"
		count++
		@jar = request.jar()
		@request = request.defaults({
			jar: @jar
		})
	
	login: (callback = (error) ->) ->
		@getCsrfToken (error) =>
			return callback(error) if error?
			@request.post {
				url: "/register" # Register will log in, but also ensure user exists
				json:
					email: @email
					password: @password
			}, (error, response, body) =>
				return callback(error) if error?
				callback()
	
	createProject: (name, callback = (error, project_id) ->) ->
		@request.post {
			url: "/project/new",
			json:
				projectName: name
		}, (error, response, body) ->
			return callback(error) if error?
			callback(null, body.project_id)
	
	addUserToProject: (project_id, email, privileges, callback = (error, user) ->) ->
		@request.post {
			url: "/project/#{project_id}/users",
			json: {email, privileges}
		}, (error, response, body) ->
			return callback(error) if error?
			callback(null, body.user)
	
	getCsrfToken: (callback = (error) ->) ->
		@request.get {
			url: "/register"
		}, (err, response, body) =>
			return callback(error) if error?
			csrfMatches = body.match("window.csrfToken = \"(.*?)\";")
			if !csrfMatches?
				return callback(new Error("no csrf token found"))
			@request = @request.defaults({
				headers:
					"x-csrf-token": csrfMatches[1]
			})
			callback()

try_read_access = (requester, project_id, test, callback) ->
	async.parallel [
		(cb) ->
			requester.get "/project/#{project_id}", (error, response, body) ->
				return cb(error) if error?
				test(response, body)
				cb()
		(cb) ->
			requester.get "/project/#{project_id}/download/zip", (error, response, body) ->
				return cb(error) if error?
				test(response, body)
				cb()
	], callback

try_write_access = (requester, project_id, test, callback) ->
	async.parallel [
		(cb) ->
			requester.post {
				uri: "/project/#{project_id}/settings"
				json:
					compiler: "latex"
			}, (error, response, body) ->
				return cb(error) if error?
				test(response, body)
				cb()
	], callback

try_admin_access = (requester, project_id, test, callback) ->
	async.parallel [
		(cb) ->
			requester.post {
				uri: "/project/#{project_id}/rename"
				json:
					newProjectName: "new-name"
			}, (error, response, body) ->
				return cb(error) if error?
				test(response, body)
				cb()
	], callback

expect_read_access = (requester, project_id, callback) ->
	try_read_access(requester, project_id, (response, body) ->
		expect(response.statusCode).to.be.oneOf [200, 204]
	, callback)

expect_write_access = (requester, project_id, callback) ->
	try_write_access(requester, project_id, (response, body) ->
		expect(response.statusCode).to.be.oneOf [200, 204]
	, callback)

expect_admin_access = (requester, project_id, callback) ->
	try_admin_access(requester, project_id, (response, body) ->
		expect(response.statusCode).to.be.oneOf [200, 204]
	, callback)

expect_no_read_access = (requester, project_id, callback) ->
	try_read_access(requester, project_id, (response, body) ->
		expect(response.statusCode).to.equal 302
		expect(response.headers.location).to.equal "/restricted"
	, callback)

expect_no_write_access = (requester, project_id, callback) ->
	try_write_access(requester, project_id, (response, body) ->
		expect(response.statusCode).to.equal 302
		expect(response.headers.location).to.equal "/restricted"
	, callback)

expect_no_admin_access = (requester, project_id, callback) ->
	try_admin_access(requester, project_id, (response, body) ->
		expect(response.statusCode).to.equal 302
		expect(response.headers.location).to.equal "/restricted"
	, callback)

expect_no_anonymous_read_access = (requester, project_id, callback) ->
	try_read_access(requester, project_id, (response, body) ->
		expect(response.statusCode).to.equal 302
		expect(response.headers.location).to.equal "/login"
	, callback)

expect_no_anonymous_write_access = (requester, project_id, callback) ->
	try_write_access(requester, project_id, (response, body) ->
		expect(response.statusCode).to.equal 302
		expect(response.headers.location).to.equal "/login"
	, callback)

expect_no_anonymous_admin_access = (requester, project_id, callback) ->
	try_admin_access(requester, project_id, (response, body) ->
		expect(response.statusCode).to.equal 302
		expect(response.headers.location).to.equal "/login"
	, callback)

describe "Authorization", ->
	before (done) ->
		@timeout(10000)
		@owner = new User()
		@other1 = new User()
		@other2 = new User()
		@anon = new User()
		async.parallel [
			(cb) => @owner.login cb
			(cb) => @other1.login cb
			(cb) => @other2.login cb
			(cb) => @anon.getCsrfToken cb
		], done

	describe "private project", ->
		before (done) ->
			@owner.createProject "private-project", (error, project_id) =>
				return done(error) if error?
				@project_id = project_id
				done()
				
		it "should allow the owner read access to it", (done) ->
			expect_read_access @owner.request, @project_id, done
			
		it "should allow the owner write access to it", (done) ->
			expect_write_access @owner.request, @project_id, done
		
		it "should allow the owner admin access to it", (done) ->
			expect_admin_access @owner.request, @project_id, done
			
		it "should not allow another user read access to it", (done) ->
			expect_no_read_access(@other1.request, @project_id, done)
			
		it "should not allow another user write access to it", (done) ->
			expect_no_write_access(@other1.request, @project_id, done)
			
		it "should not allow another user admin access to it", (done) ->
			expect_no_admin_access(@other1.request, @project_id, done)
			
		it "should not allow anonymous user read access to it", (done) ->
			expect_no_anonymous_read_access(@anon.request, @project_id, done)
			
		it "should not allow anonymous user write access to it", (done) ->
			expect_no_anonymous_write_access(@anon.request, @project_id, done)
			
		it "should not allow anonymous user write access to it", (done) ->
			expect_no_anonymous_admin_access(@anon.request, @project_id, done)

	describe "shared project", ->
		before (done) ->
			@rw_user = @other1
			@ro_user = @other2
			@owner.createProject "private-project", (error, project_id) =>
				return done(error) if error?
				@project_id = project_id
				@owner.addUserToProject @project_id, @ro_user.email, "readOnly", (error) =>
					return done(error) if error?
					@owner.addUserToProject @project_id, @rw_user.email, "readAndWrite", (error) =>
						return done(error) if error?
						done()

		it "should allow the read-only user read access to it", (done) ->
			expect_read_access @ro_user.request, @project_id, done
			
		it "should not allow the read-only user write access to it", (done) ->
			expect_no_write_access @ro_user.request, @project_id, done
		
		it "should not allow the read-only user admin access to it", (done) ->
			expect_no_admin_access @ro_user.request, @project_id, done

		it "should allow the read-write user read access to it", (done) ->
			expect_read_access @rw_user.request, @project_id, done

		it "should allow the read-write user write access to it", (done) ->
			expect_write_access @rw_user.request, @project_id, done

		it "should not allow the read-write user admin access to it", (done) ->
			expect_no_admin_access @rw_user.request, @project_id, done

		