SecurityManager     = require '../../managers/SecurityManager'
SubscriptionHandler  = require './SubscriptionHandler'
PlansLocator = require("./PlansLocator")
SubscriptionFormatters = require("./SubscriptionFormatters")
SubscriptionViewModelBuilder = require('./SubscriptionViewModelBuilder')
LimitationsManager = require("./LimitationsManager")
RecurlyWrapper = require './RecurlyWrapper'
Settings   = require 'settings-sharelatex'
logger     = require('logger-sharelatex')
GeoIpLookup = require("../../infrastructure/GeoIpLookup")


module.exports = SubscriptionController =

	plansPage: (req, res, next) ->
		plans = SubscriptionViewModelBuilder.buildViewModel()
		if !req.session.user?
			baseUrl = "/register?redir="
		else
			baseUrl = ""
		viewName = "subscriptions/plans"
		if req.query.v?
			viewName = "#{viewName}_#{req.query.v}"
		logger.log viewName:viewName, "showing plans page"
		GeoIpLookup.getCurrencyCode req.query?.ip || req.ip, (err, recomendedCurrency)->
			res.render viewName,
				title: "plans_and_pricing"
				plans: plans
				baseUrl: baseUrl
				gaExperiments: Settings.gaExperiments.plansPage
				recomendedCurrency:recomendedCurrency

	#get to show the recurly.js page
	paymentPage: (req, res, next) ->
		SecurityManager.getCurrentUser req, (error, user) =>
			return next(error) if error?
			plan = PlansLocator.findLocalPlanInSettings(req.query.planCode)
			LimitationsManager.userHasSubscription user, (err, hasSubscription)->
				return next(err) if err?
				if hasSubscription or !plan?
					res.redirect "/user/subscription"
				else
					currency = req.query.currency?.toUpperCase()
					GeoIpLookup.getCurrencyCode req.query?.ip || req.ip, (err, recomendedCurrency, countryCode)->
						return next(err) if err?
						if recomendedCurrency? and !currency?
							currency = recomendedCurrency
						RecurlyWrapper.sign {
							subscription:
								plan_code : req.query.planCode
								currency: currency
							account_code: user.id
						}, (error, signature) ->
							return next(error) if error?
							res.render "subscriptions/new",
								title      : "subscribe"
								plan_code: req.query.planCode
								currency: currency
								countryCode:countryCode
								plan:plan
								showStudentPlan: req.query.ssp
								recurlyConfig: JSON.stringify
									currency: currency
									subdomain: Settings.apis.recurly.subdomain
								showCouponField: req.query.scf
								couponCode:      req.query.cc or ""
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
			LimitationsManager.userHasSubscriptionOrIsGroupMember user, (err, hasSubOrIsGroupMember, subscription)->
				if subscription?.customAccount
					logger.log user: user, "redirecting to plans"
					res.redirect "/user/subscription/custom_account"				
				else if !hasSubOrIsGroupMember
					logger.log user: user, "redirecting to plans"
					res.redirect "/user/subscription/plans"
				else
					SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel user, (error, subscription, groups) ->
						return next(error) if error?
						logger.log user: user, subscription:subscription, hasSubOrIsGroupMember:hasSubOrIsGroupMember, "showing subscription dashboard"
						plans = SubscriptionViewModelBuilder.buildViewModel()
						res.render "subscriptions/dashboard",
							title: "your_subscription"
							recomendedCurrency: subscription?.currency
							taxRate:subscription?.taxRate
							plans: plans
							subscription: subscription
							groups: groups
							subscriptionTabActive: true


	userCustomSubscriptionPage: (req, res, next)->
		SecurityManager.getCurrentUser req, (error, user) ->
			LimitationsManager.userHasSubscriptionOrIsGroupMember user, (err, hasSubOrIsGroupMember, subscription)->
				res.render "subscriptions/custom_account",
					title: "your_subscription"
					subscription: subscription


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
			recurly_token_id = req.body.recurly_token_id
			subscriptionDetails = req.body.subscriptionDetails
			logger.log recurly_token_id: recurly_token_id, user_id:user._id, subscriptionDetails:subscriptionDetails, "creating subscription"
			SubscriptionHandler.createSubscription user, subscriptionDetails, recurly_token_id, (err)->
				if err?
					logger.err err:err, user_id:user._id, "something went wrong creating subscription"
					return res.send 500
				res.send 201

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
			SubscriptionHandler.updateSubscription user, planCode, null, (err)->
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

	renderUpgradeToAnnualPlanPage: (req, res)->
		SecurityManager.getCurrentUser req, (error, user) ->
			LimitationsManager.userHasSubscription user, (err, hasSubscription, subscription)->
				planCode = subscription?.planCode.toLowerCase()
				if planCode?.indexOf("annual") != -1
					planName = "annual"
				else if planCode?.indexOf("student") != -1
					planName = "student"
				else if planCode?.indexOf("collaborator") != -1
					planName = "collaborator"
				if !hasSubscription
					return res.redirect("/user/subscription/plans")
				logger.log planName:planName, user_id:user._id, "rendering upgrade to annual page"
				res.render "subscriptions/upgradeToAnnual",
					title: "Upgrade to annual"
					planName: planName

	processUpgradeToAnnualPlan: (req, res)->
		SecurityManager.getCurrentUser req, (error, user) ->
			{planName} = req.body
			coupon_code = Settings.coupon_codes.upgradeToAnnualPromo[planName]
			annualPlanName = "#{planName}-annual"
			logger.log user_id:user._id, planName:annualPlanName, "user is upgrading to annual billing with discount"
			SubscriptionHandler.updateSubscription user, annualPlanName, coupon_code, (err)->
				if err?
					logger.err err:err, user_id:user._id, "error updating subscription"
					res.send 500
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
