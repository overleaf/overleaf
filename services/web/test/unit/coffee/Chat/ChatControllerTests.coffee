should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Chat/ChatController"
expect = require("chai").expect

describe "ChatController", ->
	beforeEach ->
		@user_id = 'mock-user-id'
		@settings = {}
		@ChatApiHandler = {}
		@EditorRealTimeController =
			emitToRoom:sinon.stub()
		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@user_id)
		@ChatController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings
			"logger-sharelatex": log: ->
			"./ChatApiHandler": @ChatApiHandler
			"../Editor/EditorRealTimeController": @EditorRealTimeController
			'../Authentication/AuthenticationController': @AuthenticationController
			'../User/UserInfoManager': @UserInfoManager = {}
			'../User/UserInfoController': @UserInfoController = {}
			'../Comments/CommentsController': @CommentsController = {}
		@req =
			params:
				project_id: @project_id
		@res =
			json: sinon.stub()
			send: sinon.stub()

	describe "sendMessage", ->
		beforeEach ->
			@req.body =
				content: @content = "message-content"
			@UserInfoManager.getPersonalInfo = sinon.stub().yields(null, @user = {"unformatted": "user"})
			@UserInfoController.formatPersonalInfo = sinon.stub().returns(@formatted_user = {"formatted": "user"})
			@ChatApiHandler.sendGlobalMessage = sinon.stub().yields(null, @message = {"mock": "message", user_id: @user_id})
			@ChatController.sendMessage @req, @res

		it "should look up the user", ->
			@UserInfoManager.getPersonalInfo
				.calledWith(@user_id)
				.should.equal true

		it "should format and inject the user into the message", ->
			@UserInfoController.formatPersonalInfo
				.calledWith(@user)
				.should.equal true
			@message.user.should.deep.equal @formatted_user

		it "should tell the chat handler about the message", ->
			@ChatApiHandler.sendGlobalMessage
				.calledWith(@project_id, @user_id, @content)
				.should.equal true

		it "should tell the editor real time controller about the update with the data from the chat handler", ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, "new-chat-message", @message)
				.should.equal true
				
		it "should return a 204 status code", ->
			@res.send.calledWith(204).should.equal true

	describe "getMessages", ->
		beforeEach ->
			@req.query =
				limit: @limit = "30"
				before: @before = "12345"
			@ChatController._injectUserInfoIntoThreads = sinon.stub().yields()
			@ChatApiHandler.getGlobalMessages = sinon.stub().yields(null, @messages = ["mock", "messages"])
			@ChatController.getMessages @req, @res

		it "should ask the chat handler about the request", ->
			@ChatApiHandler.getGlobalMessages
				.calledWith(@project_id, @limit, @before)
				.should.equal true

		it "should return the messages", ->
			@res.json.calledWith(@messages).should.equal true

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
			@ChatController._injectUserInfoIntoThreads {
				thread1: {
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
				thread2: {
					messages: [{
						user_id: "user_id_1"
						content: "baz"
					}]
				}
			}, (error, threads) ->
				expect(threads).to.deep.equal {
					thread1: {
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
					thread2: {
						messages: [{
							user_id: "user_id_1"
							user: { "formatted": "user_1" }
							content: "baz"
						}]
					}
				}
				done()

		it "should only need to look up each user once", (done) ->
			@ChatController._injectUserInfoIntoThreads [{
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