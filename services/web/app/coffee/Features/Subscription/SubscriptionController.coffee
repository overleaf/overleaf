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
			for plan in plans
				plan.href = "/register?redir=#{plan.href}"
		viewName = "subscriptions/plans"
		if req.query.variant?
			viewName += "-#{req.query.variant}"
		logger.log viewName:viewName, "showing plans page"
		res.render viewName,
			title: "Plans and Pricing"
			plans: plans
			gaExperimentCode: gaExperimentCode


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
							title      : "Subscribe"
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
							title: "Your Subscription"
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
							title      : "Update Billing Details"
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
					title: "Thank you!"
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


gaExperimentCode = '''
<!-- Google Analytics Content Experiment code -->
<script>function utmx_section(){}function utmx(){}(function(){var
k='51652689-2',d=document,l=d.location,c=d.cookie;
if(l.search.indexOf('utm_expid='+k)>0)return;
function f(n){if(c){var i=c.indexOf(n+'=');if(i>-1){var j=c.
indexOf(';',i);return escape(c.substring(i+n.length+1,j<0?c.
length:j))}}}var x=f('__utmx'),xx=f('__utmxx'),h=l.hash;d.write(
'<sc'+'ript src="'+'http'+(l.protocol=='https:'?'s://ssl':
'://www')+'.google-analytics.com/ga_exp.js?'+'utmxkey='+k+
'&utmx='+(x?x:'')+'&utmxx='+(xx?xx:'')+'&utmxtime='+new Date().
valueOf()+(h?'&utmxhash='+escape(h.substr(1)):'')+
'" type="text/javascript" charset="utf-8"><\/sc'+'ript>')})();
</script><script>utmx('url','A/B');</script>
<!-- End of Google Analytics Content Experiment code -->

'''