chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
MockWebServer = require "./helpers/MockWebServer"
FixturesManager = require "./helpers/FixturesManager"


describe "joinProject", ->
	describe "when authorized", ->
		before (done) ->
			FixturesManager.setUpProject {
				privilegeLevel: "owner"
				project: {
					name: "Test Project"
				}
			}, (error, data) =>
				throw error if error?
				{@user_id, @project_id} = data
				@client = RealTimeClient.connect()
				@client.emit "joinProject", {
					project_id: @project_id
				}, (error, @project, @privilegeLevel, @protocolVersion) =>
					throw error if error?
					done()
					
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
			@client.emit "getConnectedUsers", (error, users) =>
				connected = false
				for user in users
					if user.client_id == @client.socket.sessionid and user.user_id == @user_id
						connected = true
						break
				expect(connected).to.equal true
				done()
			
	describe "when not authorized", ->
		before (done) ->
			FixturesManager.setUpProject {
				privilegeLevel: null
				project: {
					name: "Test Project"
				}
			}, (error, data) =>
				throw error if error?
				{@user_id, @project_id} = data
				@client = RealTimeClient.connect()
				@client.emit "joinProject", {
					project_id: @project_id
				}, (@error, @project, @privilegeLevel, @protocolVersion) =>
					done()
		
		it "should return an error", ->
			# We don't return specific errors
			@error.message.should.equal "Something went wrong"
			
		it "should not have joined the project room", (done) ->
			RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
				expect(@project_id in client.rooms).to.equal false
				done()
