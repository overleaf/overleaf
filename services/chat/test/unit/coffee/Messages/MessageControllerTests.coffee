sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Messages/MessageController.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
tk = require "timekeeper"
ObjectId = require("mongojs").ObjectId

describe "MessageController", ->
	beforeEach ->
		tk.freeze(new Date())
		@MessageController = SandboxedModule.require modulePath, requires:
			"./MessageManager": @MessageManager = {}
			"./MessageFormatter": @MessageFormatter = {}
			"../Sockets/SocketManager": @SocketManager = {}
			"../Authorization/AuthorizationManager": @AuthorizationManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub() }
			"../../metrics": @metrics = {inc: sinon.stub()}
		@callback = sinon.stub()
		@client =
			params:
				id: @user_id = "user-id-123"
				first_name: @first_name = "Douglas"
				last_name: @last_name = "Adams"
				email: @email = "doug@sharelatex.com"
				gravatar_url: @gravatar_url = "//gravatar/url"
			get: (key, callback = (error, value) ->) -> callback null, @params[key]
	
	afterEach ->
		tk.reset()

	describe "sendMessage", ->
		beforeEach ->
			@MessageManager.createMessage = sinon.stub().callsArg(1)
			@SocketManager.emitToRoom = sinon.stub()
			@singlePopulatedMessage = {data:"here"}
			@formattedMessage = {formatted:true}
			@MessageFormatter.formatMessageForClientSide = sinon.stub().returns(@formattedMessage)
			@MessageManager.populateMessagesWithUsers = sinon.stub().callsArgWith(1, null, [@singlePopulatedMessage])
			@SocketManager.getClientAttributes = (client, attributes, callback) ->
				values = (client.params[key] for key in attributes)
				callback null, values

		describe "when the client is authorized to send a message to the room", ->
			beforeEach ->
				@AuthorizationManager.canClientSendMessageToRoom = sinon.stub().callsArgWith(2, null, true)
				@MessageController.sendMessage(@client, {
					message:
						content: @content = "Hello world"
					room:
						id: @room_id = "room-id-123"
				}, @callback)

			it "should check that the client can send a message to the room", ->
				@AuthorizationManager.canClientSendMessageToRoom
					.calledWith(@client, @room_id)
					.should.equal true

			it "should insert the message into the database", ->
				@MessageManager.createMessage
					.calledWith({
						content: @content
						user_id: @user_id
						room_id: @room_id
						timestamp: Date.now()
					})
					.should.equal true


			it "should format the message for the client", ->
				@MessageFormatter.formatMessageForClientSide.calledWith(@singlePopulatedMessage).should.equal true

			it "should send the formatted message out to the other clients in the room", ->
				@SocketManager.emitToRoom.calledWith(@room_id, "messageReceived", message:@formattedMessage).should.equal true

			it "should record the message as a metric", ->
				@metrics.inc
					.calledWith("editor.instant-message")
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the client is not authorized", ->
			beforeEach ->
				@AuthorizationManager.canClientSendMessageToRoom = sinon.stub().callsArgWith(2, null, false)
				@MessageController.sendMessage(@client, {
					message:
						content: @content = "Hello world"
					room:
						id: @room_id = "room-id-123"
				}, @callback)

			it "should not insert the message into the database", ->
				@MessageManager.createMessage.called.should.equal false
				
			it "should not send the message out to the other clients in the room", ->
				@SocketManager.emitToRoom.called.should.equal false

			it "should call the callback with an error that doesn't give anything away", ->
				@callback.calledWith("unknown room").should.equal true

	describe "getMessage", ->
		beforeEach ->
			@room_id = "room-id-123"
			@timestamp = Date.now()
			@limit = 42

		describe "when the client is authorized", ->
			beforeEach ->
				@messages = "messages without users stub"
				@messagesWithUsers = "messages with users stub"
				@formattedMessages = "formatted messages stub"
				@MessageManager.getMessages = sinon.stub().callsArgWith(2, null, @messages)
				@MessageManager.populateMessagesWithUsers = sinon.stub().callsArgWith(1, null, @messagesWithUsers)
				@AuthorizationManager.canClientReadMessagesInRoom = sinon.stub().callsArgWith(2, null, true)
				@MessageFormatter.formatMessagesForClientSide = sinon.stub().returns @formattedMessages

			describe "with a timestamp and limit", ->
				beforeEach ->
					@MessageController.getMessages(@client, {
						room:
							id: @room_id,
						before: @timestamp,
						limit: @limit
					}, @callback)

				it "should get the requested messages", ->
					@MessageManager.getMessages
						.calledWith({
							timestamp: $lt: @timestamp
							room_id: @room_id
						}, {
							limit: @limit
							order_by: "timestamp"
							sort_order: -1
						})
						.should.equal true

				it "should populate the messages with the users", ->
					@MessageManager.populateMessagesWithUsers
						.calledWith(@messages)
						.should.equal true

				it "should return the formatted messages", ->
					@MessageFormatter.formatMessagesForClientSide
						.calledWith(@messagesWithUsers)
						.should.equal true

				it "should call the callback with the formatted messages", ->
					@callback
						.calledWith(null, @formattedMessages)
						.should.equal true

			describe "without a timestamp or limit", ->
				beforeEach ->
					@MessageController.getMessages(@client, {
						room:
							id: @room_id,
					}, @callback)
				
				it "should get a default number of messages from the beginning", ->
					@MessageManager.getMessages
						.calledWith({
							room_id: @room_id
						}, {
							limit: @MessageController.DEFAULT_MESSAGE_LIMIT
							order_by: "timestamp"
							sort_order: -1
						})
						.should.equal true

		describe "when the client is not authorized", ->
			beforeEach ->
				@AuthorizationManager.canClientReadMessagesInRoom = sinon.stub().callsArgWith(2, null, false)
				@MessageController.getMessages(@client, {
					room:
						id: @room_id,
					before: @timestamp,
					limit: @limit
				}, @callback)

			it "should call the callback with an error", ->
				@callback.calledWith("unknown room").should.equal true
				
