chai = require("chai")
expect = chai.expect

RealTimeClient = require "./helpers/RealTimeClient"

describe "Session", ->
	describe "with an established session", ->
		before (done) ->
			@user_id = "mock-user-id"
			RealTimeClient.setSession {
				user: { _id: @user_id }
			}, (error) =>
				throw error if error?
				@client = RealTimeClient.connect()
				return done()
			return null

		it "should not get disconnected", (done) ->
			disconnected = false
			@client.on "disconnect", () ->
				disconnected = true
			setTimeout () =>
				expect(disconnected).to.equal false
				done()
			, 500
			
		it "should appear in the list of connected clients", (done) ->
			RealTimeClient.getConnectedClients (error, clients) =>
				included = false
				for client in clients
					if client.client_id == @client.socket.sessionid
						included = true
						break
				expect(included).to.equal true
				done()
