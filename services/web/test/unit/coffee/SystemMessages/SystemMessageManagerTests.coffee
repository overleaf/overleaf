SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/SystemMessages/SystemMessageManager.js'


describe 'SystemMessageManager', ->
	beforeEach ->
		@SystemMessage = {}
		@SystemMessageManager = SandboxedModule.require modulePath, requires:
			"../../models/SystemMessage": SystemMessage: @SystemMessage
		@callback = sinon.stub()
			
	describe "getMessage", ->
		beforeEach ->
			@messages = ["messages-stub"]
			@SystemMessage.find = sinon.stub().callsArgWith(1, null, @messages)
			
		describe "when the messages are not cached", ->
			beforeEach ->
				@SystemMessageManager.getMessages @callback
				
			it "should look the messages up in the database", ->
				@SystemMessage.find
					.calledWith({})
					.should.equal true
					
			it "should return the messages", ->
				@callback.calledWith(null, @messages).should.equal true
				
			it "should cache the messages", ->
				@SystemMessageManager._cachedMessages.should.equal @messages
				
		describe "when the messages are cached", ->
			beforeEach ->
				@SystemMessageManager._cachedMessages = @messages
				@SystemMessageManager.getMessages @callback
				
			it "should not look the messages up in the database", ->
				@SystemMessage.find.called.should.equal false
					
			it "should return the messages", ->
				@callback.calledWith(null, @messages).should.equal true
				
	describe "clearMessages", ->
		beforeEach ->
			@SystemMessage.remove = sinon.stub().callsArg(1)
			@SystemMessageManager.clearMessages @callback
			
		it "should remove the messages from the database", ->
			@SystemMessage.remove
				.calledWith({})
				.should.equal true
				
		it "should return the callback", ->
			@callback.called.should.equal true
			
			
