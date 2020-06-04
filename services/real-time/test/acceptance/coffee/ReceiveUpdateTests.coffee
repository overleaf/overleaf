chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
MockWebServer = require "./helpers/MockWebServer"
FixturesManager = require "./helpers/FixturesManager"

async = require "async"

settings = require "settings-sharelatex"
redis = require "redis-sharelatex"
rclient = redis.createClient(settings.redis.websessions)

describe "receiveUpdate", ->
	before (done) ->
		@lines = ["test", "doc", "lines"]
		@version = 42
		@ops = ["mock", "doc", "ops"]
		
		async.series [
			(cb) =>
				FixturesManager.setUpProject {
					privilegeLevel: "owner"
					project: { name: "Test Project"	}
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
				@clientB.emit "joinDoc", @doc_id, cb
		], done
		
	describe "with an update from clientA", ->
		before (done) ->
			@clientAUpdates = []
			@clientA.on "otUpdateApplied", (update) => @clientAUpdates.push(update)
			@clientBUpdates = []
			@clientB.on "otUpdateApplied", (update) => @clientBUpdates.push(update)
			
			@update = {
				doc_id: @doc_id
				op:
					meta:
						source: @clientA.publicId
					v: @version
					doc: @doc_id
					op: [{i: "foo", p: 50}]				
			}
			rclient.publish "applied-ops", JSON.stringify(@update)
			setTimeout done, 200 # Give clients time to get message
			
		it "should send the full op to clientB", ->
			@clientBUpdates.should.deep.equal [@update.op]
			
		it "should send an ack to clientA", ->
			@clientAUpdates.should.deep.equal [{
				v: @version, doc: @doc_id
			}]
			
	describe "with an error", ->
		before (done) ->
			@clientAErrors = []
			@clientA.on "otUpdateError", (error) => @clientAErrors.push(error)
			@clientBErrors = []
			@clientB.on "otUpdateError", (error) => @clientBErrors.push(error)
			
			rclient.publish "applied-ops", JSON.stringify({doc_id: @doc_id, error: @error = "something went wrong"})
			setTimeout done, 200 # Give clients time to get message
			
		it "should send the error to both clients", ->
			@clientAErrors.should.deep.equal [@error]
			@clientBErrors.should.deep.equal [@error]
			
		it "should disconnect the clients", ->
			@clientA.socket.connected.should.equal false
			@clientB.socket.connected.should.equal false
