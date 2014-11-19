SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/Editor/EditorRealTimeController'

describe "EditorRealTimeController", ->
	beforeEach ->
		@EditorRealTimeController = SandboxedModule.require modulePath, requires:
			"redis-sharelatex": 
				createClient: () ->
					auth:->
				createMonitoredSubscriptionClient: () ->
					auth:->
			"../../infrastructure/Server" : io: @io = {}
		@EditorRealTimeController.rclientPub = publish: sinon.stub()
		@EditorRealTimeController.rclientSub =
			subscribe: sinon.stub()
			on: sinon.stub()
		
		@room_id = "room-id"
		@message = "message-to-editor"
		@payload = ["argument one", 42]

	describe "emitToRoom", ->
		beforeEach ->
			@EditorRealTimeController.emitToRoom(@room_id, @message, @payload...)

		it "should publish the message to redis", ->
			@EditorRealTimeController.rclientPub.publish
				.calledWith("editor-events", JSON.stringify(
					room_id: @room_id,
					message: @message
					payload: @payload
				))
				.should.equal true

	describe "emitToAll", ->
		beforeEach ->
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@EditorRealTimeController.emitToAll @message, @payload...

		it "should emit to the room 'all'", ->
			@EditorRealTimeController.emitToRoom
				.calledWith("all", @message, @payload...)
				.should.equal true
			
	describe "listenForEditorEvents", ->
		beforeEach ->
			@EditorRealTimeController._processEditorEvent = sinon.stub()
			@EditorRealTimeController.listenForEditorEvents()

		it "should subscribe to the editor-events channel", ->
			@EditorRealTimeController.rclientSub.subscribe
				.calledWith("editor-events")
				.should.equal true

		it "should process the events with _processEditorEvent", ->
			@EditorRealTimeController.rclientSub.on
				.calledWith("message", sinon.match.func)
				.should.equal true

	describe "_processEditorEvent", ->
		describe "with a designated room", ->
			beforeEach ->
				@io.sockets =
					in: sinon.stub().returns(emit: @emit = sinon.stub())
				data = JSON.stringify
					room_id: @room_id
					message: @message
					payload: @payload
				@EditorRealTimeController._processEditorEvent("editor-events", data)

			it "should send the message to all clients in the room", ->
				@io.sockets.in
					.calledWith(@room_id)
					.should.equal true
				@emit.calledWith(@message, @payload...).should.equal true

		describe "when emitting to all", ->
			beforeEach ->
				@io.sockets =
					emit: @emit = sinon.stub()
				data = JSON.stringify
					room_id: "all"
					message: @message
					payload: @payload
				@EditorRealTimeController._processEditorEvent("editor-events", data)

			it "should send the message to all clients", ->
				@emit.calledWith(@message, @payload...).should.equal true
			
