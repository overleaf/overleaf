async = require("async")
_ = require("underscore")
Subscription = require('../../models/Subscription').Subscription
SubscriptionLocator = require("./SubscriptionLocator")
UserFeaturesUpdater = require("./UserFeaturesUpdater")
PlansLocator = require("./PlansLocator")
Settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
ObjectId = require('mongoose').Types.ObjectId	
ReferalFeatures = require("../Referal/ReferalFeatures")
V1SubscriptionManager = require("./V1SubscriptionManager")

oneMonthInSeconds = 60 * 60 * 24 * 30

module.exports = SubscriptionUpdater =

	syncSubscription: (recurlySubscription, adminUser_id, callback) ->
		logger.log adminUser_id:adminUser_id, recurlySubscription:recurlySubscription, "syncSubscription, creating new if subscription does not exist"
		SubscriptionLocator.getUsersSubscription adminUser_id, (err, subscription)->
			if subscription?
				logger.log  adminUser_id:adminUser_id, recurlySubscription:recurlySubscription, "subscription does exist"
				SubscriptionUpdater._updateSubscriptionFromRecurly recurlySubscription, subscription, callback
			else
				logger.log  adminUser_id:adminUser_id, recurlySubscription:recurlySubscription, "subscription does not exist, creating a new one"
				SubscriptionUpdater._createNewSubscription adminUser_id, (err, subscription)->
					SubscriptionUpdater._updateSubscriptionFromRecurly recurlySubscription, subscription, callback

	addUserToGroup: (adminUser_id, user_id, callback)->
		logger.log adminUser_id:adminUser_id, user_id:user_id, "adding user into mongo subscription"
		searchOps = 
			admin_id: adminUser_id
		insertOperation = 
			"$addToSet": {member_ids:user_id}
		Subscription.findAndModify searchOps, insertOperation, (err, subscription)->
			if err?
				logger.err err:err, searchOps:searchOps, insertOperation:insertOperation, "error findy and modify add user to group"
				return callback(err)
			UserFeaturesUpdater.updateFeatures user_id, subscription.planCode, callback
	
	addEmailInviteToGroup: (adminUser_id, email, callback) ->
		logger.log {adminUser_id, email}, "adding email into mongo subscription"
		searchOps = 
			admin_id: adminUser_id
		insertOperation =
			"$addToSet": {invited_emails: email}
		Subscription.findAndModify searchOps, insertOperation, callback

	removeUserFromGroup: (adminUser_id, user_id, callback)->
		searchOps = 
			admin_id: adminUser_id
		removeOperation = 
			"$pull": {member_ids:user_id}
		Subscription.update searchOps, removeOperation, (err)->
			if err?
				logger.err err:err, searchOps:searchOps, removeOperation:removeOperation, "error removing user from group"
				return callback(err)
			SubscriptionUpdater.refreshFeatures user_id, callback

	removeEmailInviteFromGroup: (adminUser_id, email, callback)->
		Subscription.update {
			admin_id: adminUser_id
		}, "$pull": {
			invited_emails: email
		}, callback

	deleteSubscription: (subscription_id, callback = (error) ->) ->
		SubscriptionLocator.getSubscription subscription_id, (err, subscription) ->
			return callback(err) if err?
			affected_user_ids = [subscription.admin_id].concat(subscription.member_ids or [])
			logger.log {subscription_id, affected_user_ids}, "deleting subscription and downgrading users"
			Subscription.remove {_id: ObjectId(subscription_id)}, (err) ->
				return callback(err) if err?
				async.mapSeries affected_user_ids, SubscriptionUpdater.refreshFeatures, callback

	_createNewSubscription: (adminUser_id, callback)->
		logger.log adminUser_id:adminUser_id, "creating new subscription"
		subscription = new Subscription(admin_id:adminUser_id)
		subscription.freeTrial.allowed = false
		subscription.save (err)->
			callback err, subscription

	_updateSubscriptionFromRecurly: (recurlySubscription, subscription, callback)->
		logger.log recurlySubscription:recurlySubscription, subscription:subscription, "updaing subscription"
		plan = PlansLocator.findLocalPlanInSettings(recurlySubscription.plan.plan_code)
		if recurlySubscription.state == "expired"
			subscription.recurlySubscription_id = undefined
			subscription.planCode = Settings.defaultPlanCode
		else
			subscription.recurlySubscription_id = recurlySubscription.uuid
			subscription.freeTrial.expiresAt = undefined
			subscription.freeTrial.planCode = undefined
			subscription.freeTrial.allowed = true
			subscription.planCode = recurlySubscription.plan.plan_code
		if plan.groupPlan
			subscription.groupPlan = true
			subscription.membersLimit = plan.membersLimit
		subscription.save ->
			allIds = _.union subscription.member_ids, [subscription.admin_id]
			jobs = allIds.map (user_id)->
				return (cb)->
					SubscriptionUpdater.refreshFeatures user_id, cb
			async.series jobs, callback

	refreshFeatures: (user_id, callback)->
		jobs =
			individualFeatures: (cb) -> SubscriptionUpdater._getIndividualFeatures user_id, cb
			groupFeatureSets:   (cb) -> SubscriptionUpdater._getGroupFeatureSets user_id, cb
			v1Features:         (cb) -> SubscriptionUpdater._getV1Features user_id, cb
			bonusFeatures:      (cb) -> ReferalFeatures.getBonusFeatures user_id, cb
		async.series jobs, (err, results)->
			if err?
				logger.err err:err, user_id:user_id,
					"error getting subscription or group for refreshFeatures"
				return callback(err)

			{individualFeatures, groupFeatureSets, v1Features, bonusFeatures} = results
			logger.log {user_id, individualFeatures, groupFeatureSets, v1Features, bonusFeatures}, 'merging user features'
			featureSets = groupFeatureSets.concat [individualFeatures, v1Features, bonusFeatures]
			features = _.reduce(featureSets, SubscriptionUpdater._mergeFeatures, Settings.defaultFeatures)

			logger.log {user_id, features}, 'updating user features'
			UserFeaturesUpdater.updateFeatures user_id, features, callback

	_getIndividualFeatures: (user_id, callback = (error, features = {}) ->) ->
		SubscriptionLocator.getUsersSubscription user_id, (err, sub)->
			callback err, SubscriptionUpdater._subscriptionToFeatures(sub)

	_getGroupFeatureSets: (user_id, callback = (error, featureSets = []) ->) ->
		SubscriptionLocator.getGroupSubscriptionsMemberOf user_id, (err, subs) ->
			callback err, (subs or []).map SubscriptionUpdater._subscriptionToFeatures

	_getV1Features: (user_id, callback = (error, features = {}) ->) ->
		V1SubscriptionManager.getPlanCodeFromV1 user_id, (err, planCode) ->
			callback err, SubscriptionUpdater._planCodeToFeatures(planCode)

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
		SubscriptionUpdater._planCodeToFeatures(subscription?.planCode)

	_planCodeToFeatures: (planCode) ->
		if !planCode?
			return {}
		plan = PlansLocator.findLocalPlanInSettings planCode
		if !plan?
			return {}
		else
			return plan.features