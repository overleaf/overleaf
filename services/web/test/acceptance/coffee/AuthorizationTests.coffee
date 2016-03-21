expect = require("chai").expect
async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"

try_read_access = (user, project_id, test, callback) ->
	async.series [
		(cb) ->
			user.request.get "/project/#{project_id}", (error, response, body) ->
				return cb(error) if error?
				test(response, body)
				cb()
		(cb) ->
			user.request.get "/project/#{project_id}/download/zip", (error, response, body) ->
				return cb(error) if error?
				test(response, body)
				cb()
	], callback

try_settings_write_access = (user, project_id, test, callback) ->
	async.series [
		(cb) ->
			user.request.post {
				uri: "/project/#{project_id}/settings"
				json:
					compiler: "latex"
			}, (error, response, body) ->
				return cb(error) if error?
				test(response, body)
				cb()
	], callback

try_admin_access = (user, project_id, test, callback) ->
	async.series [
		(cb) ->
			user.request.post {
				uri: "/project/#{project_id}/rename"
				json:
					newProjectName: "new-name"
			}, (error, response, body) ->
				return cb(error) if error?
				test(response, body)
				cb()
		(cb) ->
			user.request.post {
				uri: "/project/#{project_id}/settings/admin"
				json:
					publicAccessLevel: "private"
			}, (error, response, body) ->
				return cb(error) if error?
				test(response, body)
				cb()
	], callback

try_content_access = (user, project_id, test, callback) ->
	# The real-time service calls this end point to determine the user's 
	# permissions.
	request.post {
		url: "/project/#{project_id}/join"
		qs: {user_id: user.id}
		auth:
			user: settings.apis.web.user
			pass: settings.apis.web.pass
			sendImmediately: true
		json: true
		jar: false
	}, (error, response, body) ->
		return callback(error) if error?
		test(response, body)
		callback()

expect_read_access = (user, project_id, callback) ->
	async.series [
		(cb) ->
			try_read_access(user, project_id, (response, body) ->
				expect(response.statusCode).to.be.oneOf [200, 204]
			, cb)
		(cb) ->
			try_content_access(user, project_id, (response, body) ->
				expect(body.privilegeLevel).to.be.oneOf ["owner", "readAndWrite", "readOnly"]
			, cb)
	], callback

expect_content_write_access = (user, project_id, callback) ->
	try_content_access(user, project_id, (response, body) ->
		expect(body.privilegeLevel).to.be.oneOf ["owner", "readAndWrite"]
	, callback)

expect_settings_write_access = (user, project_id, callback) ->
	try_settings_write_access(user, project_id, (response, body) ->
		expect(response.statusCode).to.be.oneOf [200, 204]
	, callback)

expect_admin_access = (user, project_id, callback) ->
	try_admin_access(user, project_id, (response, body) ->
		expect(response.statusCode).to.be.oneOf [200, 204]
	, callback)

expect_no_read_access = (user, project_id, options, callback) ->
	async.series [
		(cb) ->
			try_read_access(user, project_id, (response, body) ->
				expect(response.statusCode).to.equal 302
				expect(response.headers.location).to.match new RegExp(options.redirect_to)
			, cb)
		(cb) ->
			try_content_access(user, project_id, (response, body) ->
				expect(body.privilegeLevel).to.be.equal false
			, cb)
	], callback

expect_no_content_write_access = (user, project_id, callback) ->
	try_content_access(user, project_id, (response, body) ->
		expect(body.privilegeLevel).to.be.oneOf [false, "readOnly"]
	, callback)

expect_no_settings_write_access = (user, project_id, options, callback) ->
	try_settings_write_access(user, project_id, (response, body) ->
		expect(response.statusCode).to.equal 302
		expect(response.headers.location).to.match new RegExp(options.redirect_to)
	, callback)

expect_no_admin_access = (user, project_id, options, callback) ->
	try_admin_access(user, project_id, (response, body) ->
		expect(response.statusCode).to.equal 302
		expect(response.headers.location).to.match new RegExp(options.redirect_to)
	, callback)

describe "Authorization", ->
	before (done) ->
		@timeout(10000)
		@owner = new User()
		@other1 = new User()
		@other2 = new User()
		@anon = new User()
		@site_admin = new User({email: "admin@example.com"})
		async.parallel [
			(cb) => @owner.login cb
			(cb) => @other1.login cb
			(cb) => @other2.login cb
			(cb) => @anon.getCsrfToken cb
			(cb) =>
				@site_admin.login (err) =>
					return cb(err) if error?
					@site_admin.ensure_admin cb
		], done

	describe "private project", ->
		before (done) ->
			@owner.createProject "private-project", (error, project_id) =>
				return done(error) if error?
				@project_id = project_id
				done()
				
		it "should allow the owner read access to it", (done) ->
			expect_read_access @owner, @project_id, done
			
		it "should allow the owner write access to its content", (done) ->
			expect_content_write_access @owner, @project_id, done
			
		it "should allow the owner write access to its settings", (done) ->
			expect_settings_write_access @owner, @project_id, done
		
		it "should allow the owner admin access to it", (done) ->
			expect_admin_access @owner, @project_id, done
			
		it "should not allow another user read access to the project", (done) ->
			expect_no_read_access @other1, @project_id, redirect_to: "/restricted", done
			
		it "should not allow another user write access to its content", (done) ->
			expect_no_content_write_access @other1, @project_id, done
			
		it "should not allow another user write access to its settings", (done) ->
			expect_no_settings_write_access @other1, @project_id, redirect_to: "/restricted", done
			
		it "should not allow another user admin access to it", (done) ->
			expect_no_admin_access @other1, @project_id, redirect_to: "/restricted", done
			
		it "should not allow anonymous user read access to it", (done) ->
			expect_no_read_access @anon, @project_id, redirect_to: "/restricted", done
			
		it "should not allow anonymous user write access to its content", (done) ->
			expect_no_content_write_access @anon, @project_id, done
			
		it "should not allow anonymous user write access to its settings", (done) ->
			expect_no_settings_write_access @anon, @project_id, redirect_to: "/restricted", done
			
		it "should not allow anonymous user admin access to it", (done) ->
			expect_no_admin_access @anon, @project_id, redirect_to: "/restricted", done
		
		it "should allow site admin users read access to it", (done) ->
			expect_read_access @site_admin, @project_id, done
			
		it "should allow site admin users write access to its content", (done) ->
			expect_content_write_access @site_admin, @project_id, done
			
		it "should allow site admin users write access to its settings", (done) ->
			expect_settings_write_access @site_admin, @project_id, done
		
		it "should allow site admin users admin access to it", (done) ->
			expect_admin_access @site_admin, @project_id, done
			

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
			expect_read_access @ro_user, @project_id, done
		
		it "should not allow the read-only user write access to its content", (done) ->
			expect_no_content_write_access @ro_user, @project_id, done
			
		it "should not allow the read-only user write access to its settings", (done) ->
			expect_no_settings_write_access @ro_user, @project_id, redirect_to: "/restricted", done
		
		it "should not allow the read-only user admin access to it", (done) ->
			expect_no_admin_access @ro_user, @project_id, redirect_to: "/restricted", done

		it "should allow the read-write user read access to it", (done) ->
			expect_read_access @rw_user, @project_id, done
		
		it "should allow the read-write user write access to its content", (done) ->
			expect_content_write_access @rw_user, @project_id, done

		it "should allow the read-write user write access to its settings", (done) ->
			expect_settings_write_access @rw_user, @project_id, done

		it "should not allow the read-write user admin access to it", (done) ->
			expect_no_admin_access @rw_user, @project_id, redirect_to: "/restricted", done

	describe "public read-write project", ->
		before (done) ->
			@owner.createProject "public-rw-project", (error, project_id) =>
				return done(error) if error?
				@project_id = project_id
				@owner.makePublic @project_id, "readAndWrite", done

		it "should allow a user read access to it", (done) ->
			expect_read_access @other1, @project_id, done
			
		it "should allow a user write access to its content", (done) ->
			expect_content_write_access @other1, @project_id, done
			
		it "should not allow a user write access to its settings", (done) ->
			expect_no_settings_write_access @other1, @project_id, redirect_to: "/restricted", done
		
		it "should not allow a user admin access to it", (done) ->
			expect_no_admin_access @other1, @project_id, redirect_to: "/restricted", done

		it "should allow an anonymous user read access to it", (done) ->
			expect_read_access @anon, @project_id, done
			
		it "should allow an anonymous user write access to its content", (done) ->
			expect_content_write_access @anon, @project_id, done
			
		it "should not allow an anonymous user write access to its settings", (done) ->
			expect_no_settings_write_access @anon, @project_id, redirect_to: "/restricted", done
			
		it "should not allow an anonymous user admin access to it", (done) ->
			expect_no_admin_access @anon, @project_id, redirect_to: "/restricted", done

	describe "public read-only project", ->
		before (done) ->
			@owner.createProject "public-ro-project", (error, project_id) =>
				return done(error) if error?
				@project_id = project_id
				@owner.makePublic @project_id, "readOnly", done

		it "should allow a user read access to it", (done) ->
			expect_read_access @other1, @project_id, done
			
		it "should not allow a user write access to its content", (done) ->
			expect_no_content_write_access @other1, @project_id, done
			
		it "should not allow a user write access to its settings", (done) ->
			expect_no_settings_write_access @other1, @project_id, redirect_to: "/restricted", done
		
		it "should not allow a user admin access to it", (done) ->
			expect_no_admin_access @other1, @project_id, redirect_to: "/restricted", done

		it "should allow an anonymous user read access to it", (done) ->
			expect_read_access @anon, @project_id, done
			
		it "should not allow an anonymous user write access to its content", (done) ->
			expect_no_content_write_access @anon, @project_id, done
			
		it "should not allow an anonymous user write access to its settings", (done) ->
			expect_no_settings_write_access @anon, @project_id, redirect_to: "/restricted", done
			
		it "should not allow an anonymous user admin access to it", (done) ->
			expect_no_admin_access @anon, @project_id, redirect_to: "/restricted", done