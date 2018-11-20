Subscription = require('../../models/Subscription').Subscription
logger = require("logger-sharelatex")
ObjectId = require('mongoose').Types.ObjectId

module.exports = SubscriptionLocator =

	getUsersSubscription: (user_or_id, callback)->
		user_id = @_getUserId(user_or_id)
		logger.log user_id:user_id, "getting users subscription"
		Subscription.findOne admin_id:user_id, (err, subscription)->
			logger.log user_id:user_id, "got users subscription"
			callback(err, subscription)

	findManagedSubscription: (managerId, callback)->
		logger.log managerId: managerId, "finding managed subscription"
		Subscription.findOne manager_ids: managerId, callback

	getManagedGroupSubscriptions: (user_or_id, callback = (error, managedSubscriptions) ->) ->
		user_id = @_getUserId(user_or_id)
		Subscription.find({
			manager_ids: user_or_id,
			groupPlan: true
		}).populate("admin_id").exec callback

	getMemberSubscriptions: (user_or_id, callback) ->
		user_id = @_getUserId(user_or_id)
		logger.log user_id: user_id, "getting users group subscriptions"
		Subscription.find(member_ids: user_id).populate("admin_id").exec callback

	getSubscription: (subscription_id, callback)->
		Subscription.findOne _id:subscription_id, callback

	getSubscriptionByMemberIdAndId: (user_id, subscription_id, callback)->
		Subscription.findOne {member_ids: user_id, _id:subscription_id}, {_id:1}, callback

	getGroupSubscriptionsMemberOf: (user_id, callback)->
		Subscription.find {member_ids: user_id}, {_id:1, planCode:1}, callback

	getGroupsWithEmailInvite: (email, callback) ->
		Subscription.find { invited_emails: email }, callback

	getGroupWithV1Id: (v1TeamId, callback) ->
		Subscription.findOne { "overleaf.id": v1TeamId }, callback

	_getUserId: (user_or_id) ->
		if user_or_id? and user_or_id._id?
			return user_or_id._id
		else if user_or_id?
			return user_or_id
