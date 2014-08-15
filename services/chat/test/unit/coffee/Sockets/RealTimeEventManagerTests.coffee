SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = "../../../../app/js/Features/Sockets/RealTimeEventManager.js"

describe "RealTimeEventManager", ->

	beforeEach ->
		@settings = 
			redis:
				web:
					host: "host here"
					port: "port here"
					password: "password here"
		@RealTimeEventManager = SandboxedModule.require modulePath, requires:
			"redis": 
				createClient: () ->
					auth:->
			"../../server" : io: @io = {}
			"settings-sharelatex":@settings
		@RealTimeEventManager.rclientPub = publish: sinon.stub()
		@RealTimeEventManager.rclientSub =
			subscribe: sinon.stub()
			on: sinon.stub()
		
		@room_id = "room-id-here"
		@message = "message-to-chat-here"
		@payload = ["argument one", 42]

	describe "emitToRoom", ->
		beforeEach ->
			@RealTimeEventManager.emitToRoom(@room_id, @message, @payload...)

		it "should publish the message to redis", ->
			@RealTimeEventManager.rclientPub.publish
				.calledWith("chat-events", JSON.stringify(
					room_id: @room_id,
					message: @message
					payload: @payload
				))
				.should.equal true
			
	describe "listenForChatEvents", ->
		beforeEach ->
			@RealTimeEventManager._processEditorEvent = sinon.stub()
			@RealTimeEventManager.listenForChatEvents()

		it "should subscribe to the chat-events channel", ->
			@RealTimeEventManager.rclientSub.subscribe
				.calledWith("chat-events")
				.should.equal true

		it "should process the events with _processEditorEvent", ->
			@RealTimeEventManager.rclientSub.on
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
				@RealTimeEventManager._processEditorEvent("chat-events", data)

			it "should send the message to all clients in the room", ->
				@io.sockets.in
					.calledWith(@room_id)
					.should.equal true
				@emit.calledWith(@message, @payload...).should.equal true

		