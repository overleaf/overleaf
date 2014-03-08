async = require 'async'
logger = require 'logger-sharelatex'
SubscriptionUpdater = require("./SubscriptionUpdater")
SubscriptionLocator = require("./SubscriptionLocator")

module.exports = SubscriptionBackgroundJobs =
	# TODO: Remove this one month after the ability to start free trials was removed
	downgradeExpiredFreeTrials: (callback = (error, subscriptions)->) ->
		SubscriptionLocator.expiredFreeTrials (error, subscriptions) =>
			return callback(error) if error?
			logger.log total_subscriptions:subscriptions.length, "downgraging subscriptions"
			downgrades = []
			for subscription in subscriptions
				do (subscription) =>
					downgrades.push	(cb) =>
						logger.log subscription: subscription, "downgrading free trial"
						SubscriptionUpdater.downgradeFreeTrial(subscription, cb)
			async.series downgrades, (error) -> callback(error, subscriptions)

