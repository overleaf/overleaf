sinon = require "sinon"
chai = require("chai")
chai.should()
mongojs = require "../../../app/js/mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId
Settings = require "settings-sharelatex"
request = require "request"

describe "Appending doc ops to the history", ->
	describe "when the history does not exist yet", ->
		before (done) ->
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			@updates = [{
				op: [{ i: "f", p: 3 }]
				meta: { ts: Date.now(), user_id: @user_id }
			}, {
				op: [{ i: "o", p: 4 }]
				meta: { ts: Date.now(), user_id: @user_id }
			}, {
				op: [{ i: "o", p: 5 }]
				meta: { ts: Date.now(), user_id: @user_id }
			}]
			@version = 3

			request.post {
				url: "http://localhost:#{Settings.port}/doc/#{@doc_id}/history"
				json:
					version: @version
					docOps: @updates
			}, (@error, @response, @body) =>
				done()

		it "should return a successful response", ->
			@response.statusCode.should.equal 204


