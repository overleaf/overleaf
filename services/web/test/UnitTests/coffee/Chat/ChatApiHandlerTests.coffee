should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Chat/ChatApiHandler"
expect = require("chai").expect

describe "ChatApiHandler", ->
	beforeEach ->
		@settings = 
			apis:
				chat:
					internal_url:"chat.sharelatex.env"
		@request = sinon.stub()
		@ChatApiHandler = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings
			"logger-sharelatex": { log: sinon.stub(), error: sinon.stub() }
			"request": @request
		@project_id = "3213213kl12j"
		@user_id = "2k3jlkjs9"
		@content = "my message here"
		@callback = sinon.stub()

	describe "sendGlobalMessage", ->
		describe "successfully", ->
			beforeEach ->
				@message = { "mock": "message" }
				@request.callsArgWith(1, null, {statusCode: 200}, @message)
				@ChatApiHandler.sendGlobalMessage @project_id, @user_id, @content, @callback
				
			it "should post the data to the chat api", ->
				@request.calledWith({
					url: "#{@settings.apis.chat.internal_url}/project/#{@project_id}/messages"
					method: "POST"
					json:
						content: @content
						user_id: @user_id
				}).should.equal true

			it "should return the message from the post", ->
				@callback.calledWith(null, @message).should.equal true
	
		describe "with a non-success status code", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 500})
				@ChatApiHandler.sendGlobalMessage @project_id, @user_id, @content, @callback
			
			it "should return an error", ->
				error = new Error()
				error.statusCode = 500
				@callback.calledWith(error).should.equal true

	describe "getGlobalMessages", ->
		beforeEach ->
			@messages = [{ "mock": "message" }]
			@limit = 30
			@before = "1234"

		describe "successfully", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 200}, @messages)
				@ChatApiHandler.getGlobalMessages @project_id, @limit, @before, @callback
	
			it "should make get request for room to chat api", ->
				@request.calledWith({
					method: "GET"
					url: "#{@settings.apis.chat.internal_url}/project/#{@project_id}/messages"
					qs:
						limit: @limit
						before: @before
					json: true
				}).should.equal true
	
			it "should return the messages from the request", ->
				@callback.calledWith(null, @messages).should.equal true

		describe "with failure error code", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 500}, null)
				@ChatApiHandler.getGlobalMessages @project_id, @limit, @before, @callback
			
			it "should return an error", ->
				error = new Error()
				error.statusCode = 500
				@callback.calledWith(error).should.equal true






