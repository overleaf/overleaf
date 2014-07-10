SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
modulePath = "../../../../app/js/Features/Subscription/SubscriptionLocator"
assert = require("chai").assert
ObjectId = require('mongoose').Types.ObjectId	


describe "Subscription Locator Tests", ->

	beforeEach ->
		@user =
			_id: "5208dd34438842e2db333333"
		@subscription = {hello:"world"}
		@Subscription =
			findOne: sinon.stub()
		@SubscriptionLocator = SandboxedModule.require modulePath, requires:
			'../../models/Subscription': Subscription:@Subscription
			"logger-sharelatex": log:->

	describe "finding users subscription", ->

		it "should send the users features", (done)->
			@Subscription.findOne.callsArgWith(1, null, @subscription)
			@SubscriptionLocator.getUsersSubscription @user, (err, subscription)=>
				@Subscription.findOne.calledWith({"admin_id":@user._id}).should.equal true
				subscription.should.equal @subscription
				done()

		it "should error if not found", (done)->
			@Subscription.findOne.callsArgWith(1, "not found")
			@SubscriptionLocator.getUsersSubscription @user, (err, subscription)=>
				err.should.exist
				done()

		it "should take a user id rather than the user object", (done)->
			@Subscription.findOne.callsArgWith(1, null, @subscription)
			@SubscriptionLocator.getUsersSubscription @user._id, (err, subscription)=>
				@Subscription.findOne.calledWith({"admin_id":@user._id}).should.equal true
				subscription.should.equal @subscription
				done()

