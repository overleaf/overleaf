RecurlyWrapper = require("./RecurlyWrapper")
Settings = require "settings-sharelatex"
User = require('../../models/User').User
logger = require('logger-sharelatex')
AnalyticsManager  = require '../Analytics/AnalyticsManager'
SubscriptionUpdater = require("./SubscriptionUpdater")
LimitationsManager = require('./LimitationsManager')
EmailHandler = require("../Email/EmailHandler")

module.exports =

	createSubscription: (user, recurlySubscriptionId, callback)->
		self = @
		RecurlyWrapper.getSubscription recurlySubscriptionId, {recurlyJsResult: true}, (error, recurlySubscription) ->
			return callback(error) if error?
			SubscriptionUpdater.syncSubscription recurlySubscription, user._id, (error) ->
				return callback(error) if error?
				AnalyticsManager.trackSubscriptionStarted user, recurlySubscription?.plan?.plan_code
				callback()

	updateSubscription: (user, plan_code, callback)->
		logger.log user:user, plan_code:plan_code, "updating subscription"
		LimitationsManager.userHasSubscription user, (err, hasSubscription, subscription)->
			if hasSubscription
				RecurlyWrapper.updateSubscription subscription.recurlySubscription_id, {plan_code: plan_code, timeframe: "now"}, (error, recurlySubscription) ->
					return callback(error) if error?
					SubscriptionUpdater.syncSubscription recurlySubscription, user._id, callback
			else
				callback()

	cancelSubscription: (user, callback) ->
		LimitationsManager.userHasSubscription user, (err, hasSubscription, subscription)->
			if hasSubscription
				RecurlyWrapper.cancelSubscription subscription.recurlySubscription_id, (error) ->
					return callback(error) if error?
					AnalyticsManager.trackSubscriptionCancelled user
					emailOpts =
						to: user.email
						first_name: user.first_name
					EmailHandler.sendEmail "canceledSubscription", emailOpts
					callback()
			else
				callback()

	reactivateSubscription: (user, callback) ->
		LimitationsManager.userHasSubscription user, (err, hasSubscription, subscription)->
			if hasSubscription
				RecurlyWrapper.reactivateSubscription subscription.recurlySubscription_id, (error) ->
					return callback(error) if error?
					callback()
			else
				callback()

	recurlyCallback: (recurlySubscription, callback) ->
		RecurlyWrapper.getSubscription recurlySubscription.uuid, includeAccount: true, (error, recurlySubscription) ->
			return callback(error) if error?
			User.findById recurlySubscription.account.account_code, (error, user) ->
				return callback(error) if error?
				SubscriptionUpdater.syncSubscription recurlySubscription, user._id, callback



