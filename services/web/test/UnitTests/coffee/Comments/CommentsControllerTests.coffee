should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Comments/CommentsController"
expect = require("chai").expect

describe "CommentsController", ->
	beforeEach ->
		@user_id = 'mock-user-id'
		@settings = {}
		@ChatApiHandler = {}
		@EditorRealTimeController =
			emitToRoom:sinon.stub()
		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@user_id)
		@CommentsController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings
			"logger-sharelatex": log: ->
			"../Chat/ChatApiHandler": @ChatApiHandler
			"../Editor/EditorRealTimeController": @EditorRealTimeController
			'../Authentication/AuthenticationController': @AuthenticationController
		@req = {}
		@res =
			json: sinon.stub()
			send: sinon.stub()

	describe "sendComment", ->
		beforeEach ->
			@req.params =
				project_id: @project_id
				thread_id: @thread_id
			@req.body =
				content: @content = "message-content"
			@ChatApiHandler.sendComment = sinon.stub().yields(null, @message = {"mock": "message"})
			@CommentsController.sendComment @req, @res

		it "should tell the chat handler about the message", ->
			@ChatApiHandler.sendComment
				.calledWith(@project_id, @thread_id, @user_id, @content)
				.should.equal true

		it "should tell the editor real time controller about the update with the data from the chat handler", ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, "new-comment", @thread_id, @message)
				.should.equal true
				
		it "should return a 204 status code", ->
			@res.send.calledWith(204).should.equal true

	describe "getThreads", ->
		beforeEach ->
			@req.params =
				project_id: @project_id
			@ChatApiHandler.getThreads = sinon.stub().yields(null, @threads = {"mock", "threads"})
			@CommentsController.getThreads @req, @res

		it "should ask the chat handler about the request", ->
			@ChatApiHandler.getThreads
				.calledWith(@project_id)
				.should.equal true

		it "should return the messages", ->
			@res.json.calledWith(@threads).should.equal true