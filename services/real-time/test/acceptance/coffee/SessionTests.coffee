chai = require("chai")
expect = chai.expect

RealTimeClient = require "./helpers/RealTimeClient"

describe "Session", ->
	describe "with an established session", ->
		beforeEach (done) ->
			@user_id = "mock-user-id"
			RealTimeClient.setSession {
				user: { _id: @user_id }
			}, (error) =>
				throw error if error?
				@client = RealTimeClient.connect()
				done()
		
		it "should not get disconnected", (done) ->
			disconnected = false
			@client.on "disconnect", () ->
				disconnected = true
			setTimeout () =>
				expect(disconnected).to.equal false
				done()
			, 500
		
	describe "without an established session", ->
		beforeEach (done) ->
			RealTimeClient.unsetSession (error) =>
				throw error if error?
				@client = RealTimeClient.connect()
				done()
				
		it "should get disconnected", (done) ->
			@client.on "disconnect", () ->
				done()
				
	describe "without a valid user set on the session", ->
		beforeEach (done) ->
			RealTimeClient.setSession {
				foo: "bar"
			}, (error) =>
				throw error if error?
				@client = RealTimeClient.connect()
				done()
				
		it "should get disconnected", (done) ->
			@client.on "disconnect", () ->
				done()