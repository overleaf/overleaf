SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
modulePath = "../../../../app/js/Features/Subscription/SubscriptionUpdater"
assert = require("chai").assert
ObjectId = require('mongoose').Types.ObjectId	

describe "Subscription Updater", ->

	beforeEach ->
		@recurlySubscription = 
			uuid: "1238uoijdasjhd"
			plan:
				plan_code: "kjhsakjds"
		@adminUser = 
			_id:"5208dd34438843e2db000007"
		@otherUserId = "5208dd34438842e2db000005"
		@allUserIds = ["13213", "dsadas", "djsaiud89"]
		@subscription = subscription =
			admin_id: @adminUser._id
			members_id: @allUserIds
			save: sinon.stub().callsArgWith(0)
			freeTrial:{}
			plan_code:"student_or_something"

		@groupSubscription =
			admin_id: @adminUser._id
			members_id: @allUserIds
			save: sinon.stub().callsArgWith(0)
			freeTrial:{}
			plan_code:"group_subscription"


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
			@SubscriptionLocator.getGroupSubscriptionMemberOf.callsArgWith(1, null, @groupSubscription)
			@SubscriptionUpdater._updateSubscription = sinon.stub().callsArgWith(2)

		it "should update the subscription if the user already is admin of one", (done)->
			@SubscriptionUpdater._createNewSubscription = sinon.stub()

			@SubscriptionUpdater.syncSubscription @recurlySubscription, @adminUser._id, (err)=>
				@SubscriptionLocator.getUsersSubscription.calledWith(@adminUser._id).should.equal true
				@SubscriptionUpdater._updateSubscription.called.should.equal true
				@SubscriptionUpdater._updateSubscription.calledWith(@recurlySubscription, @subscription).should.equal true
				done()

		it "should sync with the group subscription if the recurly subscription is expired", (done)->
			@recurlySubscription.state = "expired"

			@SubscriptionUpdater.syncSubscription @recurlySubscription, @adminUser._id, (err)=>
				@SubscriptionLocator.getUsersSubscription.calledWith(@adminUser._id).should.equal true
				@SubscriptionUpdater._updateSubscription.called.should.equal true
				@SubscriptionUpdater._updateSubscription.calledWith(@recurlySubscription, @subscription).should.equal true
				@UserFeaturesUpdater.updateFeatures.calledWith(@adminUser._id, @groupSubscription.planCode).should.equal true
				done()

		it "should not call updateFeatures with group subscription if recurly subscription is not expired", (done)->

			@SubscriptionUpdater.syncSubscription @recurlySubscription, @adminUser._id, (err)=>
				@SubscriptionLocator.getUsersSubscription.calledWith(@adminUser._id).should.equal true
				@SubscriptionUpdater._updateSubscription.called.should.equal true
				@SubscriptionUpdater._updateSubscription.calledWith(@recurlySubscription, @subscription).should.equal true
				@UserFeaturesUpdater.updateFeatures.called.should.equal false
				done()


	describe "_updateSubscription", ->

		it "should update the subscription with token etc when not expired", (done)->
			@SubscriptionUpdater._updateSubscription @recurlySubscription, @subscription, (err)=>
				@subscription.recurlySubscription_id.should.equal @recurlySubscription.uuid
				@subscription.planCode.should.equal @recurlySubscription.plan.plan_code

				@subscription.freeTrial.allowed.should.equal true
				assert.equal(@subscription.freeTrial.expiresAt, undefined)
				assert.equal(@subscription.freeTrial.planCode, undefined)
				@subscription.save.called.should.equal true
				@UserFeaturesUpdater.updateFeatures.calledWith(@adminUser._id, @recurlySubscription.plan.plan_code).should.equal true
				done()

		it "should remove the recurlySubscription_id when expired", (done)->
			@recurlySubscription.state = "expired"

			@SubscriptionUpdater._updateSubscription @recurlySubscription, @subscription, (err)=>
				assert.equal(@subscription.recurlySubscription_id, undefined)
				@subscription.save.called.should.equal true
				@UserFeaturesUpdater.updateFeatures.calledWith(@adminUser._id, @Settings.defaultPlanCode).should.equal true
				done()

		it "should update all the users features", (done)->
			@SubscriptionUpdater._updateSubscription @recurlySubscription, @subscription, (err)=>
				@UserFeaturesUpdater.updateFeatures.calledWith(@adminUser._id, @recurlySubscription.plan.plan_code).should.equal true
				@UserFeaturesUpdater.updateFeatures.calledWith(@allUserIds[0], @recurlySubscription.plan.plan_code).should.equal true
				@UserFeaturesUpdater.updateFeatures.calledWith(@allUserIds[1], @recurlySubscription.plan.plan_code).should.equal true
				@UserFeaturesUpdater.updateFeatures.calledWith(@allUserIds[2], @recurlySubscription.plan.plan_code).should.equal true
				done()

		it "should set group to true and save how many members can be added to group", (done)->
			@PlansLocator.findLocalPlanInSettings.withArgs(@recurlySubscription.plan.plan_code).returns({groupPlan:true, membersLimit:5})
			@SubscriptionUpdater._updateSubscription @recurlySubscription, @subscription, (err)=>
				@subscription.membersLimit.should.equal 5
				@subscription.groupPlan.should.equal true
				done()

		it "should not set group to true or set groupPlan", (done)->
			@SubscriptionUpdater._updateSubscription @recurlySubscription, @subscription, (err)=>
				assert.notEqual @subscription.membersLimit, 5
				assert.notEqual @subscription.groupPlan, true
				done()

		it "should call assignBonus", (done)->
			@SubscriptionUpdater._updateSubscription @recurlySubscription, @subscription, (err)=>
				@ReferalAllocator.assignBonus.calledWith(@subscription.admin_id).should.equal true
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
				@UserFeaturesUpdater.updateFeatures.calledWith(@otherUserId, @Settings.defaultPlanCode).should.equal true
				done()
