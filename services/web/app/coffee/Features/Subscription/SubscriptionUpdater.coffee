async = require("async")
_ = require("underscore")
Subscription = require('../../models/Subscription').Subscription
SubscriptionLocator = require("./SubscriptionLocator")
UserFeaturesUpdater = require("./UserFeaturesUpdater")
PlansLocator = require("./PlansLocator")
Settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
ObjectId = require('mongoose').Types.ObjectId	
ReferalAllocator = require("../Referal/ReferalAllocator")

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

	removeUserFromGroup: (adminUser_id, user_id, callback)->
		searchOps = 
			admin_id: adminUser_id
		removeOperation = 
			"$pull": {member_ids:user_id}
		Subscription.update searchOps, removeOperation, (err)->
			if err?
				logger.err err:err, searchOps:searchOps, removeOperation:removeOperation, "error removing user from group"
				return callback(err)
			SubscriptionUpdater._setUsersMinimumFeatures user_id, callback


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
			allIds = _.union subscription.members_id, [subscription.admin_id]
			jobs = allIds.map (user_id)->
				return (cb)->
					SubscriptionUpdater._setUsersMinimumFeatures user_id, cb
			async.series jobs, callback

	_setUsersMinimumFeatures: (user_id, callback)->
		jobs =
			subscription: (cb)->
				SubscriptionLocator.getUsersSubscription user_id, cb
			groupSubscription: (cb)->
				SubscriptionLocator.getGroupSubscriptionMemberOf user_id, cb
		async.series jobs, (err, results)->
			if err?
				logger.err err:err, user_id:user, "error getting subscription or group for _setUsersMinimumFeatures"
				return callback(err)
			{subscription, groupSubscription} = results
			if subscription? and subscription.planCode?
				logger.log user_id:user_id, "using users subscription plan code for features"
				UserFeaturesUpdater.updateFeatures user_id, subscription.planCode, callback
			else if groupSubscription? and groupSubscription.planCode?
				logger.log user_id:user_id, "using group which user is memor of for features"
				UserFeaturesUpdater.updateFeatures user_id, groupSubscription.planCode, callback
			else
				logger.log user_id:user_id, "using default features for user with no subscription or group"
				UserFeaturesUpdater.updateFeatures user_id, Settings.defaultPlanCode, (err)->
					if err?
						logger.err err:err, user_id:user_id, "Error setting minimum user feature"
						return callback(err)
					ReferalAllocator.assignBonus user_id, callback

