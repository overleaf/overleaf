expect = require("chai").expect
async = require("async")
User = require "./helpers/User"

describe "Project CRUD", ->
	before (done) ->
		@user = new User()
		@user.login done

	describe "when project doesn't exist", ->
		it "should return 404", (done) ->
			@user.request.get "/project/aaaaaaaaaaaaaaaaaaaaaaaa", (err, res, body) ->
				expect(res.statusCode).to.equal 404
				done()
		
	describe "when project has malformed id", ->
		it "should return 404", (done) ->
			@user.request.get "/project/blah", (err, res, body) ->
				expect(res.statusCode).to.equal 404
				done()
		