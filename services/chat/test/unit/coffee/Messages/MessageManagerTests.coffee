sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Messages/MessageManager.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
ObjectId = require("mongojs").ObjectId

describe "MessageManager", ->
	beforeEach ->
		@MessageManager = SandboxedModule.require modulePath, requires:
			"../WebApi/WebApiManager": @WebApiManager = {}
			"../../mongojs": {} 
		@callback = sinon.stub()

	describe "populateMessagesWithUsers", ->
		beforeEach ->
			@user0 =
				id: ObjectId().toString()
				first_name: "Adam"
			@user1 =
				id: ObjectId().toString()
				first_name: "Eve"
			@users = {}
			@users[@user0.id] = @user0
			@users[@user1.id] = @user1
			@messages = [{
				content: "First message content"
				user_id: ObjectId(@user0.id)
			}, {
				content: "Second message content"
				user_id: ObjectId(@user0.id)
			}, {
				content: "Third message content"
				user_id: ObjectId(@user1.id)
			}]
			@WebApiManager.getUserDetails = (user_id, callback = (error, user) ->) =>
				callback null, @users[user_id]
			sinon.spy @WebApiManager, "getUserDetails"
			@MessageManager.populateMessagesWithUsers @messages, @callback

		it "should insert user objects in the place of user_ids", ->
			messages = @callback.args[0][1]
			expect(messages).to.deep.equal [{
				content: "First message content"
				user: @user0
			}, {
				content: "Second message content"
				user: @user0
			}, {
				content: "Third message content"
				user: @user1
			}]

		it "should call getUserDetails once and only once for each user", ->
			@WebApiManager.getUserDetails.calledWith(@user0.id).should.equal true
			@WebApiManager.getUserDetails.calledWith(@user1.id).should.equal true
			@WebApiManager.getUserDetails.calledTwice.should.equal true
			

