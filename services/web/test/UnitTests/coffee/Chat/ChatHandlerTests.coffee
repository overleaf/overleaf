should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Chat/ChatHandler"
expect = require("chai").expect

describe "ChatHandler", ->

	beforeEach ->

		@settings = 
			apis:
				chat:
					url:"chat.sharelatex.env"
		@request = sinon.stub()
		@ChatHandler = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"request": @request
		@project_id = "3213213kl12j"
		@user_id = "2k3jlkjs9"
		@messageContent = "my message here"

	describe "sending message", ->

		beforeEach ->
			@messageResponse = 
				message:"Details"
			@request.callsArgWith(1, null, null, @messageResponse)

		it "should post the data to the chat api", (done)->

			@ChatHandler.sendMessage @project_id, @user_id, @messageContent, (err)=>
				@opts =
					method:"post"
					json:
						content:@messageContent
						user_id:@user_id
					uri:"#{@settings.apis.chat.url}/room/#{@project_id}/messages"
				@request.calledWith(@opts).should.equal true
				done()

		it "should return the message from the post", (done)->			
			@ChatHandler.sendMessage @project_id, @user_id, @messageContent, (err, returnedMessage)=>
				returnedMessage.should.equal @messageResponse
				done()

	describe "get messages", ->

		beforeEach ->
			@returnedMessages = [{content:"hello world"}]
			@request.callsArgWith(1, null, null, @returnedMessages)

		it "should make get request for room to chat api", (done)->

			@ChatHandler.getMessages @project_id, (err)=>
				@opts =
					method:"get"
					uri:"#{@settings.apis.chat.url}/room/#{@project_id}/messages"
				@request.calledWith(@opts).should.equal true
				done()

		it "should return the messages from the request", (done)->
			@ChatHandler.getMessages @project_id, (err, returnedMessages)=>
				returnedMessages.should.equal @returnedMessages
				done()






