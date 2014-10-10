AuthenticationController = require('../Authentication/AuthenticationController')
SubscriptionController = require('./SubscriptionController')
SubscriptionGroupController = require './SubscriptionGroupController'
Settings = require "settings-sharelatex"

module.exports =
	apply: (app) ->
		return unless Settings.enableSubscriptions

		app.get  '/user/subscription/plans',      SubscriptionController.plansPage

		app.get  '/user/subscription',            AuthenticationController.requireLogin(), SubscriptionController.userSubscriptionPage

		app.get  '/user/subscription/custom_account', AuthenticationController.requireLogin(), SubscriptionController.userCustomSubscriptionPage

		
		app.get  '/user/subscription/new',        AuthenticationController.requireLogin(), SubscriptionController.paymentPage 
		app.get  '/user/subscription/billing-details/edit', AuthenticationController.requireLogin(), SubscriptionController.editBillingDetailsPage

		app.get  '/user/subscription/thank-you', AuthenticationController.requireLogin(), SubscriptionController.successful_subscription


		app.get '/subscription/group',  AuthenticationController.requireLogin(), SubscriptionGroupController.renderSubscriptionGroupAdminPage
		app.post '/subscription/group/user', AuthenticationController.requireLogin(),  SubscriptionGroupController.addUserToGroup
		app.del '/subscription/group/user/:user_id', AuthenticationController.requireLogin(), SubscriptionGroupController.removeUserFromGroup


		#recurly callback
		app.post '/user/subscription/callback',   SubscriptionController.recurlyNotificationParser, SubscriptionController.recurlyCallback
		app.ignoreCsrf("post", '/user/subscription/callback')

		#user changes their account state
		app.post '/user/subscription/create',     AuthenticationController.requireLogin(), SubscriptionController.createSubscription
		app.post '/user/subscription/update',     AuthenticationController.requireLogin(), SubscriptionController.updateSubscription
		app.post '/user/subscription/cancel',     AuthenticationController.requireLogin(), SubscriptionController.cancelSubscription
		app.post '/user/subscription/reactivate', AuthenticationController.requireLogin(), SubscriptionController.reactivateSubscription


		app.get "/user/subscription/upgrade-annual",  AuthenticationController.requireLogin(), SubscriptionController.renderUpgradeToAnnualPlanPage
		app.post "/user/subscription/upgrade-annual",  AuthenticationController.requireLogin(), SubscriptionController.processUpgradeToAnnualPlan


