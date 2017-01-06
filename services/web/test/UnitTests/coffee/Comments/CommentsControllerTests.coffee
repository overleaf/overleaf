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
			'../User/UserInfoManager': @UserInfoManager = {}
			'../User/UserInfoController': @UserInfoController = {}
		@req = {}
		@res =
			json: sinon.stub()
			send: sinon.stub()

	describe "sendComment", ->
		beforeEach ->
			@req.params =
				project_id: @project_id = "mock-project-id"
				thread_id: @thread_id = "mock-thread-id"
			@req.body =
				content: @content = "message-content"
			@UserInfoManager.getPersonalInfo = sinon.stub().yields(null, @user = {"unformatted": "user"})
			@UserInfoController.formatPersonalInfo = sinon.stub().returns(@formatted_user = {"formatted": "user"})
			@ChatApiHandler.sendComment = sinon.stub().yields(null, @message = {"mock": "message", user_id: @user_id})
			@CommentsController.sendComment @req, @res
		
		it "should look up the user", ->
			@UserInfoManager.getPersonalInfo
				.calledWith(@user_id)
				.should.equal true

		it "should format and inject the user into the comment", ->
			@UserInfoController.formatPersonalInfo
				.calledWith(@user)
				.should.equal true
			@message.user.should.deep.equal @formatted_user

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
				project_id: @project_id = "mock-project-id"
			@ChatApiHandler.getThreads = sinon.stub().yields(null, @threads = {"mock", "threads"})
			@CommentsController._injectUserInfoIntoThreads = sinon.stub().yields(null, @threads)
			@CommentsController.getThreads @req, @res

		it "should ask the chat handler about the request", ->
			@ChatApiHandler.getThreads
				.calledWith(@project_id)
				.should.equal true
			
		it "should inject the user details into the threads", ->
			@CommentsController._injectUserInfoIntoThreads
				.calledWith(@threads)
				.should.equal true

		it "should return the messages", ->
			@res.json.calledWith(@threads).should.equal true

	describe "resolveThread", ->
		beforeEach ->
			@req.params =
				project_id: @project_id = "mock-project-id"
				thread_id: @thread_id = "mock-thread-id"
			@ChatApiHandler.resolveThread = sinon.stub().yields()
			@UserInfoManager.getPersonalInfo = sinon.stub().yields(null, @user = {"unformatted": "user"})
			@UserInfoController.formatPersonalInfo = sinon.stub().returns(@formatted_user = {"formatted": "user"})
			@CommentsController.resolveThread @req, @res

		it "should ask the chat handler to resolve the thread", ->
			@ChatApiHandler.resolveThread
				.calledWith(@project_id, @thread_id)
				.should.equal true
			
		it "should look up the user", ->
			@UserInfoManager.getPersonalInfo
				.calledWith(@user_id)
				.should.equal true

		it "should tell the client the comment was resolved", ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, "resolve-thread", @thread_id, @formatted_user)
				.should.equal true

		it "should return a success code", ->
			@res.send.calledWith(204).should.equal

	describe "reopenThread", ->
		beforeEach ->
			@req.params =
				project_id: @project_id = "mock-project-id"
				thread_id: @thread_id = "mock-thread-id"
			@ChatApiHandler.reopenThread = sinon.stub().yields()
			@CommentsController.reopenThread @req, @res

		it "should ask the chat handler to reopen the thread", ->
			@ChatApiHandler.reopenThread
				.calledWith(@project_id, @thread_id)
				.should.equal true

		it "should tell the client the comment was resolved", ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, "reopen-thread", @thread_id)
				.should.equal true

		it "should return a success code", ->
			@res.send.calledWith(204).should.equal

	describe "_injectUserInfoIntoThreads", ->
		beforeEach ->
			@users = {
				"user_id_1": {
					"mock": "user_1"
				}
				"user_id_2": {
					"mock": "user_2"
				}
			}
			@UserInfoManager.getPersonalInfo = (user_id, callback) =>
				return callback(null, @users[user_id])
			sinon.spy @UserInfoManager, "getPersonalInfo"
			@UserInfoController.formatPersonalInfo = (user) ->
				return { "formatted": user["mock"] }
			
		it "should inject a user object into messaged and resolved data", (done) ->
			@CommentsController._injectUserInfoIntoThreads [
				{
					resolved: true
					resolved_by_user_id: "user_id_1"
					messages: [{
						user_id: "user_id_1"
						content: "foo"
					}, {
						user_id: "user_id_2"
						content: "bar"
					}]
				},
				{
					messages: [{
						user_id: "user_id_1"
						content: "baz"
					}]
				}
			], (error, threads) ->
				expect(threads).to.deep.equal [
					{
						resolved: true
						resolved_by_user_id: "user_id_1"
						resolved_by_user: { "formatted": "user_1" }
						messages: [{
							user_id: "user_id_1"
							user: { "formatted": "user_1" }
							content: "foo"
						}, {
							user_id: "user_id_2"
							user: { "formatted": "user_2" }
							content: "bar"
						}]
					},
					{
						messages: [{
							user_id: "user_id_1"
							user: { "formatted": "user_1" }
							content: "baz"
						}]
					}
				]
				done()

		it "should only need to look up each user once", (done) ->
			@CommentsController._injectUserInfoIntoThreads [{
				messages: [{
					user_id: "user_id_1"
					content: "foo"
				}, {
					user_id: "user_id_1"
					content: "bar"
				}]
			}], (error, threads) =>
				@UserInfoManager.getPersonalInfo.calledOnce.should.equal true
				done()