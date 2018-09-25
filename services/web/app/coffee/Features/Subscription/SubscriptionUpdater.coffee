async = require("async")
_ = require("underscore")
Subscription = require('../../models/Subscription').Subscription
SubscriptionLocator = require("./SubscriptionLocator")
UserGetter = require("../User/UserGetter")
PlansLocator = require("./PlansLocator")
Settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
ObjectId = require('mongoose').Types.ObjectId
FeaturesUpdater = require('./FeaturesUpdater')

oneMonthInSeconds = 60 * 60 * 24 * 30

module.exports = SubscriptionUpdater =
	syncSubscription: (recurlySubscription, adminUser_id, callback) ->
		logger.log adminUser_id:adminUser_id, recurlySubscription:recurlySubscription, "syncSubscription, creating new if subscription does not exist"
		SubscriptionLocator.getUsersSubscription adminUser_id, (err, subscription)->
			return callback(err) if err?
			if subscription?
				logger.log  adminUser_id:adminUser_id, recurlySubscription:recurlySubscription, "subscription does exist"
				SubscriptionUpdater._updateSubscriptionFromRecurly recurlySubscription, subscription, callback
			else
				logger.log  adminUser_id:adminUser_id, recurlySubscription:recurlySubscription, "subscription does not exist, creating a new one"
				SubscriptionUpdater._createNewSubscription adminUser_id, (err, subscription)->
					return callback(err) if err?
					SubscriptionUpdater._updateSubscriptionFromRecurly recurlySubscription, subscription, callback

	addUserToGroup: (subscriptionId, userId, callback)->
		@addUsersToGroup(subscriptionId, [userId], callback)

	addUsersToGroup: (subscriptionId, memberIds, callback)->
		logger.log subscriptionId: subscriptionId, memberIds: memberIds, "adding members into mongo subscription"
		searchOps =
			_id: subscriptionId
		insertOperation =
			{ $push: { member_ids: { $each: memberIds } } }

		Subscription.findAndModify searchOps, insertOperation, (err, subscription) ->
			return callback(err) if err?

			# Only apply features updates to users, not user stubs
			UserGetter.getUsers memberIds, { _id: 1 }, (err, users) ->
				return callback(err) if err?

				userIds = users.map (u) -> u._id.toString()
				async.map userIds, FeaturesUpdater.refreshFeatures, callback


	removeUserFromGroup: (subscriptionId, user_id, callback)->
		searchOps =
			_id: subscriptionId
		removeOperation =
			"$pull": {member_ids:user_id}
		Subscription.update searchOps, removeOperation, (err)->
			if err?
				logger.err err:err, searchOps:searchOps, removeOperation:removeOperation, "error removing user from group"
				return callback(err)
			UserGetter.getUserOrUserStubById user_id, {}, (error, user, isStub) ->
				return callback(error) if error
				return callback() if isStub
				FeaturesUpdater.refreshFeatures user_id, callback

	deleteWithV1Id: (v1TeamId, callback)->
		Subscription.deleteOne { "overleaf.id": v1TeamId }, callback

	deleteSubscription: (subscription_id, callback = (error) ->) ->
		SubscriptionLocator.getSubscription subscription_id, (err, subscription) ->
			return callback(err) if err?
			affected_user_ids = [subscription.admin_id].concat(subscription.member_ids or [])
			logger.log {subscription_id, affected_user_ids}, "deleting subscription and downgrading users"
			Subscription.remove {_id: ObjectId(subscription_id)}, (err) ->
				return callback(err) if err?
				async.mapSeries affected_user_ids, FeaturesUpdater.refreshFeatures, callback

	_createNewSubscription: (adminUser_id, callback)->
		logger.log adminUser_id:adminUser_id, "creating new subscription"
		subscription = new Subscription(admin_id:adminUser_id, manager_ids: [adminUser_id])
		subscription.freeTrial.allowed = false
		subscription.save (err)->
			callback err, subscription

	_updateSubscriptionFromRecurly: (recurlySubscription, subscription, callback)->
		logger.log recurlySubscription:recurlySubscription, subscription:subscription, "updaing subscription"
		if recurlySubscription.state == "expired"
			return SubscriptionUpdater.deleteSubscription subscription._id, callback
		subscription.recurlySubscription_id = recurlySubscription.uuid
		subscription.freeTrial.expiresAt = undefined
		subscription.freeTrial.planCode = undefined
		subscription.freeTrial.allowed = true
		subscription.planCode = recurlySubscription.plan.plan_code
		plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)
		if !plan?
			return callback(new Error("plan code not found: #{subscription.planCode}"))
		if plan.groupPlan
			subscription.groupPlan = true
			subscription.membersLimit = plan.membersLimit
		subscription.save ->
			allIds = _.union subscription.member_ids, [subscription.admin_id]
			jobs = allIds.map (user_id)->
				return (cb)->
					FeaturesUpdater.refreshFeatures user_id, cb
			async.series jobs, callback
