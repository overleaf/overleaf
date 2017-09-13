assert = require('chai').assert
async = require('async')
User = require('./helpers/User')
request = require('./helpers/request')

assert_has_common_headers = (response) ->
	headers = response.headers
	assert.equal(headers['x-download-options'], 'noopen')
	assert.equal(headers['x-xss-protection'], '1; mode=block')
	assert.equal(headers['referrer-policy'], 'origin-when-cross-origin')

assert_has_cache_headers = (response) ->
	headers = response.headers
	assert.equal(headers['surrogate-control'], 'no-store')
	assert.equal(headers['cache-control'], 'no-store, no-cache, must-revalidate, proxy-revalidate')
	assert.equal(headers['pragma'], 'no-cache')
	assert.equal(headers['expires'], '0')

assert_has_no_cache_headers = (response) ->
	headers = response.headers
	assert.isUndefined(headers['surrogate-control'])
	assert.isUndefined(headers['cache-control'])
	assert.isUndefined(headers['pragma'])
	assert.isUndefined(headers['expires'])

describe "SecurityHeaders", ->
	before ->
		@user = new User()

	it 'should not have x-powered-by header', (done) ->
		request.get '/', (err, res, body) =>
			assert.isUndefined(res.headers['x-powered-by'])
			done()

	it 'should have all common headers', (done) ->
		request.get '/', (err, res, body) =>
			assert_has_common_headers res
			done()

	it 'should not have cache headers on public pages', (done) ->
		request.get '/', (err, res, body) =>
			assert_has_no_cache_headers res
			done()

	it 'should have cache headers when user is logged in', (done) ->
		async.series [
			(cb) => @user.login cb
			(cb) => @user.request.get '/', cb
			(cb) => @user.logout cb
		], (err, results) =>
			main_response = results[1][0]
			assert_has_cache_headers main_response
			done()

	it 'should have cache headers on project page', (done) ->
		async.series [
			(cb) => @user.login cb
			(cb) =>
				@user.createProject "public-project", (error, project_id) =>
					return done(error) if error?
					@project_id = project_id
					@user.makePublic @project_id, "readAndWrite", cb
			(cb) => @user.logout cb
		], (err, results) =>
				request.get  "/project/#{@project_id}", (err, res, body) =>
					assert_has_cache_headers res
					done()
