SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
assert = require("chai").assert
modulePath = "../../../../app/js/Features/Subscription/SubscriptionGroupController"
MockResponse = require "../helpers/MockResponse"

describe "Subscription Group Controller", ->

	beforeEach ->
		@user = {_id:"!@312431",email:"user@email.com"}
		@subscription = {}
		@GroupHandler = 
			addUserToGroup: sinon.stub().callsArgWith(2, null, @user)
			removeUserFromGroup: sinon.stub().callsArgWith(2)
			getPopulatedListOfMembers: sinon.stub().callsArgWith(1, null, [@user])
		@SubscriptionLocator = getUsersSubscription: sinon.stub().callsArgWith(1, null, @subscription)

		@Controller = SandboxedModule.require modulePath, requires:
			"./SubscriptionGroupHandler":@GroupHandler
			"logger-sharelatex": log:->
			"./SubscriptionLocator": @SubscriptionLocator
		@adminUserId = "123jlkj"
		@req =
			session:
				user: _id: @adminUserId


	describe "addUserToGroup", ->

		it "should use the admin id for the logged in user and take the email address from the body", (done)->
			newEmail = "31231"
			@req.body = email: newEmail
			res =
				json : (data)=>
					@GroupHandler.addUserToGroup.calledWith(@adminUserId, newEmail).should.equal true
					data.user.should.deep.equal @user
					done()
			@Controller.addUserToGroup @req, res


	describe "removeUserFromGroup", ->
		it "should use the admin id for the logged in user and take the email address from the body", (done)->
			userIdToRemove = "31231"
			@req.params = user_id: userIdToRemove

			res =
				send : =>
					@GroupHandler.removeUserFromGroup.calledWith(@adminUserId, userIdToRemove).should.equal true
					done()
			@Controller.removeUserFromGroup @req, res


	describe "renderSubscriptionGroupAdminPage", ->	
		it "should redirect you if you don't have a group account", (done)->
			@subscription.groupPlan = false

			res =
				redirect : (path)=>
					path.should.equal("/")
					done()
			@Controller.renderSubscriptionGroupAdminPage @req, res

	describe "exportGroupCsv", ->	

		beforeEach ->
			@subscription.groupPlan = true
			@res = new MockResponse()
			@res.contentType = sinon.stub()
			@res.header = sinon.stub()
			@res.send = sinon.stub()
			@Controller.exportGroupCsv @req, @res

		it "should set the correct content type on the request", ->
			@res.contentType
				.calledWith("text/csv")
				.should.equal true

		it "should name the exported csv file", ->
			@res.header
				.calledWith(
					"Content-Disposition",
					"attachment; filename=Group.csv")
				.should.equal true

		it "should export the correct csv", ->
			@res.send
				.calledWith("user@email.com\n")
				.should.equal true
