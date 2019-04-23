AuthenticationController = require '../Authentication/AuthenticationController'
SubscriptionHandler  = require './SubscriptionHandler'
PlansLocator = require("./PlansLocator")
SubscriptionViewModelBuilder = require('./SubscriptionViewModelBuilder')
LimitationsManager = require("./LimitationsManager")
RecurlyWrapper = require './RecurlyWrapper'
Settings   = require 'settings-sharelatex'
logger     = require('logger-sharelatex')
GeoIpLookup = require("../../infrastructure/GeoIpLookup")
UserGetter = require "../User/UserGetter"
FeaturesUpdater = require './FeaturesUpdater'
planFeatures = require './planFeatures'
GroupPlansData = require './GroupPlansData'
V1SubscriptionManager = require "./V1SubscriptionManager"

module.exports = SubscriptionController =

	plansPage: (req, res, next) ->
		plans = SubscriptionViewModelBuilder.buildViewModel()
		viewName = "subscriptions/plans"
		if req.query.v?
			viewName = "#{viewName}_#{req.query.v}"
		logger.log viewName:viewName, "showing plans page"
		currentUser = null

		GeoIpLookup.getCurrencyCode req.query?.ip || req.ip, (err, recomendedCurrency)->
			return next(err) if err?
			render = () ->
				res.render viewName,
					title: "plans_and_pricing"
					plans: plans
					gaExperiments: Settings.gaExperiments.plansPage
					recomendedCurrency:recomendedCurrency
					planFeatures: planFeatures
					groupPlans: GroupPlansData
			user_id = AuthenticationController.getLoggedInUserId(req)
			if user_id?
				UserGetter.getUser user_id, {signUpDate: 1}, (err, user) ->
					return next(err) if err?
					currentUser = user
					render()
			else
				render()

	#get to show the recurly.js page
	paymentPage: (req, res, next) ->
		user = AuthenticationController.getSessionUser(req)
		plan = PlansLocator.findLocalPlanInSettings(req.query.planCode)
		LimitationsManager.userHasV1OrV2Subscription user, (err, hasSubscription)->
			return next(err) if err?
			if hasSubscription or !plan?
				res.redirect "/user/subscription?hasSubscription=true"
			else
				# LimitationsManager.userHasV2Subscription only checks Mongo. Double check with
				# Recurly as well at this point (we don't do this most places for speed).
				SubscriptionHandler.validateNoSubscriptionInRecurly user._id, (error, valid) ->
					return next(error) if error?
					if !valid
						res.redirect "/user/subscription?hasSubscription=true"
						return
					else
						currency = req.query.currency?.toUpperCase()
						GeoIpLookup.getCurrencyCode req.query?.ip || req.ip, (err, recomendedCurrency, countryCode)->
							return next(err) if err?
							if recomendedCurrency? and !currency?
								currency = recomendedCurrency
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
		SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel user, (error, results) ->
			return next(error) if error?
			{
				personalSubscription,
				memberGroupSubscriptions,
				managedGroupSubscriptions,
				confirmedMemberInstitutions,
				managedInstitutions,
				managedPublishers,
				v1SubscriptionStatus
			} = results
			LimitationsManager.userHasV1OrV2Subscription user, (err, hasSubscription) ->
				return next(error) if error?
				fromPlansPage = req.query.hasSubscription
				logger.log {
					user,
					hasSubscription,
					fromPlansPage,
					personalSubscription,
					memberGroupSubscriptions,
					managedGroupSubscriptions,
					confirmedMemberInstitutions,
					managedInstitutions,
					managedPublishers,
					v1SubscriptionStatus
				}, "showing subscription dashboard"
				plans = SubscriptionViewModelBuilder.buildViewModel()
				data = {
					title: "your_subscription"
					plans,
					user,
					hasSubscription,
					fromPlansPage,
					personalSubscription,
					memberGroupSubscriptions,
					managedGroupSubscriptions,
					confirmedMemberInstitutions,
					managedInstitutions,
					managedPublishers,
					v1SubscriptionStatus
				}
				res.render "subscriptions/dashboard", data

	createSubscription: (req, res, next)->
		user = AuthenticationController.getSessionUser(req)
		recurly_token_id = req.body.recurly_token_id
		subscriptionDetails = req.body.subscriptionDetails
		logger.log recurly_token_id: recurly_token_id, user_id:user._id, subscriptionDetails:subscriptionDetails, "creating subscription"
		
		LimitationsManager.userHasV1OrV2Subscription user, (err, hasSubscription)->
			return next(err) if err?
			if hasSubscription
				logger.warn {user_id: user._id}, 'user already has subscription'
				res.sendStatus 409 # conflict
			SubscriptionHandler.createSubscription user, subscriptionDetails, recurly_token_id, (err)->
				if err?
					logger.err err:err, user_id:user._id, "something went wrong creating subscription"
					return next(err)
				res.sendStatus 201

	successful_subscription: (req, res, next)->
		user = AuthenticationController.getSessionUser(req)
		SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel user, (error, {personalSubscription}) ->
			return next(error) if error?
			if !personalSubscription?
				return res.redirect '/user/subscription/plans'
			res.render "subscriptions/successful_subscription",
				title: "thank_you"
				personalSubscription: personalSubscription

	cancelSubscription: (req, res, next) ->
		user = AuthenticationController.getSessionUser(req)
		logger.log user_id:user._id, "canceling subscription"
		SubscriptionHandler.cancelSubscription user, (err)->
			if err?
				logger.err err:err, user_id:user._id, "something went wrong canceling subscription"
				return next(err)
			res.redirect "/user/subscription"

	cancelV1Subscription: (req, res, next) ->
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log {user_id}, "canceling v1 subscription"
		V1SubscriptionManager.cancelV1Subscription user_id, (err)->
			if err?
				logger.err err:err, user_id:user_id, "something went wrong canceling v1 subscription"
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
		LimitationsManager.userHasV2Subscription user, (err, hasSubscription, subscription)->
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
		LimitationsManager.userHasV2Subscription user, (err, hasSubscription, subscription)->
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

	refreshUserFeatures: (req, res, next) ->
		{user_id} = req.params
		FeaturesUpdater.refreshFeatures user_id, (error) ->
			return next(error) if error?
			res.sendStatus 200
