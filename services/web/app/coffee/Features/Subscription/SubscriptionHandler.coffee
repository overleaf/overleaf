async = require("async")
RecurlyWrapper = require("./RecurlyWrapper")
Settings = require "settings-sharelatex"
User = require('../../models/User').User
logger = require('logger-sharelatex')
SubscriptionUpdater = require("./SubscriptionUpdater")
LimitationsManager = require('./LimitationsManager')
EmailHandler = require("../Email/EmailHandler")
DropboxHandler = require("../Dropbox/DropboxHandler")

module.exports =

	createSubscription: (user, recurly_token_id, callback)->
		self = @
		clientTokenId = ""
		RecurlyWrapper.createSubscription user, recurly_token_id, (error, recurlySubscription)->
			return callback(error) if error?
			SubscriptionUpdater.syncSubscription recurlySubscription, user._id, (error) ->
				return callback(error) if error?
				callback()

	updateSubscription: (user, plan_code, coupon_code, callback)->
		logger.log user:user, plan_code:plan_code, coupon_code:coupon_code, "updating subscription"
		LimitationsManager.userHasSubscription user, (err, hasSubscription, subscription)->
			if !hasSubscription
				return callback()
			else
				async.series [
					(cb)->
						return cb() if !coupon_code?
						logger.log user_id:user._id, plan_code:plan_code, coupon_code:coupon_code, "updating subscription with coupon code applied first"
						RecurlyWrapper.getSubscription subscription.recurlySubscription_id, includeAccount: true, (err, usersSubscription)->
							return callback(err) if err?
							account_code = usersSubscription.account.account_code
							RecurlyWrapper.redeemCoupon account_code, coupon_code, cb
					(cb)->
						RecurlyWrapper.updateSubscription subscription.recurlySubscription_id, {plan_code: plan_code, timeframe: "now"}, (error, recurlySubscription) ->
							return callback(error) if error?
							SubscriptionUpdater.syncSubscription recurlySubscription, user._id, cb
				], callback
		

	cancelSubscription: (user, callback) ->
		LimitationsManager.userHasSubscription user, (err, hasSubscription, subscription)->
			if hasSubscription
				RecurlyWrapper.cancelSubscription subscription.recurlySubscription_id, (error) ->
					return callback(error) if error?
					emailOpts =
						to: user.email
						first_name: user.first_name
					ONE_HOUR_IN_MS = 1000 * 60 * 60
					setTimeout (-> EmailHandler.sendEmail "canceledSubscription", emailOpts
					), ONE_HOUR_IN_MS
					DropboxHandler.unlinkAccount user._id, ->
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



