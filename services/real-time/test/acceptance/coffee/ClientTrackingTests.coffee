chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
MockWebServer = require "./helpers/MockWebServer"
FixturesManager = require "./helpers/FixturesManager"

async = require "async"

describe "clientTracking", ->
	before (done) ->
		async.series [
			(cb) =>
				FixturesManager.setUpProject {
					privilegeLevel: "owner"
					project: { name: "Test Project"	}
				}, (error, {@user_id, @project_id}) => cb()
			
			(cb) =>
				@clientA = RealTimeClient.connect()
				@clientA.on "connect", cb
				
			(cb) =>
				@clientB = RealTimeClient.connect()
				@clientB.on "connect", cb
				
			(cb) =>
				@clientA.emit "joinProject", {
					project_id: @project_id
				}, cb
				
			(cb) =>
				@clientB.emit "joinProject", {
					project_id: @project_id
				}, cb
		], done
					
	describe "when a client updates its cursor location", ->
		before (done) ->
			@updates = []
			@clientB.on "clientTracking.clientUpdated", (data) =>
				@updates.push data
				
			@clientA.emit "clientTracking.updatePosition", {
				row: @row = 42
				column: @column = 36
				doc_id: @doc_id = "mock-doc-id"
			}, (error) ->
				throw error if error?
				done()
			
		it "should tell other clients about the update", ->
			@updates.should.deep.equal [
				{
					row: @row
					column: @column
					doc_id: @doc_id
					id: @clientA.socket.sessionid
					user_id: @user_id
					name: "Joe Bloggs"
				}
			]
		
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
