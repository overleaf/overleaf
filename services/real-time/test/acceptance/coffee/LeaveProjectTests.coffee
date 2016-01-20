RealTimeClient = require "./helpers/RealTimeClient"
MockDocUpdaterServer = require "./helpers/MockDocUpdaterServer"
FixturesManager = require "./helpers/FixturesManager"

async = require "async"

describe "leaveProject", ->
	before (done) ->
		MockDocUpdaterServer.run done
		
	describe "with other clients in the project", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "owner"
						project: {
							name: "Test Project"
						}
					}, (e, {@project_id, @user_id}) => cb()
					
				(cb) =>
					@clientA = RealTimeClient.connect()
					@clientA.on "connect", cb
					
				(cb) =>
					@clientB = RealTimeClient.connect()
					@clientB.on "connect", cb
					
					@clientBDisconnectMessages = []
					@clientB.on "clientTracking.clientDisconnected", (data) =>
						@clientBDisconnectMessages.push data
						
				(cb) =>
					@clientA.emit "joinProject", project_id: @project_id, (error, @project, @privilegeLevel, @protocolVersion) =>
						cb(error)
							
				(cb) =>
					@clientB.emit "joinProject", project_id: @project_id, (error, @project, @privilegeLevel, @protocolVersion) =>
						cb(error)
							
				(cb) =>
					# leaveProject is called when the client disconnects
					@clientA.on "disconnect", () -> cb()
					@clientA.disconnect()
					
				(cb) =>
					# The API waits a little while before flushing changes
					setTimeout done, require("../../../app/js/WebsocketController").FLUSH_IF_EMPTY_DELAY * 2
					
			], done

		it "should emit a disconnect message to the room", ->
			@clientBDisconnectMessages.should.deep.equal [@clientA.socket.sessionid]
	
		it "should no longer list the client in connected users", (done) ->
			@clientB.emit "clientTracking.getConnectedUsers", (error, users) =>
				for user in users
					if user.client_id == @clientA.socket.sessionid
						throw "Expected clientA to not be listed in connected users"
				return done()
		
		it "should not flush the project to the document updater", ->
			MockDocUpdaterServer.deleteProject
				.calledWith(@project_id)
				.should.equal false

	describe "with no other clients in the project", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "owner"
						project: {
							name: "Test Project"
						}
					}, (e, {@project_id, @user_id}) => cb()
					
				(cb) =>
					@clientA = RealTimeClient.connect()
					@clientA.on "connect", cb
						
				(cb) =>
					@clientA.emit "joinProject", project_id: @project_id, (error, @project, @privilegeLevel, @protocolVersion) =>
						cb(error)
							
				(cb) =>
					# leaveProject is called when the client disconnects
					@clientA.on "disconnect", () -> cb()
					@clientA.disconnect()
					
				(cb) =>
					# The API waits a little while before flushing changes
					setTimeout done, require("../../../app/js/WebsocketController").FLUSH_IF_EMPTY_DELAY * 2
			], done

		it "should flush the project to the document updater", ->
			MockDocUpdaterServer.deleteProject
				.calledWith(@project_id)
				.should.equal true
