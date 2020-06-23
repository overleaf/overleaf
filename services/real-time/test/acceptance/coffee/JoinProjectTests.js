chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
MockWebServer = require "./helpers/MockWebServer"
FixturesManager = require "./helpers/FixturesManager"

async = require "async"

describe "joinProject", ->
	describe "when authorized", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "owner"
						project: {
							name: "Test Project"
						}
					}, (e, {@project_id, @user_id}) =>
						cb(e)

				(cb) =>
					@client = RealTimeClient.connect()
					@client.on "connectionAccepted", cb
						
				(cb) =>
					@client.emit "joinProject", project_id: @project_id, (error, @project, @privilegeLevel, @protocolVersion) =>
						cb(error)
			], done
					
		it "should get the project from web", ->
			MockWebServer.joinProject
				.calledWith(@project_id, @user_id)
				.should.equal true
					
		it "should return the project", ->
			@project.should.deep.equal {
				name: "Test Project"
			}
		
		it "should return the privilege level", ->
			@privilegeLevel.should.equal "owner"
		
		it "should return the protocolVersion", ->
			@protocolVersion.should.equal 2
			
		it "should have joined the project room", (done) ->
			RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
				expect(@project_id in client.rooms).to.equal true
				done()
				
		it "should have marked the user as connected", (done) ->
			@client.emit "clientTracking.getConnectedUsers", (error, users) =>
				connected = false
				for user in users
					if user.client_id == @client.publicId and user.user_id == @user_id
						connected = true
						break
				expect(connected).to.equal true
				done()
			
	describe "when not authorized", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: null
						project: {
							name: "Test Project"
						}
					}, (e, {@project_id, @user_id}) =>
						cb(e)

				(cb) =>
					@client = RealTimeClient.connect()
					@client.on "connectionAccepted", cb
						
				(cb) =>
					@client.emit "joinProject", project_id: @project_id, (@error, @project, @privilegeLevel, @protocolVersion) =>
						cb()
			], done
		
		it "should return an error", ->
			@error.message.should.equal "not authorized"
			
		it "should not have joined the project room", (done) ->
			RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
				expect(@project_id in client.rooms).to.equal false
				done()

	describe "when over rate limit", ->
		before (done) ->
			async.series [
				(cb) =>
					@client = RealTimeClient.connect()
					@client.on "connectionAccepted", cb

				(cb) =>
					@client.emit "joinProject", project_id: 'rate-limited', (@error) =>
						cb()
			], done

		it "should return a TooManyRequests error code", ->
			@error.message.should.equal "rate-limit hit when joining project"
			@error.code.should.equal "TooManyRequests"

