Subscription = require('../../models/Subscription').Subscription
logger = require("logger-sharelatex")
ObjectId = require('mongoose').Types.ObjectId

module.exports =

	getUsersSubscription: (user_or_id, callback)->
		if user_or_id? and user_or_id._id?
			user_id = user_or_id._id
		else if user_or_id?
			user_id = user_or_id
		logger.log user_id:user_id, "getting users subscription"
		Subscription.findOne admin_id:user_id, callback

	# TODO: Remove this one month after the ability to start free trials was removed
	expiredFreeTrials: (callback = (error, subscriptions)->) ->
		query =
			"freeTrial.expiresAt": "$lt": new Date()
			"freeTrial.downgraded": "$ne": true
		Subscription.find query, callback
