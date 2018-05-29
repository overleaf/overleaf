SandboxedModule = require('sandboxed-module')
should = require('chai').should()
expect = require('chai').expect
sinon = require 'sinon'
modulePath = "../../../../app/js/Features/Subscription/FeaturesUpdater"
assert = require("chai").assert
ObjectId = require('mongoose').Types.ObjectId	

describe "FeaturesUpdater", ->

	beforeEach ->
		@user_id = ObjectId().toString()

		@FeaturesUpdater = SandboxedModule.require modulePath, requires:
			'./UserFeaturesUpdater': @UserFeaturesUpdater = {}
			'./SubscriptionLocator': @SubscriptionLocator = {} 
			'./PlansLocator': @PlansLocator = {}
			"logger-sharelatex": log:->
			'settings-sharelatex': @Settings = {}
			"../Referal/ReferalFeatures" : @ReferalFeatures = {}
			"./V1SubscriptionManager": @V1SubscriptionManager = {}

	describe "refreshFeatures", ->
		beforeEach ->
			@V1SubscriptionManager.notifyV1OfFeaturesChange = sinon.stub().yields()
			@UserFeaturesUpdater.updateFeatures = sinon.stub().yields()
			@FeaturesUpdater._getIndividualFeatures = sinon.stub().yields(null, { 'individual': 'features' })
			@FeaturesUpdater._getGroupFeatureSets = sinon.stub().yields(null, [{ 'group': 'features' }, { 'group': 'features2' }])
			@FeaturesUpdater._getV1Features = sinon.stub().yields(null, { 'v1': 'features' })
			@ReferalFeatures.getBonusFeatures = sinon.stub().yields(null, { 'bonus': 'features' })
			@FeaturesUpdater._mergeFeatures = sinon.stub().returns({'merged': 'features'})
			@callback = sinon.stub()

		describe "normally", ->
			beforeEach ->
				@FeaturesUpdater.refreshFeatures @user_id, @callback

			it "should get the individual features", ->
				@FeaturesUpdater._getIndividualFeatures
					.calledWith(@user_id)
					.should.equal true

			it "should get the group features", ->
				@FeaturesUpdater._getGroupFeatureSets
					.calledWith(@user_id)
					.should.equal true

			it "should get the v1 features", ->
				@FeaturesUpdater._getV1Features
					.calledWith(@user_id)
					.should.equal true

			it "should get the bonus features", ->
				@ReferalFeatures.getBonusFeatures
					.calledWith(@user_id)
					.should.equal true

			it "should merge from the default features", ->
				@FeaturesUpdater._mergeFeatures.calledWith(@Settings.defaultFeatures).should.equal true

			it "should merge the individual features", ->
				@FeaturesUpdater._mergeFeatures.calledWith(sinon.match.any, { 'individual': 'features' }).should.equal true

			it "should merge the group features", ->
				@FeaturesUpdater._mergeFeatures.calledWith(sinon.match.any, { 'group': 'features' }).should.equal true
				@FeaturesUpdater._mergeFeatures.calledWith(sinon.match.any, { 'group': 'features2' }).should.equal true

			it "should merge the v1 features", ->
				@FeaturesUpdater._mergeFeatures.calledWith(sinon.match.any, { 'v1': 'features' }).should.equal true

			it "should merge the bonus features", ->
				@FeaturesUpdater._mergeFeatures.calledWith(sinon.match.any, { 'bonus': 'features' }).should.equal true

			it "should update the user with the merged features", ->
				@UserFeaturesUpdater.updateFeatures
					.calledWith(@user_id, {'merged': 'features'})
					.should.equal true

			it "should notify v1", ->
				@V1SubscriptionManager.notifyV1OfFeaturesChange
					.called.should.equal true

		describe "with notifyV1 == false", ->
			beforeEach ->
				@FeaturesUpdater.refreshFeatures @user_id, false, @callback

			it "should not notify v1", ->
				@V1SubscriptionManager.notifyV1OfFeaturesChange
					.called.should.equal false

	describe "_mergeFeatures", ->
		it "should prefer priority over standard for compileGroup", ->
			expect(@FeaturesUpdater._mergeFeatures({
				compileGroup: 'priority'
			}, {
				compileGroup: 'standard'
			})).to.deep.equal({
				compileGroup: 'priority'
			})
			expect(@FeaturesUpdater._mergeFeatures({
				compileGroup: 'standard'
			}, {
				compileGroup: 'priority'
			})).to.deep.equal({
				compileGroup: 'priority'
			})
			expect(@FeaturesUpdater._mergeFeatures({
				compileGroup: 'priority'
			}, {
				compileGroup: 'priority'
			})).to.deep.equal({
				compileGroup: 'priority'
			})
			expect(@FeaturesUpdater._mergeFeatures({
				compileGroup: 'standard'
			}, {
				compileGroup: 'standard'
			})).to.deep.equal({
				compileGroup: 'standard'
			})

		it "should prefer -1 over any other for collaborators", ->
			expect(@FeaturesUpdater._mergeFeatures({
				collaborators: -1
			}, {
				collaborators: 10
			})).to.deep.equal({
				collaborators: -1
			})
			expect(@FeaturesUpdater._mergeFeatures({
				collaborators: 10
			}, {
				collaborators: -1
			})).to.deep.equal({
				collaborators: -1
			})
			expect(@FeaturesUpdater._mergeFeatures({
				collaborators: 4
			}, {
				collaborators: 10
			})).to.deep.equal({
				collaborators: 10
			})

		it "should prefer the higher of compileTimeout", ->
			expect(@FeaturesUpdater._mergeFeatures({
				compileTimeout: 20
			}, {
				compileTimeout: 10
			})).to.deep.equal({
				compileTimeout: 20
			})
			expect(@FeaturesUpdater._mergeFeatures({
				compileTimeout: 10
			}, {
				compileTimeout: 20
			})).to.deep.equal({
				compileTimeout: 20
			})

		it "should prefer the true over false for other keys", ->
			expect(@FeaturesUpdater._mergeFeatures({
				github: true
			}, {
				github: false
			})).to.deep.equal({
				github: true
			})
			expect(@FeaturesUpdater._mergeFeatures({
				github: false
			}, {
				github: true
			})).to.deep.equal({
				github: true
			})
			expect(@FeaturesUpdater._mergeFeatures({
				github: true
			}, {
				github: true
			})).to.deep.equal({
				github: true
			})
			expect(@FeaturesUpdater._mergeFeatures({
				github: false
			}, {
				github: false
			})).to.deep.equal({
				github: false
			})
