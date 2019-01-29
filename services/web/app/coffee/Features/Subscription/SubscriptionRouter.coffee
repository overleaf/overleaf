AuthenticationController = require('../Authentication/AuthenticationController')
SubscriptionController = require('./SubscriptionController')
SubscriptionGroupController = require './SubscriptionGroupController'
TeamInvitesController = require './TeamInvitesController'
RateLimiterMiddlewear = require('../Security/RateLimiterMiddlewear')
Settings = require "settings-sharelatex"

module.exports =
	apply: (webRouter, privateApiRouter, publicApiRouter) ->
		return unless Settings.enableSubscriptions

		webRouter.get  '/user/subscription/plans', SubscriptionController.plansPage

		webRouter.get  '/user/subscription',            AuthenticationController.requireLogin(), SubscriptionController.userSubscriptionPage

		webRouter.get  '/user/subscription/new',        AuthenticationController.requireLogin(), SubscriptionController.paymentPage

		webRouter.get  '/user/subscription/thank-you', AuthenticationController.requireLogin(), SubscriptionController.successful_subscription


		webRouter.get '/subscription/group', AuthenticationController.requireLogin(), SubscriptionGroupController.redirectToSubscriptionGroupAdminPage
		webRouter.delete '/subscription/group/user', AuthenticationController.requireLogin(), SubscriptionGroupController.removeSelfFromGroup

		# Team invites
		webRouter.get '/subscription/invites/:token/',  AuthenticationController.requireLogin(),
			TeamInvitesController.viewInvite
		webRouter.put '/subscription/invites/:token/',
			AuthenticationController.requireLogin(),
			RateLimiterMiddlewear.rateLimit({
				endpointName: 'team-invite',
				maxRequests: 10
				timeInterval: 60
			}),
			TeamInvitesController.acceptInvite

		#recurly callback
		publicApiRouter.post '/user/subscription/callback',   SubscriptionController.recurlyNotificationParser, SubscriptionController.recurlyCallback

		#user changes their account state
		webRouter.post '/user/subscription/create',     AuthenticationController.requireLogin(), SubscriptionController.createSubscription
		webRouter.post '/user/subscription/update',     AuthenticationController.requireLogin(), SubscriptionController.updateSubscription
		webRouter.post '/user/subscription/cancel',     AuthenticationController.requireLogin(), SubscriptionController.cancelSubscription
		webRouter.post '/user/subscription/reactivate', AuthenticationController.requireLogin(), SubscriptionController.reactivateSubscription

		webRouter.post '/user/subscription/v1/cancel', AuthenticationController.requireLogin(), SubscriptionController.cancelV1Subscription

		webRouter.put '/user/subscription/extend', AuthenticationController.requireLogin(), SubscriptionController.extendTrial

		webRouter.get "/user/subscription/upgrade-annual",  AuthenticationController.requireLogin(), SubscriptionController.renderUpgradeToAnnualPlanPage
		webRouter.post "/user/subscription/upgrade-annual",  AuthenticationController.requireLogin(), SubscriptionController.processUpgradeToAnnualPlan

		# Currently used in acceptance tests only, as a way to trigger the syncing logic
		publicApiRouter.post "/user/:user_id/features/sync", AuthenticationController.httpAuth, SubscriptionController.refreshUserFeatures
