expect = require("chai").expect
async = require("async")
UserClient = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
{ObjectId} = require("../../../app/js/infrastructure/mongojs")
Subscription = require("../../../app/js/models/Subscription").Subscription
User = require("../../../app/js/models/User").User
FeaturesUpdater = require("../../../app/js/Features/Subscription/FeaturesUpdater")

MockV1Api = require "./helpers/MockV1Api"
logger = require "logger-sharelatex"
logger.logger.level("error")

syncUserAndGetFeatures = (user, callback = (error, features) ->) ->
	FeaturesUpdater.refreshFeatures user._id, false, (error) ->
		return callback(error) if error?
		User.findById user._id, (error, user) ->
			return callback(error) if error?
			features = user.toObject().features
			delete features.$init # mongoose internals
			return callback null, features

describe "FeatureUpdater.refreshFeatures", ->
	beforeEach (done) ->
		@user = new UserClient()
		@user.ensureUserExists (error) ->
			throw error if error?
			done()

	describe "when user has no subscriptions", ->
		it "should set their features to the basic set", (done) ->
			syncUserAndGetFeatures @user, (error, features) =>
				throw error if error?
				expect(features).to.deep.equal(settings.defaultFeatures)
				done()

	describe "when the user has an individual subscription", ->
		beforeEach ->
			Subscription.create {
				admin_id: @user._id
				planCode: 'collaborator'
				customAccount: true
			} # returns a promise

		it "should set their features to the upgraded set", (done) ->
			syncUserAndGetFeatures @user, (error, features) =>
				throw error if error?
				plan = settings.plans.find (plan) -> plan.planCode == 'collaborator'
				expect(features).to.deep.equal(plan.features)
				done()

	describe "when the user is in a group subscription", ->
		beforeEach ->
			Subscription.create {
				admin_id: ObjectId()
				member_ids: [@user._id]
				groupAccount: true
				planCode: 'collaborator'
				customAccount: true
			} # returns a promise

		it "should set their features to the upgraded set", (done) ->
			syncUserAndGetFeatures @user, (error, features) =>
				throw error if error?
				plan = settings.plans.find (plan) -> plan.planCode == 'collaborator'
				expect(features).to.deep.equal(plan.features)
				done()

	describe "when the user has bonus features", ->
		beforeEach ->
			User.update {
				_id: @user._id
			}, {
				refered_user_count: 10
			} # returns a promise

		it "should set their features to the bonus set", (done) ->
			syncUserAndGetFeatures @user, (error, features) =>
				throw error if error?
				expect(features).to.deep.equal(Object.assign(
					{}, settings.defaultFeatures,	settings.bonus_features[9]
				))
				done()

	describe "when the user has affiliations", ->
		beforeEach ->
			@institutionPlan = settings.plans.find (plan) ->
				plan.planCode == settings.institutionPlanCode
			@email = @user.emails[0].email
			affiliationData =
				email: @email
				institution: { licence: 'pro_plus' }
			MockV1Api.setAffiliations [affiliationData]

		it "should not set their features if email is not confirmed", (done) ->
			syncUserAndGetFeatures @user, (error, features) =>
				expect(features).to.deep.equal(settings.defaultFeatures)
				done()

		it "should set their features if email is confirmed", (done) ->
			@user.confirmEmail @email, (error) =>
				syncUserAndGetFeatures @user, (error, features) =>
					expect(features).to.deep.equal(@institutionPlan.features)
					done()

	describe "when the user is due bonus features and has extra features that no longer apply", ->
		beforeEach ->
			User.update {
				_id: @user._id
			}, {
				refered_user_count: 10,
				'features.github': true
			} # returns a promise

		it "should set their features to the bonus set and downgrade the extras", (done) ->
			syncUserAndGetFeatures @user, (error, features) =>
				throw error if error?
				expect(features).to.deep.equal(Object.assign(
					{}, settings.defaultFeatures,	settings.bonus_features[9]
				))
				done()

	describe "when the user has a v1 plan", ->
		beforeEach ->
			MockV1Api.setUser 42, plan_name: 'free'
			User.update {
				_id: @user._id
			}, {
				overleaf:
					id: 42
			} # returns a promise

		it "should set their features to the v1 plan", (done) ->
			syncUserAndGetFeatures @user, (error, features) =>
				throw error if error?
				plan = settings.plans.find (plan) -> plan.planCode == 'v1_free'
				expect(features).to.deep.equal(plan.features)
				done()

	describe "when the user has a v1 plan and bonus features", ->
		beforeEach ->
			MockV1Api.setUser 42, plan_name: 'free'
			User.update {
				_id: @user._id
			}, {
				overleaf:
					id: 42
				refered_user_count: 10
			} # returns a promise

		it "should set their features to the best of the v1 plan and bonus features", (done) ->
			syncUserAndGetFeatures @user, (error, features) =>
				throw error if error?
				v1plan = settings.plans.find (plan) -> plan.planCode == 'v1_free'
				expectedFeatures = Object.assign(
					{}, v1plan.features, settings.bonus_features[9]
				)
				expect(features).to.deep.equal(expectedFeatures)
				done()

	describe "when the user has a group and personal subscription", ->
		beforeEach (done) ->
			Subscription.create {
				admin_id: @user._id
				planCode: 'professional'
				customAccount: true
			}, (error) =>
				throw error if error?
				Subscription.create {
					admin_id: ObjectId()
					member_ids: [@user._id]
					groupAccount: true
					planCode: 'collaborator'
					customAccount: true
				}, done
			return

		it "should set their features to the best set", (done) ->
			syncUserAndGetFeatures @user, (error, features) =>
				throw error if error?
				plan = settings.plans.find (plan) -> plan.planCode == 'professional'
				expect(features).to.deep.equal(plan.features)
				done()

	describe "when the notifyV1Flag is passed", ->
		beforeEach ->
			User.update {
				_id: @user._id
			}, {
				overleaf:
					id: 42
			} # returns a promise

		it "should ping the v1 API end point to sync", (done) ->
			FeaturesUpdater.refreshFeatures @user._id, true, (error) =>
				setTimeout () =>
					expect(
						MockV1Api.syncUserFeatures.calledWith('42')
					).to.equal true
					done()
				, 500
