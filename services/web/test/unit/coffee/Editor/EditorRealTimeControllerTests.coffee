SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/Editor/EditorRealTimeController'

describe "EditorRealTimeController", ->
	beforeEach ->
		@rclient =
			publish: sinon.stub()
		@EditorRealTimeController = SandboxedModule.require modulePath, requires:
			"../../infrastructure/RedisWrapper":
				client: () => @rclient
			"../../infrastructure/Server" : io: @io = {}
			"settings-sharelatex":{redis:{}}
			"crypto": @crypto = { randomBytes: sinon.stub().withArgs(4).returns(Buffer.from([0x1, 0x2, 0x3, 0x4])) }
			"os": @os = {hostname: sinon.stub().returns("somehost")}

		@room_id = "room-id"
		@message = "message-to-editor"
		@payload = ["argument one", 42]

	describe "emitToRoom", ->
		beforeEach ->
			@message_id = "web:somehost:01020304-0"
			@EditorRealTimeController.emitToRoom(@room_id, @message, @payload...)

		it "should publish the message to redis", ->
			@rclient.publish
				.calledWith("editor-events", JSON.stringify(
					room_id: @room_id,
					message: @message
					payload: @payload
					_id: @message_id
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
