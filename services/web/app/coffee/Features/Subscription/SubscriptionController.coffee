SecurityManager     = require '../../managers/SecurityManager'
SubscriptionHandler  = require './SubscriptionHandler'
PlansLocator = require("./PlansLocator")
SubscriptionFormatters = require("./SubscriptionFormatters")
SubscriptionViewModelBuilder = require('./SubscriptionViewModelBuilder')
LimitationsManager = require("./LimitationsManager")
RecurlyWrapper = require './RecurlyWrapper'
Settings   = require 'settings-sharelatex'
logger     = require('logger-sharelatex')



module.exports = SubscriptionController =

	plansPage: (req, res, next) ->
		plans = SubscriptionViewModelBuilder.buildViewModel()
		if !req.session.user?
			baseUrl = "/register?redir="
		else
			baseUrl = ""
		viewName = "subscriptions/plans"
		logger.log viewName:viewName, "showing plans page"
		res.render viewName,
			title: "plans_and_pricing"
			plans: plans
			baseUrl: baseUrl

	#get to show the recurly.js page
	paymentPage: (req, res, next) ->
		SecurityManager.getCurrentUser req, (error, user) =>
			return next(error) if error?
			plan = PlansLocator.findLocalPlanInSettings(req.query.planCode)
			LimitationsManager.userHasSubscription user, (err, hasSubscription)->
				if hasSubscription or !plan?
					res.redirect "/user/subscription"
				else
					RecurlyWrapper.sign {
						subscription:
							plan_code : req.query.planCode
						account_code: user.id
					}, (error, signature) ->
						return next(error) if error?
						res.render "subscriptions/new",
							title      : "subscribe"
							plan_code: req.query.planCode
							recurlyConfig: JSON.stringify
								currency: "USD"
								subdomain: Settings.apis.recurly.subdomain
							subscriptionFormOptions: JSON.stringify
								acceptedCards: ['discover', 'mastercard', 'visa']
								target      : "#subscribeForm"
								signature   : signature
								planCode    : req.query.planCode
								successURL  : "#{Settings.siteUrl}/user/subscription/create?_csrf=#{req.session._csrf}"
								accountCode : user.id
								enableCoupons: true
								acceptPaypal: true
								account     :
									firstName : user.first_name
									lastName  : user.last_name
									email     : user.email


	userSubscriptionPage: (req, res, next) ->
		SecurityManager.getCurrentUser req, (error, user) =>
			return next(error) if error?
			LimitationsManager.userHasSubscriptionOrFreeTrial user, (err, hasSubOrFreeTrial)->
				if !hasSubOrFreeTrial
					logger.log user: user, "redirecting to plans"
					res.redirect "/user/subscription/plans"
				else
					SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel user, (error, subscription) ->
						return next(error) if error?
						logger.log user: user, subscription:subscription, hasSubOrFreeTrial:hasSubOrFreeTrial, "showing subscription dashboard"
						plans = SubscriptionViewModelBuilder.buildViewModel()
						res.render "subscriptions/dashboard",
							title: "your_subscription"
							plans: plans
							subscription: subscription
							subscriptionTabActive: true


	editBillingDetailsPage: (req, res, next) ->
		SecurityManager.getCurrentUser req, (error, user) ->
			return next(error) if error?
			LimitationsManager.userHasSubscription user, (err, hasSubscription)->
				if !hasSubscription
					res.redirect "/user/subscription"
				else
					RecurlyWrapper.sign {
						account_code: user.id
					}, (error, signature) ->
						return next(error) if error?
						res.render "subscriptions/edit-billing-details",
							title      : "update_billing_details"
							recurlyConfig: JSON.stringify
								currency: "USD"
								subdomain: Settings.apis.recurly.subdomain
							signature  : signature
							successURL : "#{Settings.siteUrl}/user/subscription/update"
							user       :
								id : user.id

	createSubscription: (req, res, next)->
		SecurityManager.getCurrentUser req, (error, user) ->
			return callback(error) if error?
			subscriptionId = req.body.recurly_token
			logger.log subscription_id: subscriptionId, user_id:user._id, "creating subscription"
			SubscriptionHandler.createSubscription user, subscriptionId, (err)->
				if err?
					logger.err err:err, user_id:user._id, "something went wrong creating subscription"
				res.redirect "/user/subscription/thank-you"

	successful_subscription: (req, res)->
		SecurityManager.getCurrentUser req, (error, user) =>
			SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel user, (error, subscription) ->
				res.render "subscriptions/successful_subscription",
					title: "thank_you"
					subscription:subscription

	cancelSubscription: (req, res, next) ->
		SecurityManager.getCurrentUser req, (error, user) ->
			logger.log user_id:user._id, "canceling subscription"
			return next(error) if error?
			SubscriptionHandler.cancelSubscription user, (err)->
				if err?
					logger.err err:err, user_id:user._id, "something went wrong canceling subscription"
				res.redirect "/user/subscription"
 

	updateSubscription: (req, res)->
		SecurityManager.getCurrentUser req, (error, user) ->
			return next(error) if error?
			planCode = req.body.plan_code
			logger.log planCode: planCode, user_id:user._id, "updating subscription"
			SubscriptionHandler.updateSubscription user, planCode, (err)->
				if err?
					logger.err err:err, user_id:user._id, "something went wrong updating subscription"
				res.redirect "/user/subscription"

	reactivateSubscription: (req, res)->
		SecurityManager.getCurrentUser req, (error, user) ->
			logger.log user_id:user._id, "reactivating subscription"
			return next(error) if error?
			SubscriptionHandler.reactivateSubscription user, (err)->
				if err?
					logger.err err:err, user_id:user._id, "something went wrong reactivating subscription"
				res.redirect "/user/subscription"

	recurlyCallback: (req, res)->
		logger.log data: req.body, "received recurly callback"
		# we only care if a subscription has exipired
		if req.body? and req.body["expired_subscription_notification"]?
			recurlySubscription = req.body["expired_subscription_notification"].subscription
			SubscriptionHandler.recurlyCallback recurlySubscription, ->
				res.send 200
		else
			res.send 200

	recurlyNotificationParser: (req, res, next) ->
		xml = ""
		req.on "data", (chunk) ->
			xml += chunk
		req.on "end", () ->
			RecurlyWrapper._parseXml xml, (error, body) ->
				return next(error) if error?
				req.body = body
				next()
