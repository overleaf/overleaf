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

		@ChatController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"./ChatHandler":@ChatHandler
		@query = 
			before:"some time"



	describe "sendMessage", ->

		it "should tell the chat handler about the message", (done)->
			@ChatHandler.sendMessage.callsArgWith(3)
			@ChatController.sendMessage @project_id, @user_id, @messageContent, (err)=>
				@ChatHandler.sendMessage.calledWith(@project_id, @user_id, @messageContent).should.equal true
				done()

	describe "getMessages", ->

		it "should tell the chat handler about the request", (done)->

			@ChatHandler.getMessages.callsArgWith(2)
			@ChatController.getMessages @project_id, @query, (err)=>
				@ChatHandler.getMessages.calledWith(@project_id, @query).should.equal true
				done()

