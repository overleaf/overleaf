SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
assert = require("chai").assert
modulePath = "../../../../app/js/Features/Subscription/SubscriptionGroupHandler"


describe "SubscriptionGroupHandler", ->

	beforeEach ->
		@adminUser_id = "12321"
		@newEmail = "bob@smith.com"
		@user_id = "3121321"
		@email = "jim@example.com"
		@user = {_id:@user_id, email:@newEmail}
		@subscription_id = "31DSd1123D"

		@subscription =
			admin_id: @adminUser_id
			manager_ids: [@adminUser_id]
			_id:@subscription_id

		@SubscriptionLocator =
			getUsersSubscription: sinon.stub()
			getSubscriptionByMemberIdAndId: sinon.stub()
			getSubscription: sinon.stub()

		@UserCreator =
			getUserOrCreateHoldingAccount: sinon.stub().callsArgWith(1, null, @user)

		@SubscriptionUpdater =
			addUserToGroup: sinon.stub().callsArgWith(2)
			removeUserFromGroup: sinon.stub().callsArgWith(2)

		@TeamInvitesHandler =
			createInvite: sinon.stub().callsArgWith(2)

		@UserGetter =
			getUser: sinon.stub()
			getUserByAnyEmail: sinon.stub()

		@LimitationsManager =
			hasGroupMembersLimitReached: sinon.stub()

		@OneTimeTokenHandler =
			getValueFromTokenAndExpire:sinon.stub()
			getNewToken:sinon.stub()

		@EmailHandler =
			sendEmail:sinon.stub()

		@Subscription =
			update: sinon.stub().yields()

		@settings =
			siteUrl:"http://www.sharelatex.com"

		@readStub = sinon.stub()
		@NotificationsBuilder =
			groupPlan: sinon.stub().returns({read:@readStub})

		@Handler = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": log:->
			"../User/UserCreator": @UserCreator
			"./SubscriptionUpdater": @SubscriptionUpdater
			"./TeamInvitesHandler": @TeamInvitesHandler
			"./SubscriptionLocator": @SubscriptionLocator
			"../../models/Subscription": Subscription: @Subscription
			"../User/UserGetter": @UserGetter
			"./LimitationsManager": @LimitationsManager
			"../Security/OneTimeTokenHandler":@OneTimeTokenHandler
			"../Email/EmailHandler":@EmailHandler
			"settings-sharelatex":@settings
			"../Notifications/NotificationsBuilder": @NotificationsBuilder
			"logger-sharelatex":
				err:->
				log:->
				warn:->


	describe "addUserToGroup", ->
		beforeEach ->
			@LimitationsManager.hasGroupMembersLimitReached.callsArgWith(1, null, false, @subscription)
			@UserGetter.getUserByAnyEmail.callsArgWith(1, null, @user)

		it "should find the user", (done)->
			@Handler.addUserToGroup @adminUser_id, @newEmail, (err)=>
				@UserGetter.getUserByAnyEmail.calledWith(@newEmail).should.equal true
				done()

		it "should add the user to the group", (done)->
			@Handler.addUserToGroup @subscription_id, @newEmail, (err)=>
				@SubscriptionUpdater.addUserToGroup.calledWith(@subscription_id, @user._id).should.equal true
				done()

		it "should not add the user to the group if the limit has been reached", (done)->
			@LimitationsManager.hasGroupMembersLimitReached.callsArgWith(1, null, true, @subscription)
			@Handler.addUserToGroup @adminUser_id, @newEmail, (err)=>
				@SubscriptionUpdater.addUserToGroup.called.should.equal false
				done()

		it "should return error that limit has been reached", (done)->
			@LimitationsManager.hasGroupMembersLimitReached.callsArgWith(1, null, true, @subscription)
			@Handler.addUserToGroup @adminUser_id, @newEmail, (err)=>
				err.limitReached.should.equal true
				done()

		it "should mark any notification as read if it is part of a licence", (done)->
			@Handler.addUserToGroup @adminUser_id, @newEmail, (err)=>
				@NotificationsBuilder.groupPlan.calledWith(@user, {subscription_id:@subscription._id}).should.equal true
				@readStub.called.should.equal true
				done()

		it "should add an email invite if no user is found", (done) ->
			@UserGetter.getUserByAnyEmail.callsArgWith(1, null, null)
			@Handler.addUserToGroup @adminUser_id, @newEmail, (err)=>
				@TeamInvitesHandler.createInvite.calledWith(@adminUser_id, @newEmail).should.equal true
				done()

	describe "removeUserFromGroup", ->

		it "should call the subscription updater to remove the user", (done)->
			@Handler.removeUserFromGroup @adminUser_id, @user._id, (err)=>
				@SubscriptionUpdater.removeUserFromGroup.calledWith(@adminUser_id, @user._id).should.equal true
				done()

	describe "replaceUserReferencesInGroups", ->
		beforeEach (done)->
			@oldId = "ba5eba11"
			@newId = "5ca1ab1e"
			@Handler.replaceUserReferencesInGroups @oldId, @newId, ->
				done()

		it "replaces the admin_id", ->
				@Subscription.update.calledWith(
					{ admin_id: @oldId },
					{ admin_id: @newId }
				).should.equal true

		it "replaces the manager_ids", ->
				@Subscription.update.calledWith(
					{manager_ids:"ba5eba11"},{$addToSet:{manager_ids:"5ca1ab1e"}},{multi:true}
				).should.equal true

				@Subscription.update.calledWith(
					{manager_ids:"ba5eba11"},{$pull:{manager_ids:"ba5eba11"}},{multi:true}
				).should.equal true

		it "replaces the member ids", ->
			@Subscription.update.calledWith(
				{ member_ids: @oldId },
				{ $addToSet: { member_ids: @newId } }
			).should.equal true

			@Subscription.update.calledWith(
				{ member_ids: @oldId },
				{ $pull: { member_ids: @oldId } }
			).should.equal true

	describe "isUserPartOfGroup", ->
		beforeEach ->
			@subscription_id = "123ed13123"

		it "should return true when user is part of subscription", (done)->
			@SubscriptionLocator.getSubscriptionByMemberIdAndId.callsArgWith(2, null, {_id:@subscription_id})
			@Handler.isUserPartOfGroup @user_id, @subscription_id, (err, partOfGroup)->
				partOfGroup.should.equal true
				done()

		it "should return false when no subscription is found", (done)->
			@SubscriptionLocator.getSubscriptionByMemberIdAndId.callsArgWith(2, null)
			@Handler.isUserPartOfGroup @user_id, @subscription_id, (err, partOfGroup)->
				partOfGroup.should.equal false
				done()
