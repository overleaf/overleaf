SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/Editor/EditorUpdatesController'
MockClient = require "../helpers/MockClient"
assert = require('assert')

describe "EditorUpdatesController", ->
	beforeEach ->
		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@client = new MockClient()
		@callback = sinon.stub()
		@EditorUpdatesController = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": @logger = { error: sinon.stub(), log: sinon.stub() }
			"./EditorRealTimeController" : @EditorRealTimeController = {}
			"../DocumentUpdater/DocumentUpdaterHandler" : @DocumentUpdaterHandler = {}
			"../../infrastructure/Metrics" : @metrics = { set: sinon.stub(), inc: sinon.stub() }
			"../../infrastructure/Server" : io: @io = {}
			"redis-sharelatex" : 
				createMonitoredSubscriptionClient: ()=> 
					@rclient = {auth:->}

	describe "_applyUpdate", ->
		beforeEach ->
			@update = {op: {p: 12, t: "foo"}}
			@client.set("user_id", @user_id = "user-id-123")
			@DocumentUpdaterHandler.queueChange = sinon.stub().callsArg(3)

		describe "succesfully", ->
			beforeEach ->
				@EditorUpdatesController._applyUpdate @client, @project_id, @doc_id, @update, @callback

			it "should queue the update", ->
				@DocumentUpdaterHandler.queueChange
					.calledWith(@project_id, @doc_id, @update)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

			it "should update the active users metric", ->
				@metrics.set.calledWith("editor.active-users", @user_id).should.equal true

			it "should update the active projects metric", ->
				@metrics.set.calledWith("editor.active-projects", @project_id).should.equal true

			it "should increment the doc updates", ->
				@metrics.inc.calledWith("editor.doc-update").should.equal true

		describe "unsuccessfully", ->
			beforeEach ->
				@client.disconnect = sinon.stub()
				@DocumentUpdaterHandler.queueChange = sinon.stub().callsArgWith(3, new Error("Something went wrong"))
				@EditorUpdatesController._applyUpdate @client, @project_id, @doc_id, @update, @callback

			it "should disconnect the client", ->
				@client.disconnect.called.should.equal true

			it "should log an error", ->
				@logger.error.called.should.equal true

	describe "applyOtUpdate", ->
		beforeEach ->
			@client.id = "client-id"
			@client.set("user_id", @user_id = "user-id-123")
			@update = {op: {p: 12, t: "foo"}}
			@EditorUpdatesController._applyUpdate = sinon.stub()
			@EditorUpdatesController.applyOtUpdate @client, @project_id, @doc_id, @update

		it "should set the source of the update to the client id", ->
			@update.meta.source.should.equal @client.id

		it "should set the user_id of the update to the user id", ->
			@update.meta.user_id.should.equal @user_id

		it "should apply the update", ->
			@EditorUpdatesController._applyUpdate
				.calledWith(@client, @project_id, @doc_id, @update)
				.should.equal true

	describe "listenForUpdatesFromDocumentUpdater", ->
		beforeEach ->
			@rclient.subscribe = sinon.stub()
			@rclient.on = sinon.stub()
			@EditorUpdatesController.listenForUpdatesFromDocumentUpdater()
		
		it "should subscribe to the doc-updater stream", ->
			@rclient.subscribe.calledWith("applied-ops").should.equal true

		it "should register a callback to handle updates", ->
			@rclient.on.calledWith("message").should.equal true

	describe "_processMessageFromDocumentUpdater", ->
		describe "with update", ->
			beforeEach ->
				@message =
					doc_id: @doc_id
					op: {t: "foo", p: 12}
				@EditorUpdatesController._applyUpdateFromDocumentUpdater = sinon.stub()
				@EditorUpdatesController._processMessageFromDocumentUpdater "applied-ops", JSON.stringify(@message)

			it "should apply the update", ->
				@EditorUpdatesController._applyUpdateFromDocumentUpdater
					.calledWith(@doc_id, @message.op)
					.should.equal true

		describe "with error", ->
			beforeEach ->
				@message =
					doc_id: @doc_id
					error: "Something went wrong"
				@EditorUpdatesController._processErrorFromDocumentUpdater = sinon.stub()
				@EditorUpdatesController._processMessageFromDocumentUpdater "applied-ops", JSON.stringify(@message)

			it "should process the error", ->
				@EditorUpdatesController._processErrorFromDocumentUpdater
					.calledWith(@doc_id, @message.error)
					.should.equal true

	describe "_applyUpdateFromDocumentUpdater", ->
		beforeEach ->
			@sourceClient = new MockClient()
			@otherClients = [new MockClient(), new MockClient()]
			@update =
				op: [ t: "foo", p: 12 ]
				meta: source: @sourceClient.id
				v: @version = 42
				doc: @doc_id
			@io.sockets =
				clients: sinon.stub().returns([@sourceClient, @otherClients...])
			@EditorUpdatesController._applyUpdateFromDocumentUpdater @doc_id, @update

		it "should send a version bump to the source client", ->
			@sourceClient.emit
				.calledWith("otUpdateApplied", v: @version, doc: @doc_id)
				.should.equal true

		it "should get the clients connected to the document", ->
			@io.sockets.clients
				.calledWith(@doc_id)
				.should.equal true

		it "should send the full update to the other clients", ->
			for client in @otherClients
				client.emit
					.calledWith("otUpdateApplied", @update)
					.should.equal true

	describe "_processErrorFromDocumentUpdater", ->
		beforeEach ->
			@clients = [new MockClient(), new MockClient()]
			@io.sockets =
				clients: sinon.stub().returns(@clients)
			@EditorUpdatesController._processErrorFromDocumentUpdater @doc_id, "Something went wrong"

		it "should log out an error", ->
			@logger.error.called.should.equal true

		it "should disconnect all clients in that document", ->
			@io.sockets.clients.calledWith(@doc_id).should.equal true
			for client in @clients
				client.disconnect.called.should.equal true

