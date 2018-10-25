SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
assert = require("chai").assert
modulePath = "../../../../app/js/Features/Subscription/SubscriptionGroupController"
MockResponse = require "../helpers/MockResponse"

describe "SubscriptionGroupController", ->

	beforeEach ->
		@user = {_id:"!@312431",email:"user@email.com"}
		@adminUserId = "123jlkj"
		@subscriptionId = "123434325412"
		@user_email = "bob@gmail.com"
		@req =
			session:
				user:
					_id: @adminUserId
					email:@user_email
			params:
				subscriptionId:@subscriptionId
			query:{}

		@subscription = {
			_id: @subscriptionId
		}

		@GroupHandler =
			removeUserFromGroup: sinon.stub().callsArgWith(2)

		@SubscriptionLocator =
			findManagedSubscription: sinon.stub().callsArgWith(1, null, @subscription)

		@AuthenticationController =
			getLoggedInUserId: (req) -> req.session.user._id
			getSessionUser: (req) -> req.session.user

		@Controller = SandboxedModule.require modulePath, requires:
			"./SubscriptionGroupHandler":@GroupHandler
			"logger-sharelatex": log:->
			"./SubscriptionLocator": @SubscriptionLocator
			'../Authentication/AuthenticationController': @AuthenticationController


	describe "removeUserFromGroup", ->
		it "should use the subscription id for the logged in user and take the user id from the params", (done)->
			userIdToRemove = "31231"
			@req.params = user_id: userIdToRemove
			@req.entity = @subscription

			res =
				send : =>
					@GroupHandler.removeUserFromGroup.calledWith(@subscriptionId, userIdToRemove).should.equal true
					done()
			@Controller.removeUserFromGroup @req, res
