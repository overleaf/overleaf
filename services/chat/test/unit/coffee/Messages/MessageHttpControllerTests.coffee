should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Messages/MessageHttpController"
expect = require("chai").expect
tk = require("timekeeper")

describe "MessagesHttpController", ->

	beforeEach ->

		@settings = {}
		@date = Date.now()
		tk.freeze(@date)
		@MessagesHttpController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"./MessageManager": @MessageManager = {}
			"./MessageFormatter": @MessageFormatter = {}
			"../Rooms/RoomManager": @RoomManager = {}

		@req = 
			body:{}
		@res = {}
		@project_id = "12321321"
		@room_id = "Asdfadf adfafd"
		@user_id = "09832910838239081203981"
		@content = "my message here"


	afterEach ->
		tk.reset()

	describe "sendMessage", ->

		beforeEach ->
			@initialMessage = {content:@content}
			@MessageManager.createMessage = sinon.stub().callsArgWith(1, null, @initialMessage)
			@req.params =
				project_id:@project_id
			@req.body =
				user_id:@user_id
				content:@content
			@singlePopulatedMessage = {data:"here"}
			@MessageManager.populateMessagesWithUsers = sinon.stub().callsArgWith(1, null, [@singlePopulatedMessage])
			@RoomManager.findOrCreateRoom = sinon.stub().callsArgWith(1, null, @room = { _id : @room_id })
			@formattedMessage = {formatted:true}
			@MessageFormatter.formatMessageForClientSide = sinon.stub().returns(@formattedMessage)

		it "should look up the room for the project", ->
			@res.send = =>
				@RoomManager.findOrCreateRoom
					.calledWith({
						project_id: @project_id
					})
					.should.equal true
				done()

		it "should create the message with the message manager", (done)->
			@res.send = =>
				@MessageManager.createMessage
					.calledWith({
						content: @content
						user_id: @user_id
						room_id: @room_id
						timestamp: @date
					})
					.should.equal true
				done()
			@MessagesHttpController.sendMessage @req, @res


		it "should return the formetted message", (done)->

			@res.send = (code, data)=>
				assert.deepEqual @MessageManager.populateMessagesWithUsers.args[0][0], [@initialMessage]
				code.should.equal 201
				data.should.equal @formattedMessage
				done()

			@MessagesHttpController.sendMessage @req, @res


	describe "getMessages", ->

		beforeEach ->
			@project_id = "room-id-123"
			@timestamp = Date.now()
			@limit = 42

			@messages = "messages without users stub"
			@messagesWithUsers = "messages with users stub"
			@formattedMessages = "formatted messages stub"
			@RoomManager.findOrCreateRoom = sinon.stub().callsArgWith(1, null, @room = { _id : @room_id })
			@MessageManager.getMessages = sinon.stub().callsArgWith(2, null, @messages)
			@MessageManager.populateMessagesWithUsers = sinon.stub().callsArgWith(1, null, @messagesWithUsers)
			@MessageFormatter.formatMessagesForClientSide = sinon.stub().returns @formattedMessages


		describe "with a timestamp and limit", ->
			beforeEach ->
				@req.params =
					project_id:@project_id
				@req.query = 
					before: @timestamp,
					limit: "#{@limit}"
					
					
			it "should look up the room for the project", ->
				@res.send = =>
					@RoomManager.findOrCreateRoom
						.calledWith({
							project_id: @project_id
						})
						.should.equal true
					done()

			it "should get the requested messages", ->
				@res.send = =>
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
				
				@MessagesHttpController.getMessages(@req, @res)

			it "should populate the messages with the users", (done)->
				@res.send = =>
					@MessageManager.populateMessagesWithUsers.calledWith(@messages).should.equal true
					done()

				@MessagesHttpController.getMessages(@req, @res)

			it "should return the formatted messages", (done)->
				@res.send = ()=>
					@MessageFormatter.formatMessagesForClientSide.calledWith(@messagesWithUsers).should.equal true
					done()
				@MessagesHttpController.getMessages(@req, @res)

			it "should send the formated messages back with a 200", (done)->
				@res.send = (code, data)=>
					code.should.equal 200
					data.should.equal @formattedMessages
					done()
				@MessagesHttpController.getMessages(@req, @res)

		describe "without a timestamp or limit", ->
			beforeEach ->
				@req.params =
					project_id:@project_id

			
			it "should get a default number of messages from the beginning", ->
				@res.send = =>
					@MessageManager.getMessages
						.calledWith({
							room_id: @room_id
						}, {
							limit: @MessagesHttpController.DEFAULT_MESSAGE_LIMIT
							order_by: "timestamp"
							sort_order: -1
						})
						.should.equal true

				@MessagesHttpController.getMessages(@req, @res)
