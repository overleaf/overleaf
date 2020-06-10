chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
MockWebServer = require "./helpers/MockWebServer"
FixturesManager = require "./helpers/FixturesManager"

async = require "async"

settings = require "settings-sharelatex"
redis = require "redis-sharelatex"
rclient = redis.createClient(settings.redis.pubsub)

describe "receiveUpdate", ->
	beforeEach (done) ->
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

			(cb) =>
				FixturesManager.setUpProject {
					privilegeLevel: "owner"
					project: {name: "Test Project"}
				}, (error, {user_id: @user_id_second, project_id: @project_id_second}) => cb()

			(cb) =>
				FixturesManager.setUpDoc @project_id_second, {@lines, @version, @ops}, (e, {doc_id: @doc_id_second}) =>
					cb(e)

			(cb) =>
				@clientC = RealTimeClient.connect()
				@clientC.on "connectionAccepted", cb

			(cb) =>
				@clientC.emit "joinProject", {
					project_id: @project_id_second
				}, cb
			(cb) =>
				@clientC.emit "joinDoc", @doc_id_second, cb

			(cb) =>
				@clientAUpdates = []
				@clientA.on "otUpdateApplied", (update) => @clientAUpdates.push(update)
				@clientBUpdates = []
				@clientB.on "otUpdateApplied", (update) => @clientBUpdates.push(update)
				@clientCUpdates = []
				@clientC.on "otUpdateApplied", (update) => @clientCUpdates.push(update)

				@clientAErrors = []
				@clientA.on "otUpdateError", (error) => @clientAErrors.push(error)
				@clientBErrors = []
				@clientB.on "otUpdateError", (error) => @clientBErrors.push(error)
				@clientCErrors = []
				@clientC.on "otUpdateError", (error) => @clientCErrors.push(error)
				cb()
		], done

	afterEach () ->
		@clientA?.disconnect()
		@clientB?.disconnect()
		@clientC?.disconnect()

	describe "with an update from clientA", ->
		beforeEach (done) ->
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

		it "should send nothing to clientC", ->
			@clientCUpdates.should.deep.equal []

	describe "with an update from clientC", ->
		beforeEach (done) ->
			@update = {
				doc_id: @doc_id_second
				op:
					meta:
						source: @clientC.publicId
					v: @version
					doc: @doc_id_second
					op: [{i: "update from clientC", p: 50}]
			}
			rclient.publish "applied-ops", JSON.stringify(@update)
			setTimeout done, 200 # Give clients time to get message

		it "should send nothing to clientA", ->
			@clientAUpdates.should.deep.equal []

		it "should send nothing to clientB", ->
			@clientBUpdates.should.deep.equal []

		it "should send an ack to clientC", ->
			@clientCUpdates.should.deep.equal [{
				v: @version, doc: @doc_id_second
			}]

	describe "with an update from a remote client for project 1", ->
		beforeEach (done) ->
			@update = {
				doc_id: @doc_id
				op:
					meta:
						source: 'this-is-a-remote-client-id'
					v: @version
					doc: @doc_id
					op: [{i: "foo", p: 50}]
			}
			rclient.publish "applied-ops", JSON.stringify(@update)
			setTimeout done, 200 # Give clients time to get message

		it "should send the full op to clientA", ->
			@clientAUpdates.should.deep.equal [@update.op]
			
		it "should send the full op to clientB", ->
			@clientBUpdates.should.deep.equal [@update.op]

		it "should send nothing to clientC", ->
			@clientCUpdates.should.deep.equal []

	describe "with an error for the first project", ->
		beforeEach (done) ->
			rclient.publish "applied-ops", JSON.stringify({doc_id: @doc_id, error: @error = "something went wrong"})
			setTimeout done, 200 # Give clients time to get message

		it "should send the error to the clients in the first project", ->
			@clientAErrors.should.deep.equal [@error]
			@clientBErrors.should.deep.equal [@error]

		it "should not send any errors to the client in the second project", ->
			@clientCErrors.should.deep.equal []

		it "should disconnect the clients of the first project", ->
			@clientA.socket.connected.should.equal false
			@clientB.socket.connected.should.equal false

		it "should not disconnect the client in the second project", ->
			@clientC.socket.connected.should.equal true

	describe "with an error for the second project", ->
		beforeEach (done) ->
			rclient.publish "applied-ops", JSON.stringify({doc_id: @doc_id_second, error: @error = "something went wrong"})
			setTimeout done, 200 # Give clients time to get message

		it "should not send any errors to the clients in the first project", ->
			@clientAErrors.should.deep.equal []
			@clientBErrors.should.deep.equal []

		it "should send the error to the client in the second project", ->
			@clientCErrors.should.deep.equal [@error]

		it "should not disconnect the clients of the first project", ->
			@clientA.socket.connected.should.equal true
			@clientB.socket.connected.should.equal true

		it "should disconnect the client in the second project", ->
			@clientC.socket.connected.should.equal false
