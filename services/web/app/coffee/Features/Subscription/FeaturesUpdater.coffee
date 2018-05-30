async = require("async")
PlansLocator = require("./PlansLocator")
_ = require("underscore")
SubscriptionLocator = require("./SubscriptionLocator")
UserFeaturesUpdater = require("./UserFeaturesUpdater")
Settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
ReferalFeatures = require("../Referal/ReferalFeatures")
V1SubscriptionManager = require("./V1SubscriptionManager")

oneMonthInSeconds = 60 * 60 * 24 * 30

module.exports = FeaturesUpdater =
	refreshFeatures: (user_id, notifyV1 = true, callback = () ->)->
		if typeof notifyV1 == 'function'
			callback = notifyV1
			notifyV1 = true

		if notifyV1
			V1SubscriptionManager.notifyV1OfFeaturesChange user_id, (error) ->
				if error?
					logger.err {err: error, user_id}, "error notifying v1 about updated features"

		jobs =
			individualFeatures: (cb) -> FeaturesUpdater._getIndividualFeatures user_id, cb
			groupFeatureSets:   (cb) -> FeaturesUpdater._getGroupFeatureSets user_id, cb
			v1Features:         (cb) -> FeaturesUpdater._getV1Features user_id, cb
			bonusFeatures:      (cb) -> ReferalFeatures.getBonusFeatures user_id, cb
		async.series jobs, (err, results)->
			if err?
				logger.err err:err, user_id:user_id,
					"error getting subscription or group for refreshFeatures"
				return callback(err)

			{individualFeatures, groupFeatureSets, v1Features, bonusFeatures} = results
			logger.log {user_id, individualFeatures, groupFeatureSets, v1Features, bonusFeatures}, 'merging user features'
			featureSets = groupFeatureSets.concat [individualFeatures, v1Features, bonusFeatures]
			features = _.reduce(featureSets, FeaturesUpdater._mergeFeatures, Settings.defaultFeatures)

			logger.log {user_id, features}, 'updating user features'
			UserFeaturesUpdater.updateFeatures user_id, features, callback

	_getIndividualFeatures: (user_id, callback = (error, features = {}) ->) ->
		SubscriptionLocator.getUsersSubscription user_id, (err, sub)->
			callback err, FeaturesUpdater._subscriptionToFeatures(sub)

	_getGroupFeatureSets: (user_id, callback = (error, featureSets = []) ->) ->
		SubscriptionLocator.getGroupSubscriptionsMemberOf user_id, (err, subs) ->
			callback err, (subs or []).map FeaturesUpdater._subscriptionToFeatures

	_getV1Features: (user_id, callback = (error, features = {}) ->) ->
		V1SubscriptionManager.getPlanCodeFromV1 user_id, (err, planCode) ->
			callback err, FeaturesUpdater._planCodeToFeatures(planCode)

	_mergeFeatures: (featuresA, featuresB) ->
		features = Object.assign({}, featuresA)
		for key, value of featuresB
			# Special merging logic for non-boolean features
			if key == 'compileGroup'
				if features['compileGroup'] == 'priority' or featuresB['compileGroup'] == 'priority'
					features['compileGroup'] = 'priority'
				else
					features['compileGroup'] = 'standard'
			else if key == 'collaborators'
				if features['collaborators'] == -1 or featuresB['collaborators'] == -1
					features['collaborators'] = -1
				else
					features['collaborators'] = Math.max(
						features['collaborators'] or 0,
						featuresB['collaborators'] or 0
					)
			else if key == 'compileTimeout'
				features['compileTimeout'] = Math.max(
					features['compileTimeout'] or 0,
					featuresB['compileTimeout'] or 0
				)
			else
				# Boolean keys, true is better
				features[key] = features[key] or featuresB[key]
		return features

	_subscriptionToFeatures: (subscription) ->
		FeaturesUpdater._planCodeToFeatures(subscription?.planCode)

	_planCodeToFeatures: (planCode) ->
		if !planCode?
			return {}
		plan = PlansLocator.findLocalPlanInSettings planCode
		if !plan?
			return {}
		else
			return plan.features

	_notifyV1: (user_id, callback = (error) ->) ->
