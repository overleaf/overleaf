Settings = require "settings-sharelatex"
chai = require "chai"
request = require "./helpers/request"

describe "siteIsOpen", ->
	describe "when siteIsOpen is default (true)", ->
		it "should get page", (done) ->
			request.get "/login", (error, response, body) ->
				response.statusCode.should.equal 200
				done()

	describe "when siteIsOpen is false", ->
		beforeEach ->
			Settings.siteIsOpen = false

		afterEach ->
			Settings.siteIsOpen = true

		it "should return maintenance page", (done) ->
			request.get "/login", (error, response) ->
				response.statusCode.should.equal 503
				done()
