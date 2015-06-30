AuthenticationController = require('../Authentication/AuthenticationController')
SubscriptionController = require('./SubscriptionController')
SubscriptionGroupController = require './SubscriptionGroupController'
Settings = require "settings-sharelatex"

module.exports =
	apply: (webRouter, apiRouter) ->
		return unless Settings.enableSubscriptions

		webRouter.get  '/user/subscription/plans',      SubscriptionController.plansPage

		webRouter.get  '/user/subscription',            AuthenticationController.requireLogin(), SubscriptionController.userSubscriptionPage

		webRouter.get  '/user/subscription/custom_account', AuthenticationController.requireLogin(), SubscriptionController.userCustomSubscriptionPage

		
		webRouter.get  '/user/subscription/new',        AuthenticationController.requireLogin(), SubscriptionController.paymentPage 
		webRouter.get  '/user/subscription/billing-details/edit', AuthenticationController.requireLogin(), SubscriptionController.editBillingDetailsPage

		webRouter.get  '/user/subscription/thank-you', AuthenticationController.requireLogin(), SubscriptionController.successful_subscription


		webRouter.get '/subscription/group',  AuthenticationController.requireLogin(), SubscriptionGroupController.renderSubscriptionGroupAdminPage
		webRouter.post '/subscription/group/user', AuthenticationController.requireLogin(),  SubscriptionGroupController.addUserToGroup
		webRouter.get '/subscription/group/export',  AuthenticationController.requireLogin(), SubscriptionGroupController.exportGroupCsv
		webRouter.delete '/subscription/group/user/:user_id', AuthenticationController.requireLogin(), SubscriptionGroupController.removeUserFromGroup

		webRouter.get '/user/subscription/:subscription_id/group/invited', AuthenticationController.requireLogin(), SubscriptionGroupController.renderGroupInvitePage
		webRouter.post '/user/subscription/:subscription_id/group/begin-join', AuthenticationController.requireLogin(), SubscriptionGroupController.beginJoinGroup
		webRouter.get '/user/subscription/:subscription_id/group/complete-join', AuthenticationController.requireLogin(), SubscriptionGroupController.completeJoin
		webRouter.get '/user/subscription/:subscription_id/group/successful-join', AuthenticationController.requireLogin(), SubscriptionGroupController.renderSuccessfulJoinPage

		#recurly callback
		apiRouter.post '/user/subscription/callback',   SubscriptionController.recurlyNotificationParser, SubscriptionController.recurlyCallback

		#user changes their account state
		webRouter.post '/user/subscription/create',     AuthenticationController.requireLogin(), SubscriptionController.createSubscription
		webRouter.post '/user/subscription/update',     AuthenticationController.requireLogin(), SubscriptionController.updateSubscription
		webRouter.post '/user/subscription/cancel',     AuthenticationController.requireLogin(), SubscriptionController.cancelSubscription
		webRouter.post '/user/subscription/reactivate', AuthenticationController.requireLogin(), SubscriptionController.reactivateSubscription


		webRouter.get "/user/subscription/upgrade-annual",  AuthenticationController.requireLogin(), SubscriptionController.renderUpgradeToAnnualPlanPage
		webRouter.post "/user/subscription/upgrade-annual",  AuthenticationController.requireLogin(), SubscriptionController.processUpgradeToAnnualPlan


