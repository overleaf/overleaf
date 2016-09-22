AuthenticationController = require '../Authentication/AuthenticationController'
SubscriptionHandler  = require './SubscriptionHandler'
PlansLocator = require("./PlansLocator")
SubscriptionViewModelBuilder = require('./SubscriptionViewModelBuilder')
LimitationsManager = require("./LimitationsManager")
RecurlyWrapper = require './RecurlyWrapper'
Settings   = require 'settings-sharelatex'
logger     = require('logger-sharelatex')
GeoIpLookup = require("../../infrastructure/GeoIpLookup")
SubscriptionDomainHandler = require("./SubscriptionDomainHandler")

module.exports = SubscriptionController =

	plansPage: (req, res, next) ->
		plans = SubscriptionViewModelBuilder.buildViewModel()
		if AuthenticationController.isUserLoggedIn(req)
			baseUrl = ""
		else
			baseUrl = "/register?redir="
		viewName = "subscriptions/plans"
		if req.query.v?
			viewName = "#{viewName}_#{req.query.v}"
		logger.log viewName:viewName, "showing plans page"
		GeoIpLookup.getCurrencyCode req.query?.ip || req.ip, (err, recomendedCurrency)->
			return next(err) if err?
			res.render viewName,
				title: "plans_and_pricing"
				plans: plans
				baseUrl: baseUrl
				gaExperiments: Settings.gaExperiments.plansPage
				recomendedCurrency:recomendedCurrency

	#get to show the recurly.js page
	paymentPage: (req, res, next) ->
		user = AuthenticationController.getSessionUser(req)
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
						account_code: user._id
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
							showVatField: req.query.svf
							couponCode:      req.query.cc or ""



	userSubscriptionPage: (req, res, next) ->
		user = AuthenticationController.getSessionUser(req)
		LimitationsManager.userHasSubscriptionOrIsGroupMember user, (err, hasSubOrIsGroupMember, subscription)->
			return next(err) if err?
			groupLicenceInviteUrl = SubscriptionDomainHandler.getDomainLicencePage(user)
			if subscription?.customAccount
				logger.log user: user, "redirecting to custom account page"
				res.redirect "/user/subscription/custom_account"
			else if groupLicenceInviteUrl? and !hasSubOrIsGroupMember
				logger.log user:user, "redirecting to group subscription invite page"
				res.redirect groupLicenceInviteUrl
			else if !hasSubOrIsGroupMember
				logger.log user: user, "redirecting to plans"
				res.redirect "/user/subscription/plans"
			else
				SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel user, (error, subscription, groupSubscriptions) ->
					return next(error) if error?
					logger.log user: user, subscription:subscription, hasSubOrIsGroupMember:hasSubOrIsGroupMember, groupSubscriptions:groupSubscriptions, "showing subscription dashboard"
					plans = SubscriptionViewModelBuilder.buildViewModel()
					res.render "subscriptions/dashboard",
						title: "your_subscription"
						recomendedCurrency: subscription?.currency
						taxRate:subscription?.taxRate
						plans: plans
						subscription: subscription || {}
						groupSubscriptions: groupSubscriptions
						subscriptionTabActive: true
						user:user
						saved_billing_details: req.query.saved_billing_details?

	userCustomSubscriptionPage: (req, res, next)->
		user = AuthenticationController.getSessionUser(req)
		LimitationsManager.userHasSubscriptionOrIsGroupMember user, (err, hasSubOrIsGroupMember, subscription)->
			return next(err) if err?
			if !subscription?
				err = new Error("subscription null for custom account, user:#{user?._id}")
				logger.warn err:err, "subscription is null for custom accounts page"
				return next(err)
			res.render "subscriptions/custom_account",
				title: "your_subscription"
				subscription: subscription


	editBillingDetailsPage: (req, res, next) ->
		user = AuthenticationController.getSessionUser(req)
		LimitationsManager.userHasSubscription user, (err, hasSubscription)->
			return next(err) if err?
			if !hasSubscription
				res.redirect "/user/subscription"
			else
				RecurlyWrapper.sign {
					account_code: user._id
				}, (error, signature) ->
					return next(error) if error?
					res.render "subscriptions/edit-billing-details",
						title      : "update_billing_details"
						recurlyConfig: JSON.stringify
							currency: "USD"
							subdomain: Settings.apis.recurly.subdomain
						signature  : signature
						successURL : "#{Settings.siteUrl}/user/subscription/billing-details/update"
						user       :
							id : user._id

	updateBillingDetails: (req, res, next) ->
		res.redirect "/user/subscription?saved_billing_details=true"

	createSubscription: (req, res, next)->
		user = AuthenticationController.getSessionUser(req)
		recurly_token_id = req.body.recurly_token_id
		subscriptionDetails = req.body.subscriptionDetails
		logger.log recurly_token_id: recurly_token_id, user_id:user._id, subscriptionDetails:subscriptionDetails, "creating subscription"
		SubscriptionHandler.createSubscription user, subscriptionDetails, recurly_token_id, (err)->
			if err?
				logger.err err:err, user_id:user._id, "something went wrong creating subscription"
				return res.sendStatus 500
			res.sendStatus 201

	successful_subscription: (req, res, next)->
		user = AuthenticationController.getSessionUser(req)
		SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel user, (error, subscription) ->
			return next(error) if error?
			res.render "subscriptions/successful_subscription",
				title: "thank_you"
				subscription:subscription

	cancelSubscription: (req, res, next) ->
		user = AuthenticationController.getSessionUser(req)
		logger.log user_id:user._id, "canceling subscription"
		SubscriptionHandler.cancelSubscription user, (err)->
			if err?
				logger.err err:err, user_id:user._id, "something went wrong canceling subscription"
				return next(err)
			res.redirect "/user/subscription"

	updateSubscription: (req, res, next)->
		_origin = req?.query?.origin || null
		user = AuthenticationController.getSessionUser(req)
		planCode = req.body.plan_code
		if !planCode?
			err = new Error('plan_code is not defined')
			logger.err {user_id: user._id, err, planCode, origin: _origin, body: req.body}, "[Subscription] error in updateSubscription form"
			return next(err)
		logger.log planCode: planCode, user_id:user._id, "updating subscription"
		SubscriptionHandler.updateSubscription user, planCode, null, (err)->
			if err?
				logger.err err:err, user_id:user._id, "something went wrong updating subscription"
				return next(err)
			res.redirect "/user/subscription"

	reactivateSubscription: (req, res, next)->
		user = AuthenticationController.getSessionUser(req)
		logger.log user_id:user._id, "reactivating subscription"
		SubscriptionHandler.reactivateSubscription user, (err)->
			if err?
				logger.err err:err, user_id:user._id, "something went wrong reactivating subscription"
				return next(err)
			res.redirect "/user/subscription"

	recurlyCallback: (req, res, next)->
		logger.log data: req.body, "received recurly callback"
		# we only care if a subscription has exipired
		if req.body? and req.body["expired_subscription_notification"]?
			recurlySubscription = req.body["expired_subscription_notification"].subscription
			SubscriptionHandler.recurlyCallback recurlySubscription, (err)->
				return next(err) if err?
				res.sendStatus 200
		else
			res.sendStatus 200

	renderUpgradeToAnnualPlanPage: (req, res, next)->
		user = AuthenticationController.getSessionUser(req)
		LimitationsManager.userHasSubscription user, (err, hasSubscription, subscription)->
			return next(err) if err?
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

	processUpgradeToAnnualPlan: (req, res, next)->
		user = AuthenticationController.getSessionUser(req)
		{planName} = req.body
		coupon_code = Settings.coupon_codes.upgradeToAnnualPromo[planName]
		annualPlanName = "#{planName}-annual"
		logger.log user_id:user._id, planName:annualPlanName, "user is upgrading to annual billing with discount"
		SubscriptionHandler.updateSubscription user, annualPlanName, coupon_code, (err)->
			if err?
				logger.err err:err, user_id:user._id, "error updating subscription"
				return next(err)
			res.sendStatus 200

	extendTrial: (req, res, next)->
		user = AuthenticationController.getSessionUser(req)
		LimitationsManager.userHasSubscription user, (err, hasSubscription, subscription)->
			return next(err) if err?
			SubscriptionHandler.extendTrial subscription, 14, (err)->
				if err?
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
