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
			isUserPartOfGroup: sinon.stub()
			getPopulatedListOfMembers: sinon.stub().callsArgWith(1, null, [@user])
		@SubscriptionLocator =
			findManagedSubscription: sinon.stub().callsArgWith(1, null, @subscription)

		@AuthenticationController =
			getLoggedInUserId: (req) -> req.session.user._id
			getSessionUser: (req) -> req.session.user

		@SubscriptionDomainHandler =
			findDomainLicenceBySubscriptionId:sinon.stub()

		@OneTimeTokenHandler =
			getValueFromTokenAndExpire:sinon.stub()


		@ErrorsController =
			notFound:sinon.stub()

		@Controller = SandboxedModule.require modulePath, requires:
			"./SubscriptionGroupHandler":@GroupHandler
			"logger-sharelatex": log:->
			"./SubscriptionLocator": @SubscriptionLocator
			"./SubscriptionDomainHandler":@SubscriptionDomainHandler
			"../Errors/ErrorController":@ErrorsController
			'../Authentication/AuthenticationController': @AuthenticationController


		@token = "super-secret-token"


	describe "removeUserFromGroup", ->
		it "should use the subscription id for the logged in user and take the user id from the params", (done)->
			userIdToRemove = "31231"
			@req.params = user_id: userIdToRemove

			res =
				send : =>
					@GroupHandler.removeUserFromGroup.calledWith(@subscriptionId, userIdToRemove).should.equal true
					done()
			@Controller.removeUserFromGroup @req, res

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
