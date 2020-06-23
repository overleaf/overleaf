chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
MockWebServer = require "./helpers/MockWebServer"
FixturesManager = require "./helpers/FixturesManager"

async = require "async"

describe "clientTracking", ->
	describe "when a client updates its cursor location", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "owner"
						project: { name: "Test Project" }
					}, (error, {@user_id, @project_id}) => cb()
				
				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)
				
				(cb) =>
					@clientA = RealTimeClient.connect()
					@clientA.on "connectionAccepted", cb
					
				(cb) =>
					@clientB = RealTimeClient.connect()
					@clientB.on "connectionAccepted", cb
					
				(cb) =>
					@clientA.emit "joinProject", {
						project_id: @project_id
					}, cb
				
				(cb) =>
					@clientA.emit "joinDoc", @doc_id, cb
					
				(cb) =>
					@clientB.emit "joinProject", {
						project_id: @project_id
					}, cb
					
				(cb) =>
					@updates = []
					@clientB.on "clientTracking.clientUpdated", (data) =>
						@updates.push data

					@clientA.emit "clientTracking.updatePosition", {
						row: @row = 42
						column: @column = 36
						doc_id: @doc_id
					}, (error) ->
						throw error if error?
						setTimeout cb, 300 # Give the message a chance to reach client B.
			], done
			
		it "should tell other clients about the update", ->
			@updates.should.deep.equal [
				{
					row: @row
					column: @column
					doc_id: @doc_id
					id: @clientA.publicId
					user_id: @user_id
					name: "Joe Bloggs"
				}
			]
		
		it "should record the update in getConnectedUsers", (done) ->
			@clientB.emit "clientTracking.getConnectedUsers", (error, users) =>
				for user in users
					if user.client_id == @clientA.publicId
						expect(user.cursorData).to.deep.equal({
							row: @row
							column: @column
							doc_id: @doc_id 
						})
						return done()
				throw new Error("user was never found")
				
	describe "when an anonymous client updates its cursor location", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "owner"
						project: { name: "Test Project"	}
						publicAccess: "readAndWrite"
					}, (error, {@user_id, @project_id}) => cb()
				
				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)
				
				(cb) =>
					@clientA = RealTimeClient.connect()
					@clientA.on "connectionAccepted", cb

				(cb) =>
					@clientA.emit "joinProject", {
						project_id: @project_id
					}, cb
			
				(cb) =>
					RealTimeClient.setSession({}, cb)
					
				(cb) =>
					@anonymous = RealTimeClient.connect()
					@anonymous.on "connectionAccepted", cb	
					
				(cb) =>
					@anonymous.emit "joinProject", {
						project_id: @project_id
					}, cb
				
				(cb) =>
					@anonymous.emit "joinDoc", @doc_id, cb
					
				(cb) =>
					@updates = []
					@clientA.on "clientTracking.clientUpdated", (data) =>
						@updates.push data

					@anonymous.emit "clientTracking.updatePosition", {
						row: @row = 42
						column: @column = 36
						doc_id: @doc_id
					}, (error) ->
						throw error if error?
						setTimeout cb, 300 # Give the message a chance to reach client B.
			], done
			
		it "should tell other clients about the update", ->
			@updates.should.deep.equal [
				{
					row: @row
					column: @column
					doc_id: @doc_id
					id: @anonymous.publicId
					user_id: "anonymous-user"
					name: ""
				}
			]
