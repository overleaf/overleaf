chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
MockDocUpdaterServer = require "./helpers/MockDocUpdaterServer"
FixturesManager = require "./helpers/FixturesManager"

describe "leaveDoc", ->
	before ->
		@lines = ["test", "doc", "lines"]
		@version = 42
		@ops = ["mock", "doc", "ops"]
			
	describe "when joined to a doc", ->
		before (done) ->
			FixturesManager.setUpProject {
				privilegeLevel: "readAndWrite"
			}, (error, data) =>
				throw error if error?
				{@project_id, @user_id} = data
				FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (error, data) =>
					throw error if error?
					{@doc_id} = data
					@client = RealTimeClient.connect()
					@client.emit "joinProject", project_id: @project_id, (error) =>
						throw error if error?
						@client.emit "joinDoc", @doc_id, (error, @returnedArgs...) =>
							throw error if error?
							done()
							
		describe "then leaving the doc", ->
			before (done) ->
				@client.emit "leaveDoc", @doc_id, (error) ->
					throw error if error?
					done()
			
			it "should have left the doc room", (done) ->
				RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
					expect(@doc_id in client.rooms).to.equal false
					done()
