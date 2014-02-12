SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
assert = require("chai").assert
modulePath = "../../../../app/js/Features/Subscription/SubscriptionGroupController"


describe "Subscription Group Controller", ->

	beforeEach ->
		@user = {_id:"!@312431"}
		@subscription = {}
		@GroupHandler = 
			addUserToGroup: sinon.stub().callsArgWith(2, null, @user)
			removeUserFromGroup: sinon.stub().callsArgWith(2)
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
			@subscription.group = false

			res =
				redirect : (path)=>
					path.should.equal("/")
					done()
			@Controller.renderSubscriptionGroupAdminPage @req, res
