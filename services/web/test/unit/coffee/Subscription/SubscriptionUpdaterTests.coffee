SandboxedModule = require('sandboxed-module')
should = require('chai').should()
expect = require('chai').expect
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
		@user_id = @adminuser_id

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
			@remove: sinon.stub().yields()
		@SubscriptionModel.update = @updateStub
		@SubscriptionModel.findAndModify = @findAndModifyStub

		@SubscriptionLocator = 
			getUsersSubscription: sinon.stub()
			getGroupSubscriptionMemberOf:sinon.stub()
			
		@Settings = 
			freeTrialPlanCode: "collaborator"
			defaultPlanCode: "personal"
			defaultFeatures: { "default": "features" }

		@UserFeaturesUpdater =
			updateFeatures : sinon.stub().yields()

		@PlansLocator =
			findLocalPlanInSettings: sinon.stub().returns({})

		@ReferalFeatures = getBonusFeatures: sinon.stub().callsArgWith(1)
		@Modules = {hooks: {fire: sinon.stub().callsArgWith(2, null, null)}}
		@SubscriptionUpdater = SandboxedModule.require modulePath, requires:
			'../../models/Subscription': Subscription:@SubscriptionModel
			'./UserFeaturesUpdater': @UserFeaturesUpdater
			'./SubscriptionLocator': @SubscriptionLocator
			'./PlansLocator': @PlansLocator
			"logger-sharelatex": log:->
			'settings-sharelatex': @Settings
			"../Referal/ReferalFeatures" : @ReferalFeatures
			'../../infrastructure/Modules': @Modules
			"./V1SubscriptionManager": @V1SubscriptionManager = {}


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
			@SubscriptionUpdater.refreshFeatures = sinon.stub().callsArgWith(1)
			
		it "should update the subscription with token etc when not expired", (done)->
			@SubscriptionUpdater._updateSubscriptionFromRecurly @recurlySubscription, @subscription, (err)=>
				@subscription.recurlySubscription_id.should.equal @recurlySubscription.uuid
				@subscription.planCode.should.equal @recurlySubscription.plan.plan_code

				@subscription.freeTrial.allowed.should.equal true
				assert.equal(@subscription.freeTrial.expiresAt, undefined)
				assert.equal(@subscription.freeTrial.planCode, undefined)
				@subscription.save.called.should.equal true
				@SubscriptionUpdater.refreshFeatures.calledWith(@adminUser._id).should.equal true
				done()

		it "should remove the recurlySubscription_id when expired", (done)->
			@recurlySubscription.state = "expired"

			@SubscriptionUpdater._updateSubscriptionFromRecurly @recurlySubscription, @subscription, (err)=>
				assert.equal(@subscription.recurlySubscription_id, undefined)
				@subscription.save.called.should.equal true
				@SubscriptionUpdater.refreshFeatures.calledWith(@adminUser._id).should.equal true
				done()

		it "should update all the users features", (done)->
			@SubscriptionUpdater._updateSubscriptionFromRecurly @recurlySubscription, @subscription, (err)=>
				@SubscriptionUpdater.refreshFeatures.calledWith(@adminUser._id).should.equal true
				@SubscriptionUpdater.refreshFeatures.calledWith(@allUserIds[0]).should.equal true
				@SubscriptionUpdater.refreshFeatures.calledWith(@allUserIds[1]).should.equal true
				@SubscriptionUpdater.refreshFeatures.calledWith(@allUserIds[2]).should.equal true
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
			@SubscriptionUpdater.refreshFeatures = sinon.stub().callsArgWith(1)

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
				@SubscriptionUpdater.refreshFeatures.calledWith(@otherUserId).should.equal true
				done()

	describe "refreshFeatures", ->
		beforeEach ->
			@SubscriptionUpdater._getIndividualFeatures = sinon.stub().yields(null, { 'individual': 'features' })
			@SubscriptionUpdater._getGroupFeatureSets = sinon.stub().yields(null, [{ 'group': 'features' }, { 'group': 'features2' }])
			@SubscriptionUpdater._getV1Features = sinon.stub().yields(null, { 'v1': 'features' })
			@ReferalFeatures.getBonusFeatures = sinon.stub().yields(null, { 'bonus': 'features' })
			@SubscriptionUpdater._mergeFeatures = sinon.stub().returns({'merged': 'features'})
			@callback = sinon.stub()
			@SubscriptionUpdater.refreshFeatures @user_id, @callback

		it "should get the individual features", ->
			@SubscriptionUpdater._getIndividualFeatures
				.calledWith(@user_id)
				.should.equal true

		it "should get the group features", ->
			@SubscriptionUpdater._getGroupFeatureSets
				.calledWith(@user_id)
				.should.equal true

		it "should get the v1 features", ->
			@SubscriptionUpdater._getV1Features
				.calledWith(@user_id)
				.should.equal true

		it "should get the bonus features", ->
			@ReferalFeatures.getBonusFeatures
				.calledWith(@user_id)
				.should.equal true

		it "should merge from the default features", ->
			@SubscriptionUpdater._mergeFeatures.calledWith(@Settings.defaultFeatures).should.equal true

		it "should merge the individual features", ->
			@SubscriptionUpdater._mergeFeatures.calledWith(sinon.match.any, { 'individual': 'features' }).should.equal true

		it "should merge the group features", ->
			@SubscriptionUpdater._mergeFeatures.calledWith(sinon.match.any, { 'group': 'features' }).should.equal true
			@SubscriptionUpdater._mergeFeatures.calledWith(sinon.match.any, { 'group': 'features2' }).should.equal true

		it "should merge the v1 features", ->
			@SubscriptionUpdater._mergeFeatures.calledWith(sinon.match.any, { 'v1': 'features' }).should.equal true

		it "should merge the bonus features", ->
			@SubscriptionUpdater._mergeFeatures.calledWith(sinon.match.any, { 'bonus': 'features' }).should.equal true

		it "should update the user with the merged features", ->
			@UserFeaturesUpdater.updateFeatures
				.calledWith(@user_id, {'merged': 'features'})
				.should.equal true

	describe "_mergeFeatures", ->
		it "should prefer priority over standard for compileGroup", ->
			expect(@SubscriptionUpdater._mergeFeatures({
				compileGroup: 'priority'
			}, {
				compileGroup: 'standard'
			})).to.deep.equal({
				compileGroup: 'priority'
			})
			expect(@SubscriptionUpdater._mergeFeatures({
				compileGroup: 'standard'
			}, {
				compileGroup: 'priority'
			})).to.deep.equal({
				compileGroup: 'priority'
			})
			expect(@SubscriptionUpdater._mergeFeatures({
				compileGroup: 'priority'
			}, {
				compileGroup: 'priority'
			})).to.deep.equal({
				compileGroup: 'priority'
			})
			expect(@SubscriptionUpdater._mergeFeatures({
				compileGroup: 'standard'
			}, {
				compileGroup: 'standard'
			})).to.deep.equal({
				compileGroup: 'standard'
			})

		it "should prefer -1 over any other for collaborators", ->
			expect(@SubscriptionUpdater._mergeFeatures({
				collaborators: -1
			}, {
				collaborators: 10
			})).to.deep.equal({
				collaborators: -1
			})
			expect(@SubscriptionUpdater._mergeFeatures({
				collaborators: 10
			}, {
				collaborators: -1
			})).to.deep.equal({
				collaborators: -1
			})
			expect(@SubscriptionUpdater._mergeFeatures({
				collaborators: 4
			}, {
				collaborators: 10
			})).to.deep.equal({
				collaborators: 10
			})

		it "should prefer the higher of compileTimeout", ->
			expect(@SubscriptionUpdater._mergeFeatures({
				compileTimeout: 20
			}, {
				compileTimeout: 10
			})).to.deep.equal({
				compileTimeout: 20
			})
			expect(@SubscriptionUpdater._mergeFeatures({
				compileTimeout: 10
			}, {
				compileTimeout: 20
			})).to.deep.equal({
				compileTimeout: 20
			})

		it "should prefer the true over false for other keys", ->
			expect(@SubscriptionUpdater._mergeFeatures({
				github: true
			}, {
				github: false
			})).to.deep.equal({
				github: true
			})
			expect(@SubscriptionUpdater._mergeFeatures({
				github: false
			}, {
				github: true
			})).to.deep.equal({
				github: true
			})
			expect(@SubscriptionUpdater._mergeFeatures({
				github: true
			}, {
				github: true
			})).to.deep.equal({
				github: true
			})
			expect(@SubscriptionUpdater._mergeFeatures({
				github: false
			}, {
				github: false
			})).to.deep.equal({
				github: false
			})

	describe "deleteSubscription", ->
		beforeEach (done) ->
			@subscription_id = ObjectId().toString()
			@subscription = {
				"mock": "subscription",
				admin_id: ObjectId(),
				member_ids: [ ObjectId(), ObjectId(), ObjectId() ]
			}
			@SubscriptionLocator.getSubscription = sinon.stub().yields(null, @subscription)
			@SubscriptionUpdater.refreshFeatures = sinon.stub().yields()
			@SubscriptionUpdater.deleteSubscription @subscription_id, done
			
		it "should look up the subscription", ->
			@SubscriptionLocator.getSubscription
				.calledWith(@subscription_id)
				.should.equal true
		
		it "should remove the subscription", ->
			@SubscriptionModel.remove
				.calledWith({_id: ObjectId(@subscription_id)})
				.should.equal true
		
		it "should downgrade the admin_id", ->
			@SubscriptionUpdater.refreshFeatures
				.calledWith(@subscription.admin_id)
				.should.equal true
		
		it "should downgrade all of the members", ->
			for user_id in @subscription.member_ids
				@SubscriptionUpdater.refreshFeatures
					.calledWith(user_id)
					.should.equal true
