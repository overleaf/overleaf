SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/DocumentUpdaterController'
MockClient = require "./helpers/MockClient"

describe "DocumentUpdaterController", ->
	beforeEach ->
		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@callback = sinon.stub()
		@io = { "mock": "socket.io" }
		@rclient = []
		@RoomEvents = { on: sinon.stub() }
		@EditorUpdatesController = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": @logger = { error: sinon.stub(), log: sinon.stub(), warn: sinon.stub() }
			"settings-sharelatex": @settings =
				redis:
					documentupdater:
						key_schema:
							pendingUpdates: ({doc_id}) -> "PendingUpdates:#{doc_id}"
					pubsub: null
			"redis-sharelatex" : @redis =
				createClient: (name) =>
					@rclient.push(rclientStub = {name:name})
					return rclientStub
			"./SafeJsonParse": @SafeJsonParse =
				parse: (data, cb) => cb null, JSON.parse(data)
			"./EventLogger": @EventLogger = {checkEventOrder: sinon.stub()}
			"./HealthCheckManager": {check: sinon.stub()}
			"metrics-sharelatex": @metrics = {inc: sinon.stub()}
			"./RoomManager" : @RoomManager = { eventSource: sinon.stub().returns @RoomEvents}
			"./ChannelManager": @ChannelManager = {}

	describe "listenForUpdatesFromDocumentUpdater", ->
		beforeEach ->
			@rclient.length = 0  # clear any existing clients
			@EditorUpdatesController.rclientList = [@redis.createClient("first"), @redis.createClient("second")]
			@rclient[0].subscribe = sinon.stub()
			@rclient[0].on = sinon.stub()
			@rclient[1].subscribe = sinon.stub()
			@rclient[1].on = sinon.stub()
			@EditorUpdatesController.listenForUpdatesFromDocumentUpdater()
		
		it "should subscribe to the doc-updater stream", ->
			@rclient[0].subscribe.calledWith("applied-ops").should.equal true

		it "should register a callback to handle updates", ->
			@rclient[0].on.calledWith("message").should.equal true

		it "should subscribe to any additional doc-updater stream", ->
			@rclient[1].subscribe.calledWith("applied-ops").should.equal true
			@rclient[1].on.calledWith("message").should.equal true

	describe "_processMessageFromDocumentUpdater", ->
		describe "with bad JSON", ->
			beforeEach ->
				@SafeJsonParse.parse = sinon.stub().callsArgWith 1, new Error("oops")
				@EditorUpdatesController._processMessageFromDocumentUpdater @io, "applied-ops", "blah"
			
			it "should log an error", ->
				@logger.error.called.should.equal true

		describe "with update", ->
			beforeEach ->
				@message =
					doc_id: @doc_id
					op: {t: "foo", p: 12}
				@EditorUpdatesController._applyUpdateFromDocumentUpdater = sinon.stub()
				@EditorUpdatesController._processMessageFromDocumentUpdater @io, "applied-ops", JSON.stringify(@message)

			it "should apply the update", ->
				@EditorUpdatesController._applyUpdateFromDocumentUpdater
					.calledWith(@io, @doc_id, @message.op)
					.should.equal true

		describe "with error", ->
			beforeEach ->
				@message =
					doc_id: @doc_id
					error: "Something went wrong"
				@EditorUpdatesController._processErrorFromDocumentUpdater = sinon.stub()
				@EditorUpdatesController._processMessageFromDocumentUpdater @io, "applied-ops", JSON.stringify(@message)

			it "should process the error", ->
				@EditorUpdatesController._processErrorFromDocumentUpdater
					.calledWith(@io, @doc_id, @message.error)
					.should.equal true

	describe "_applyUpdateFromDocumentUpdater", ->
		beforeEach ->
			@sourceClient = new MockClient()
			@otherClients = [new MockClient(), new MockClient()]
			@update =
				op: [ t: "foo", p: 12 ]
				meta: source: @sourceClient.publicId
				v: @version = 42
				doc: @doc_id
			@io.sockets =
				clients: sinon.stub().returns([@sourceClient, @otherClients..., @sourceClient]) # include a duplicate client
		
		describe "normally", ->
			beforeEach ->
				@EditorUpdatesController._applyUpdateFromDocumentUpdater @io, @doc_id, @update

			it "should send a version bump to the source client", ->
				@sourceClient.emit
					.calledWith("otUpdateApplied", v: @version, doc: @doc_id)
					.should.equal true
				@sourceClient.emit.calledOnce.should.equal true

			it "should get the clients connected to the document", ->
				@io.sockets.clients
					.calledWith(@doc_id)
					.should.equal true

			it "should send the full update to the other clients", ->
				for client in @otherClients
					client.emit
						.calledWith("otUpdateApplied", @update)
						.should.equal true
		
		describe "with a duplicate op", ->
			beforeEach ->
				@update.dup = true
				@EditorUpdatesController._applyUpdateFromDocumentUpdater @io, @doc_id, @update
			
			it "should send a version bump to the source client as usual", ->
				@sourceClient.emit
					.calledWith("otUpdateApplied", v: @version, doc: @doc_id)
					.should.equal true

			it "should not send anything to the other clients (they've already had the op)", ->
				for client in @otherClients
					client.emit
						.calledWith("otUpdateApplied")
						.should.equal false

	describe "_processErrorFromDocumentUpdater", ->
		beforeEach ->
			@clients = [new MockClient(), new MockClient()]
			@io.sockets =
				clients: sinon.stub().returns(@clients)
			@EditorUpdatesController._processErrorFromDocumentUpdater @io, @doc_id, "Something went wrong"

		it "should log a warning", ->
			@logger.warn.called.should.equal true

		it "should disconnect all clients in that document", ->
			@io.sockets.clients.calledWith(@doc_id).should.equal true
			for client in @clients
				client.disconnect.called.should.equal true

