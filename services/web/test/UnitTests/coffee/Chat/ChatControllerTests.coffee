should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Chat/ChatController"
expect = require("chai").expect

describe "ChatController", ->

	beforeEach ->

		@settings = {}
		@ChatHandler = 
			sendMessage:sinon.stub()
			getMessages:sinon.stub()

		@EditorRealTimeController =
			emitToRoom:sinon.stub().callsArgWith(3)
		@ChatController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"./ChatHandler":@ChatHandler
			"../Editor/EditorRealTimeController":@EditorRealTimeController
		@query = 
			before:"some time"

		@req =
			params:
				Project_id:@project_id
			session:
				user:
					_id:@user_id
			body:
				content:@messageContent
		@res = {}

	describe "sendMessage", ->

		it "should tell the chat handler about the message", (done)->
			@ChatHandler.sendMessage.callsArgWith(3)
			@res.send = =>
				@ChatHandler.sendMessage.calledWith(@project_id, @user_id, @messageContent).should.equal true
				done()
			@ChatController.sendMessage @req, @res

		it "should tell the editor real time controller about the update with the data from the chat handler", (done)->
			@chatMessage =
				content:"hello world"
			@ChatHandler.sendMessage.callsArgWith(3, null, @chatMessage)
			@res.send = =>
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, "new-chat-message", @chatMessage).should.equal true
				done()
			@ChatController.sendMessage @req, @res

	describe "getMessages", ->
		beforeEach ->
			@req.body = @query

		it "should ask the chat handler about the request", (done)->

			@ChatHandler.getMessages.callsArgWith(2)
			@res.send = =>
				@ChatHandler.getMessages.calledWith(@project_id, @query).should.equal true
				done()
			@ChatController.getMessages @req, @res

		it "should return the messages", (done)->
			messages = [{content:"hello"}]
			@ChatHandler.getMessages.callsArgWith(2, null, messages)
			@ChatController.getMessages @project_id, @query, (err, passedMessages)=>
				passedMessages.should.deep.equal messages
				done()

