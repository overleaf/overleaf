should = require('chai').should()
assert = require('chai').assert
async = require("async")
request = require "./helpers/request"
MockV1Api = require "./helpers/MockV1Api"

assertRedirect = (method, path, expectedStatusCode, destination, cb) ->
	request[method] path, (error, response) ->
		should.not.exist error
		response.statusCode.should.equal expectedStatusCode
		response.headers.location.should.equal destination
		cb()

describe "RedirectUrls", ->
	before ->
		@timeout(1000)

	it 'proxy static URLs', (done) ->
		assertRedirect 'get', '/redirect/one', 302, '/destination/one', done

	it 'proxy dynamic URLs', (done) ->
		assertRedirect 'get', '/redirect/params/42', 302, '/destination/42/params', done

	it 'proxy URLs with baseUrl', (done) ->
		assertRedirect 'get', '/redirect/base_url', 302, 'https://example.com/destination/base_url', done

	it 'proxy URLs with POST', (done) ->
		assertRedirect 'post', '/redirect/post', 307, '/destination/post', done
