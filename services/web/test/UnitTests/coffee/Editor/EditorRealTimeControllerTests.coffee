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
			"../../infrastructure/Server" : io: @io = {}
			"settings-sharelatex":{redis:{}}
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
