SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
assert = require("chai").assert
modulePath = "../../../../app/js/Features/Subscription/SubscriptionGroupHandler"


describe "Subscription Group Handler", ->

	beforeEach ->
		@adminUser_id = "12321"
		@newEmail = "bob@smith.com"
		@user = {_id:"3121321", email:@newEmail}

		@SubscriptionLocator = 
			getUsersSubscription: sinon.stub()

		@UserCreator = 
			getUserOrCreateHoldingAccount: sinon.stub().callsArgWith(1, null, @user)

		@SubscriptionUpdater =
			addUserToGroup: sinon.stub().callsArgWith(2)
			removeUserFromGroup: sinon.stub().callsArgWith(2)

		@UserLocator =
			findById: sinon.stub()

		@LimitationsManager =
			hasGroupMembersLimitReached: sinon.stub()

		@Handler = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": log:->
			"../User/UserCreator": @UserCreator
			"./SubscriptionUpdater": @SubscriptionUpdater
			"./SubscriptionLocator": @SubscriptionLocator
			"../User/UserLocator": @UserLocator
			"./LimitationsManager": @LimitationsManager

	describe "addUserToGroup", ->
		it "should find or create the user", (done)->
			@LimitationsManager.hasGroupMembersLimitReached.callsArgWith(1, null, false)
			@Handler.addUserToGroup @adminUser_id, @newEmail, (err)=>
				@UserCreator.getUserOrCreateHoldingAccount.calledWith(@newEmail).should.equal true
				done()

		it "should add the user to the group", (done)->
			@LimitationsManager.hasGroupMembersLimitReached.callsArgWith(1, null, false)
			@Handler.addUserToGroup @adminUser_id, @newEmail, (err)=>
				@SubscriptionUpdater.addUserToGroup.calledWith(@adminUser_id, @user._id).should.equal true
				done()
				
		it "should not add the user to the group if the limit has been reached", (done)->
			@LimitationsManager.hasGroupMembersLimitReached.callsArgWith(1, null, true)
			@Handler.addUserToGroup @adminUser_id, @newEmail, (err)=>
				@SubscriptionUpdater.addUserToGroup.called.should.equal false
				done()

		it "should return error that limit has been reached", (done)->
			@LimitationsManager.hasGroupMembersLimitReached.callsArgWith(1, null, true)
			@Handler.addUserToGroup @adminUser_id, @newEmail, (err)=>
				err.limitReached.should.equal true
				done()

	describe "removeUserFromGroup", ->

		it "should call the subscription updater to remove the user", (done)->
			@Handler.removeUserFromGroup @adminUser_id, @user._id, (err)=>
				@SubscriptionUpdater.removeUserFromGroup.calledWith(@adminUser_id, @user._id).should.equal true
				done()


	describe "getPopulatedListOfMembers", ->
		beforeEach ->
			@subscription = {}
			@SubscriptionLocator.getUsersSubscription.callsArgWith(1, null, @subscription)
			@UserLocator.findById.callsArgWith(1, null, {_id:"31232"})

		it "should locate the subscription", (done)->
			@UserLocator.findById.callsArgWith(1, null, {_id:"31232"})
			@Handler.getPopulatedListOfMembers @adminUser_id, (err, users)=>
				@SubscriptionLocator.getUsersSubscription.calledWith(@adminUser_id).should.equal true
				done()

		it "should get the users by id", (done)->
			@UserLocator.findById.callsArgWith(1, null, {_id:"31232"})
			@subscription.member_ids = ["1234", "342432", "312312"]
			@Handler.getPopulatedListOfMembers @adminUser_id, (err, users)=>
				@UserLocator.findById.calledWith(@subscription.member_ids[0]).should.equal true
				@UserLocator.findById.calledWith(@subscription.member_ids[1]).should.equal true
				@UserLocator.findById.calledWith(@subscription.member_ids[2]).should.equal true
				users.length.should.equal @subscription.member_ids.length
				done()

		it "should just return the id if the user can not be found as they may have deleted their account", (done)->
			@UserLocator.findById.callsArgWith(1)
			@subscription.member_ids = ["1234", "342432", "312312"]
			@Handler.getPopulatedListOfMembers @adminUser_id, (err, users)=>
				assert.deepEqual users[0], {_id:@subscription.member_ids[0]}
				assert.deepEqual users[1], {_id:@subscription.member_ids[1]}
				assert.deepEqual users[2], {_id:@subscription.member_ids[2]}
				done()

