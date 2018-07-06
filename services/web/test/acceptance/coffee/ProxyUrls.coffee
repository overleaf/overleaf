should = require('chai').should()
assert = require('chai').assert
async = require("async")
request = require "./helpers/request"
MockV1Api = require "./helpers/MockV1Api"

assertResponse = (path, expectedStatusCode, expectedBody, cb) ->
	request.get path, (error, response) ->
		should.not.exist error
		response.statusCode.should.equal expectedStatusCode
		assert.deepEqual(JSON.parse(response.body), expectedBody) if expectedBody
		cb()

describe "ProxyUrls", ->
	before ->
		@timeout(1000)

	it 'proxy static URLs', (done) ->
		async.series [
			(cb) -> assertResponse '/institutions/list', 200, [], cb
			(cb) -> assertResponse '/institutions/domains', 200, [], cb
		],
		done

	it 'proxy dynamic URLs', (done) ->
		async.series [
			(cb) -> assertResponse '/institutions/list/123', 200, { id: 123 }, cb
			(cb) -> assertResponse '/institutions/list/456', 200, { id: 456 }, cb
		],
		done

	it 'return 404 if proxy is not set', (done) ->
		async.series [
			(cb) -> assertResponse '/institutions/foobar', 404, null, cb
		],
		done

	it 'handle missing baseUrl', (done) ->
		async.series [
			(cb) -> assertResponse '/proxy/missing/baseUrl', 500, null, cb
		],
		done
