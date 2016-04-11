SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
modulePath = "../../../../app/js/Features/Subscription/SubscriptionUpdater"
assert = require("chai").assert
ObjectId = require('mongoose').Types.ObjectId	

describe "SubscriptionUpdater", ->

	beforeEach ->
		@recurlySubscription = 
			uuid: "1238uoijdasjhd"
			plan:
				plan_code: "kjhsakjds"
		@adminUser = 
			_id: @adminuser_id = "5208dd34438843e2db000007"
		@otherUserId = "5208dd34438842e2db000005"
		@allUserIds = ["13213", "dsadas", "djsaiud89"]
		@subscription = subscription =
			admin_id: @adminUser._id
			member_ids: @allUserIds
			save: sinon.stub().callsArgWith(0)
			freeTrial:{}
			planCode:"student_or_something"

		@groupSubscription =
			admin_id: @adminUser._id
			member_ids: @allUserIds
			save: sinon.stub().callsArgWith(0)
			freeTrial:{}
			planCode:"group_subscription"


		@updateStub = sinon.stub().callsArgWith(2, null)
		@findAndModifyStub = sinon.stub().callsArgWith(2, null, @subscription)
		@SubscriptionModel = class
			constructor: (opts)-> 
				subscription.admin_id = opts.admin_id
				return subscription
		@SubscriptionModel.update = @updateStub
		@SubscriptionModel.findAndModify = @findAndModifyStub

		@SubscriptionLocator = 
			getUsersSubscription: sinon.stub()
			getGroupSubscriptionMemberOf:sinon.stub()
			
		@Settings = 
			freeTrialPlanCode: "collaborator"
			defaultPlanCode: "personal"

		@UserFeaturesUpdater =
			updateFeatures : sinon.stub().callsArgWith(2)

		@PlansLocator =
			findLocalPlanInSettings: sinon.stub().returns({})

		@ReferalAllocator = assignBonus:sinon.stub().callsArgWith(1)
		@ReferalAllocator.cock = true
		@SubscriptionUpdater = SandboxedModule.require modulePath, requires:
			'../../models/Subscription': Subscription:@SubscriptionModel
			'./UserFeaturesUpdater': @UserFeaturesUpdater
			'./SubscriptionLocator': @SubscriptionLocator
			'./PlansLocator': @PlansLocator
			"logger-sharelatex": log:->
			'settings-sharelatex': @Settings
			"../Referal/ReferalAllocator" : @ReferalAllocator


	describe "syncSubscription", ->

		beforeEach ->

			@SubscriptionLocator.getUsersSubscription.callsArgWith(1, null, @subscription)
			@SubscriptionUpdater._updateSubscriptionFromRecurly = sinon.stub().callsArgWith(2)

		it "should update the subscription if the user already is admin of one", (done)->
			@SubscriptionUpdater._createNewSubscription = sinon.stub()

			@SubscriptionUpdater.syncSubscription @recurlySubscription, @adminUser._id, (err)=>
				@SubscriptionLocator.getUsersSubscription.calledWith(@adminUser._id).should.equal true
				@SubscriptionUpdater._updateSubscriptionFromRecurly.called.should.equal true
				@SubscriptionUpdater._updateSubscriptionFromRecurly.calledWith(@recurlySubscription, @subscription).should.equal true
				done()

		it "should not call updateFeatures with group subscription if recurly subscription is not expired", (done)->

			@SubscriptionUpdater.syncSubscription @recurlySubscription, @adminUser._id, (err)=>
				@SubscriptionLocator.getUsersSubscription.calledWith(@adminUser._id).should.equal true
				@SubscriptionUpdater._updateSubscriptionFromRecurly.called.should.equal true
				@SubscriptionUpdater._updateSubscriptionFromRecurly.calledWith(@recurlySubscription, @subscription).should.equal true
				@UserFeaturesUpdater.updateFeatures.called.should.equal false
				done()


	describe "_updateSubscriptionFromRecurly", ->
		beforeEach ->
			@SubscriptionUpdater._setUsersMinimumFeatures = sinon.stub().callsArgWith(1)
			
		it "should update the subscription with token etc when not expired", (done)->
			@SubscriptionUpdater._updateSubscriptionFromRecurly @recurlySubscription, @subscription, (err)=>
				@subscription.recurlySubscription_id.should.equal @recurlySubscription.uuid
				@subscription.planCode.should.equal @recurlySubscription.plan.plan_code

				@subscription.freeTrial.allowed.should.equal true
				assert.equal(@subscription.freeTrial.expiresAt, undefined)
				assert.equal(@subscription.freeTrial.planCode, undefined)
				@subscription.save.called.should.equal true
				@SubscriptionUpdater._setUsersMinimumFeatures.calledWith(@adminUser._id).should.equal true
				done()

		it "should remove the recurlySubscription_id when expired", (done)->
			@recurlySubscription.state = "expired"

			@SubscriptionUpdater._updateSubscriptionFromRecurly @recurlySubscription, @subscription, (err)=>
				assert.equal(@subscription.recurlySubscription_id, undefined)
				@subscription.save.called.should.equal true
				@SubscriptionUpdater._setUsersMinimumFeatures.calledWith(@adminUser._id).should.equal true
				done()

		it "should update all the users features", (done)->
			@SubscriptionUpdater._updateSubscriptionFromRecurly @recurlySubscription, @subscription, (err)=>
				@SubscriptionUpdater._setUsersMinimumFeatures.calledWith(@adminUser._id).should.equal true
				@SubscriptionUpdater._setUsersMinimumFeatures.calledWith(@allUserIds[0]).should.equal true
				@SubscriptionUpdater._setUsersMinimumFeatures.calledWith(@allUserIds[1]).should.equal true
				@SubscriptionUpdater._setUsersMinimumFeatures.calledWith(@allUserIds[2]).should.equal true
				done()

		it "should set group to true and save how many members can be added to group", (done)->
			@PlansLocator.findLocalPlanInSettings.withArgs(@recurlySubscription.plan.plan_code).returns({groupPlan:true, membersLimit:5})
			@SubscriptionUpdater._updateSubscriptionFromRecurly @recurlySubscription, @subscription, (err)=>
				@subscription.membersLimit.should.equal 5
				@subscription.groupPlan.should.equal true
				done()

		it "should not set group to true or set groupPlan", (done)->
			@SubscriptionUpdater._updateSubscriptionFromRecurly @recurlySubscription, @subscription, (err)=>
				assert.notEqual @subscription.membersLimit, 5
				assert.notEqual @subscription.groupPlan, true
				done()



	describe "_createNewSubscription", ->
		it "should create a new subscription then update the subscription", (done)->
			@SubscriptionUpdater._createNewSubscription @adminUser._id, =>
				@subscription.admin_id.should.equal @adminUser._id
				@subscription.freeTrial.allowed.should.equal false
				@subscription.save.called.should.equal true
				done()

	describe "addUserToGroup", ->
		it "should add the users id to the group as a set", (done)->
			@SubscriptionUpdater.addUserToGroup @adminUser._id, @otherUserId, =>
				searchOps = 
					admin_id: @adminUser._id
				insertOperation = 
					"$addToSet": {member_ids:@otherUserId}
				@findAndModifyStub.calledWith(searchOps, insertOperation).should.equal true
				done()

		it "should update the users features", (done)->
			@SubscriptionUpdater.addUserToGroup @adminUser._id, @otherUserId, =>
				@UserFeaturesUpdater.updateFeatures.calledWith(@otherUserId, @subscription.planCode).should.equal true
				done()

	describe "removeUserFromGroup", ->
		beforeEach ->
			@SubscriptionUpdater._setUsersMinimumFeatures = sinon.stub().callsArgWith(1)

		it "should pull the users id from the group", (done)->
			@SubscriptionUpdater.removeUserFromGroup @adminUser._id, @otherUserId, =>
				searchOps = 
					admin_id:@adminUser._id
				removeOperation = 
					"$pull": {member_ids:@otherUserId}
				@updateStub.calledWith(searchOps, removeOperation).should.equal true
				done()

		it "should update the users features", (done)->
			@SubscriptionUpdater.removeUserFromGroup @adminUser._id, @otherUserId, =>
				@SubscriptionUpdater._setUsersMinimumFeatures.calledWith(@otherUserId).should.equal true
				done()

	describe "_setUsersMinimumFeatures", ->

		it "should call updateFeatures with the subscription if set", (done)->
			@SubscriptionLocator.getUsersSubscription.callsArgWith(1, null, @subscription)
			@SubscriptionLocator.getGroupSubscriptionMemberOf.callsArgWith(1, null)

			@SubscriptionUpdater._setUsersMinimumFeatures @adminUser._id, (err)=>
				args = @UserFeaturesUpdater.updateFeatures.args[0]
				assert.equal args[0], @adminUser._id
				assert.equal args[1], @subscription.planCode
				done()

		it "should call updateFeatures with the  group subscription if set", (done)->
			@SubscriptionLocator.getUsersSubscription.callsArgWith(1, null)
			@SubscriptionLocator.getGroupSubscriptionMemberOf.callsArgWith(1, null, @groupSubscription)

			@SubscriptionUpdater._setUsersMinimumFeatures @adminUser._id, (err)=>
				args = @UserFeaturesUpdater.updateFeatures.args[0]
				assert.equal args[0], @adminUser._id
				assert.equal args[1], @groupSubscription.planCode
				done()

		it "should call not call updateFeatures  with users subscription if the subscription plan code is the default one (downgraded)", (done)->
			@subscription.planCode = @Settings.defaultPlanCode
			@SubscriptionLocator.getUsersSubscription.callsArgWith(1, null, @subscription)
			@SubscriptionLocator.getGroupSubscriptionMemberOf.callsArgWith(1, null, @groupSubscription)
			@SubscriptionUpdater._setUsersMinimumFeatures @adminuser_id, (err)=>
				args = @UserFeaturesUpdater.updateFeatures.args[0]
				assert.equal args[0], @adminUser._id
				assert.equal args[1], @groupSubscription.planCode
				done()


		it "should call updateFeatures with default if there are no subscriptions for user", (done)->
			@SubscriptionLocator.getUsersSubscription.callsArgWith(1, null)
			@SubscriptionLocator.getGroupSubscriptionMemberOf.callsArgWith(1, null)
			@SubscriptionUpdater._setUsersMinimumFeatures @adminuser_id, (err)=>
				args = @UserFeaturesUpdater.updateFeatures.args[0]
				assert.equal args[0], @adminUser._id
				assert.equal args[1], @Settings.defaultPlanCode
				done()

		it "should call assignBonus", (done)->
			@SubscriptionLocator.getUsersSubscription.callsArgWith(1, null)
			@SubscriptionLocator.getGroupSubscriptionMemberOf.callsArgWith(1, null)
			@SubscriptionUpdater._setUsersMinimumFeatures @adminuser_id, (err)=>
				@ReferalAllocator.assignBonus.calledWith(@adminuser_id).should.equal true
				done()

