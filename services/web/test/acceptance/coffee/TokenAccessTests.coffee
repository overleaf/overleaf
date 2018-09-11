expect = require("chai").expect
async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
{db, ObjectId} = require("../../../app/js/infrastructure/mongojs")

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

try_read_only_token_access = (user, token, test, callback) ->
	async.series [
		(cb) ->
			user.request.get "/read/#{token}", (error, response, body) ->
				return cb(error) if error?
				test(response, body)
				cb()
	], callback

try_read_and_write_token_access = (user, token, test, callback) ->
	async.series [
		(cb) ->
			user.request.get "/#{token}", (error, response, body) ->
				return cb(error) if error?
				test(response, body)
				cb()
	], callback

try_content_access = (user, project_id, test, callback) ->
	# The real-time service calls this end point to determine the user's 
	# permissions.
	if user.id?
		user_id = user.id
	else
		user_id = "anonymous-user"
	request.post {
		url: "/project/#{project_id}/join"
		qs: {user_id}
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

try_anon_content_access = (user, project_id, token, test, callback) ->
	# The real-time service calls this end point to determine the user's 
	# permissions.
	if user.id?
		user_id = user.id
	else
		user_id = "anonymous-user"
	request.post {
		url: "/project/#{project_id}/join"
		qs: {user_id}
		auth:
			user: settings.apis.web.user
			pass: settings.apis.web.pass
			sendImmediately: true
		headers:
			'x-sl-anonymous-access-token': token
		json: true
		jar: false
	}, (error, response, body) ->
		return callback(error) if error?
		test(response, body)
		callback()


describe 'TokenAccess', ->
	before (done) ->
		@timeout(90000)
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

	describe 'no token-access', ->
		before (done) ->
			@owner.createProject "token-ro-test#{Math.random()}", (err, project_id) =>
				return done(err) if err?
				@project_id = project_id
				# Note, never made token-based,
				# thus no tokens
				done()

		it 'should deny access ', (done) ->
			try_read_access(@other1, @project_id, (response, body) =>
				expect(response.statusCode).to.equal 302
				expect(body).to.match /.*\/restricted.*/
			, done)

		it 'should not allow the user to join the project', (done) ->
			try_content_access(@other1, @project_id, (response, body) =>
				expect(body.privilegeLevel).to.equal false
			, done)


	describe 'read-only token', ->
		before (done) ->
			@owner.createProject "token-ro-test#{Math.random()}", (err, project_id) =>
				return done(err) if err?
				@project_id = project_id
				@owner.makeTokenBased @project_id, (err) =>
					return done(err) if err?
					@owner.getProject @project_id, (err, project) =>
						return done(err) if err?
						@tokens = project.tokens
						done()

		it 'should deny access before the token is used', (done) ->
			try_read_access(@other1, @project_id, (response, body) =>
				expect(response.statusCode).to.equal 302
				expect(body).to.match /.*\/restricted.*/
			, done)

		it 'should allow the user to access project via read-only token url', (done) ->
			try_read_only_token_access(@other1, @tokens.readOnly, (response, body) =>
				expect(response.statusCode).to.equal 200
			, done)

		it 'should allow the user to join the project with read-only access', (done) ->
			try_content_access(@other1, @project_id, (response, body) =>
				expect(body.privilegeLevel).to.equal 'readOnly'
			, done)

		describe 'made private again', ->
			before (done) ->
				@owner.makePrivate @project_id, () -> setTimeout(done, 1000)

			it 'should deny access to project', (done) ->
				try_read_access(@other1, @project_id, (response, body) =>
					expect(response.statusCode).to.equal 302
					expect(body).to.match /.*\/restricted.*/
				, done)

			it 'should not allow the user to access read-only token', (done) ->
				try_read_only_token_access(@other1, @tokens.readOnly, (response, body) =>
					expect(response.statusCode).to.equal 404
				, done)

			it 'should not allow the user to join the project', (done) ->
				try_content_access(@other1, @project_id, (response, body) =>
					expect(body.privilegeLevel).to.equal false
				, done)

	describe 'anonymous read-only token', ->
		before (done) ->
			@owner.createProject "token-anon-ro-test#{Math.random()}", (err, project_id) =>
				return done(err) if err?
				@project_id = project_id
				@owner.makeTokenBased @project_id, (err) =>
					return done(err) if err?
					@owner.getProject @project_id, (err, project) =>
						return done(err) if err?
						@tokens = project.tokens
						done()

		it 'should deny access before the token is used', (done) ->
			try_read_access(@anon, @project_id, (response, body) =>
				expect(response.statusCode).to.equal 302
				expect(body).to.match /.*\/restricted.*/
			, done)

		it 'should allow the user to access project via read-only token url', (done) ->
			try_read_only_token_access(@anon, @tokens.readOnly, (response, body) =>
				expect(response.statusCode).to.equal 200
			, done)

		it 'should allow the user to anonymously join the project with read-only access', (done) ->
			try_anon_content_access(@anon, @project_id, @tokens.readOnly, (response, body) =>
				expect(body.privilegeLevel).to.equal 'readOnly'
			, done)

		describe 'made private again', ->
			before (done) ->
				@owner.makePrivate @project_id, () -> setTimeout(done, 1000)

			it 'should deny access to project', (done) ->
				try_read_access(@anon, @project_id, (response, body) =>
					expect(response.statusCode).to.equal 302
					expect(body).to.match /.*\/restricted.*/
				, done)

			it 'should not allow the user to access read-only token', (done) ->
				try_read_only_token_access(@anon, @tokens.readOnly, (response, body) =>
					expect(response.statusCode).to.equal 404
				, done)

			it 'should not allow the user to join the project', (done) ->
				try_anon_content_access(@anon, @project_id, @tokens.readOnly, (response, body) =>
					expect(body.privilegeLevel).to.equal false
				, done)

	describe 'read-and-write token', ->
		before (done) ->
			@owner.createProject "token-rw-test#{Math.random()}", (err, project_id) =>
				return done(err) if err?
				@project_id = project_id
				@owner.makeTokenBased @project_id, (err) =>
					return done(err) if err?
					@owner.getProject @project_id, (err, project) =>
						return done(err) if err?
						@tokens = project.tokens
						done()

		it 'should deny access before the token is used', (done) ->
			try_read_access(@other1, @project_id, (response, body) =>
				expect(response.statusCode).to.equal 302
				expect(response.headers.location).to.match /\/restricted.*/
				expect(body).to.match /.*\/restricted.*/
			, done)

		it 'should allow the user to access project via read-and-write token url', (done) ->
			try_read_and_write_token_access(@other1, @tokens.readAndWrite, (response, body) =>
				expect(response.statusCode).to.equal 200
			, done)

		it 'should allow the user to join the project with read-and-write access', (done) ->
			try_content_access(@other1, @project_id, (response, body) =>
				expect(body.privilegeLevel).to.equal 'readAndWrite'
			, done)

		describe 'made private again', ->
			before (done) ->
				@owner.makePrivate @project_id, () -> setTimeout(done, 1000)

			it 'should deny access to project', (done) ->
				try_read_access(@other1, @project_id, (response, body) =>
					expect(response.statusCode).to.equal 302
					expect(body).to.match /.*\/restricted.*/
				, done)

			it 'should not allow the user to access read-and-write token', (done) ->
				try_read_and_write_token_access(@other1, @tokens.readAndWrite, (response, body) =>
					expect(response.statusCode).to.equal 404
				, done)

			it 'should not allow the user to join the project', (done) ->
				try_content_access(@other1, @project_id, (response, body) =>
					expect(body.privilegeLevel).to.equal false
				, done)

	if !settings.allowAnonymousReadAndWriteSharing
		describe 'anonymous read-and-write token, disabled', ->
			before (done) ->
				@owner.createProject "token-anon-rw-test#{Math.random()}", (err, project_id) =>
					return done(err) if err?
					@project_id = project_id
					@owner.makeTokenBased @project_id, (err) =>
						return done(err) if err?
						@owner.getProject @project_id, (err, project) =>
							return done(err) if err?
							@tokens = project.tokens
							done()

			it 'should deny access before the token is used', (done) ->
				try_read_access(@anon, @project_id, (response, body) =>
					expect(response.statusCode).to.equal 302
					expect(body).to.match /.*\/restricted.*/
				, done)

			it 'should not allow the user to access read-and-write token', (done) ->
				try_read_and_write_token_access(@anon, @tokens.readAndWrite, (response, body) =>
					expect(response.statusCode).to.equal 302
					expect(body).to.match /.*\/restricted.*/
				, done)

			it 'should not allow the user to join the project', (done) ->
				try_anon_content_access(@anon, @project_id, @tokens.readAndWrite, (response, body) =>
					expect(body.privilegeLevel).to.equal false
				, done)

	else
		describe 'anonymous read-and-write token, enabled', ->
			before (done) ->
				@owner.createProject "token-anon-rw-test#{Math.random()}", (err, project_id) =>
					return done(err) if err?
					@project_id = project_id
					@owner.makeTokenBased @project_id, (err) =>
						return done(err) if err?
						@owner.getProject @project_id, (err, project) =>
							return done(err) if err?
							@tokens = project.tokens
							done()

			it 'should deny access before the token is used', (done) ->
				try_read_access(@anon, @project_id, (response, body) =>
					expect(response.statusCode).to.equal 302
					expect(body).to.match /.*\/restricted.*/
				, done)

			it 'should allow the user to access project via read-and-write token url', (done) ->
				try_read_and_write_token_access(@anon, @tokens.readAndWrite, (response, body) =>
					expect(response.statusCode).to.equal 200
				, done)

			it 'should allow the user to anonymously join the project with read-and-write access', (done) ->
				try_anon_content_access(@anon, @project_id, @tokens.readAndWrite, (response, body) =>
					expect(body.privilegeLevel).to.equal 'readAndWrite'
				, done)

			describe 'made private again', ->
				before (done) ->
					@owner.makePrivate @project_id, () -> setTimeout(done, 1000)

				it 'should deny access to project', (done) ->
					try_read_access(@anon, @project_id, (response, body) =>
						expect(response.statusCode).to.equal 302
						expect(body).to.match /.*\/restricted.*/
					, done)

				it 'should not allow the user to access read-and-write token', (done) ->
					try_read_and_write_token_access(@anon, @tokens.readAndWrite, (response, body) =>
						expect(response.statusCode).to.equal 404
					, done)

				it 'should not allow the user to join the project', (done) ->
					try_anon_content_access(@anon, @project_id, @tokens.readAndWrite, (response, body) =>
						expect(body.privilegeLevel).to.equal false
					, done)


	describe 'private overleaf project', ->
		before (done) ->
			@owner.createProject 'overleaf-import', (err, project_id) =>
				@project_id = project_id
				@owner.makeTokenBased @project_id, (err) =>
					@owner.getProject @project_id, (err, project) =>
						@tokens = project.tokens
						@owner.makePrivate @project_id, () =>
							db.projects.update {_id: project._id}, {
								$set: {
									overleaf: {id: 1234}
								}
							}, (err) =>
								done()

		it 'should redirect to canonical path, when owner uses read-write token', (done) ->
			try_read_and_write_token_access(@owner, @tokens.readAndWrite, (response, body) =>
				expect(response.statusCode).to.equal 302
				expect(response.headers.location).to.equal "/project/#{@project_id}"
			, done)

		it 'should allow the owner access to the project', (done) ->
			try_read_access(@owner, @project_id, (response, body) =>
				expect(response.statusCode).to.equal 200
			, done)

		it 'should allow owner to join the project', (done) ->
			try_content_access(@owner, @project_id, (response, body) =>
				expect(body.privilegeLevel).to.equal 'owner'
			, done)

		it 'should not allow other user to join the project', (done) ->
			try_content_access(@other2, @project_id, (response, body) =>
				expect(body.privilegeLevel).to.equal false
			, done)

	describe 'private project, with higher access', ->
		before (done) ->
			@owner.createProject "higher-access-test-#{Math.random()}", (err, project_id) =>
				@project_id = project_id
				@owner.addUserToProject @project_id, @other1, 'readAndWrite', (err) =>
					@owner.makeTokenBased @project_id, (err) =>
						@owner.getProject @project_id, (err, project) =>
							@tokens = project.tokens
							@owner.makePrivate @project_id, () =>
								setTimeout done, 1000

		it 'should redirect to canonical path, when user uses read-write token', (done) ->
			try_read_and_write_token_access(@other1, @tokens.readAndWrite, (response, body) =>
				expect(response.statusCode).to.equal 302
				expect(response.headers.location).to.equal "/project/#{@project_id}"
			, done)

		it 'should redirect to canonical path, when user uses read-only token', (done) ->
			try_read_only_token_access(@other1, @tokens.readOnly, (response, body) =>
				expect(response.statusCode).to.equal 302
				expect(response.headers.location).to.equal "/project/#{@project_id}"
			, done)

		it 'should allow the user access to the project', (done) ->
			try_read_access(@other1, @project_id, (response, body) =>
				expect(response.statusCode).to.equal 200
			, done)

		it 'should allow user to join the project', (done) ->
			try_content_access(@other1, @project_id, (response, body) =>
				expect(body.privilegeLevel).to.equal 'readAndWrite'
			, done)

		it 'should not allow a different user to join the project', (done) ->
			try_content_access(@other2, @project_id, (response, body) =>
				expect(body.privilegeLevel).to.equal false
			, done)

	describe 'unimported v1 project', ->
		it 'should redirect to v1', (done) ->
			unimportedV1Token = '123abc'
			try_read_and_write_token_access(@owner, unimportedV1Token, (response, body) =>
				expect(response.statusCode).to.equal 302
			, done)
