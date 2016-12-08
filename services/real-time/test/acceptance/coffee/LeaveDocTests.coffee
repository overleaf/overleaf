chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
MockDocUpdaterServer = require "./helpers/MockDocUpdaterServer"
FixturesManager = require "./helpers/FixturesManager"

async = require "async"

describe "leaveDoc", ->
	before ->
		@lines = ["test", "doc", "lines"]
		@version = 42
		@ops = ["mock", "doc", "ops"]
			
	describe "when joined to a doc", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "readAndWrite"
					}, (e, {@project_id, @user_id}) =>
						cb(e)
					
				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)
						
				(cb) =>
					@client = RealTimeClient.connect()
					@client.on "connectionAccepted", cb
						
				(cb) =>
					@client.emit "joinProject", project_id: @project_id, cb
				
				(cb) =>
					@client.emit "joinDoc", @doc_id, (error, @returnedArgs...) => cb(error)
			], done
							
		describe "then leaving the doc", ->
			before (done) ->
				@client.emit "leaveDoc", @doc_id, (error) ->
					throw error if error?
					done()
			
			it "should have left the doc room", (done) ->
				RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
					expect(@doc_id in client.rooms).to.equal false
					done()
