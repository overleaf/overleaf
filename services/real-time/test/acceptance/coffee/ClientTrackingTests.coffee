chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
MockWebServer = require "./helpers/MockWebServer"
FixturesManager = require "./helpers/FixturesManager"

describe "clientTracking", ->
	before (done) ->
		FixturesManager.setUpProject {
			privilegeLevel: "owner"
			project: {
				name: "Test Project"
			}
		}, (error, data) =>
			throw error if error?
			{@user_id, @project_id} = data
			@clientA = RealTimeClient.connect()
			@clientB = RealTimeClient.connect()
			@clientA.emit "joinProject", {
				project_id: @project_id
			}, (error) =>
				throw error if error?
				@clientB.emit "joinProject", {
					project_id: @project_id
				}, (error) =>
					throw error if error?
					done()
					
	describe "when a client updates its cursor location", ->
		before (done) ->
			@updates = []
			@clientB.on "clientTracking.clientUpdated", (data) ->
				@updates.push data
				
			@clientA.emit "clientTracking.updatePosition", {
				row: @row = 42
				column: @column = 36
				doc_id: @doc_id = "mock-doc-id"
			}, (error) ->
				throw error if error?
				done()
			
		it "should tell other clients about the update"
		
		it "should record the update in getConnectedUsers", (done) ->
			@clientB.emit "clientTracking.getConnectedUsers", (error, users) =>
				for user in users
					if user.client_id == @clientA.socket.sessionid
						expect(user.cursorData).to.deep.equal({
							row: @row
							column: @column
							doc_id: @doc_id 
						})
						return done()
				throw new Error("user was never found")
				
				
	describe "anonymous users", ->
		it "should test something..."
