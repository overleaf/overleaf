UserMembershipAuthorization = require './UserMembershipAuthorization'
UserMembershipController = require './UserMembershipController'
SubscriptionGroupController = require '../Subscription/SubscriptionGroupController'
TeamInvitesController = require '../Subscription/TeamInvitesController'
AuthorizationMiddlewear = require('../Authorization/AuthorizationMiddlewear')
RateLimiterMiddlewear = require('../Security/RateLimiterMiddlewear')

module.exports =
	apply: (webRouter) ->
		# group members routes
		webRouter.get '/manage/groups/:id/members',
			UserMembershipAuthorization.requireGroupManagementAccess,
			UserMembershipController.index
		webRouter.post '/manage/groups/:id/invites',
			UserMembershipAuthorization.requireGroupManagementAccess,
			RateLimiterMiddlewear.rateLimit({
				endpointName: "create-team-invite"
				maxRequests: 100
				timeInterval: 60
			}),
			TeamInvitesController.createInvite
		webRouter.delete '/manage/groups/:id/user/:user_id',
			UserMembershipAuthorization.requireGroupManagementAccess,
			SubscriptionGroupController.removeUserFromGroup
		webRouter.delete '/manage/groups/:id/invites/:email',
			UserMembershipAuthorization.requireGroupManagementAccess,
			TeamInvitesController.revokeInvite
		webRouter.get '/manage/groups/:id/members/export',
			UserMembershipAuthorization.requireGroupManagementAccess,
			RateLimiterMiddlewear.rateLimit({
				endpointName: "export-team-csv"
				maxRequests: 30
				timeInterval: 60
			}),
			UserMembershipController.exportCsv

		# group managers routes
		webRouter.get "/manage/groups/:id/managers",
			UserMembershipAuthorization.requireGroupManagersManagementAccess,
			UserMembershipController.index
		webRouter.post "/manage/groups/:id/managers",
			UserMembershipAuthorization.requireGroupManagersManagementAccess,
			UserMembershipController.add
		webRouter.delete "/manage/groups/:id/managers/:userId",
			UserMembershipAuthorization.requireGroupManagersManagementAccess,
			UserMembershipController.remove

		# institution members routes
		webRouter.get "/manage/institutions/:id/managers",
			UserMembershipAuthorization.requireInstitutionManagementAccess,
			UserMembershipController.index
		webRouter.post "/manage/institutions/:id/managers",
			UserMembershipAuthorization.requireInstitutionManagementAccess,
			UserMembershipController.add
		webRouter.delete "/manage/institutions/:id/managers/:userId",
			UserMembershipAuthorization.requireInstitutionManagementAccess,
			UserMembershipController.remove

		# publisher members routes
		webRouter.get "/manage/publishers/:id/managers",
			UserMembershipAuthorization.requirePublisherManagementAccess,
			UserMembershipController.index
		webRouter.post "/manage/publishers/:id/managers",
			UserMembershipAuthorization.requirePublisherManagementAccess,
			UserMembershipController.add
		webRouter.delete "/manage/publishers/:id/managers/:userId",
			UserMembershipAuthorization.requirePublisherManagementAccess,
			UserMembershipController.remove

		# create new entitites
		webRouter.get "/entities/:name/create/:id",
			AuthorizationMiddlewear.ensureUserIsSiteAdmin,
			UserMembershipController.new
		webRouter.post "/entities/:name/create/:id",
			AuthorizationMiddlewear.ensureUserIsSiteAdmin,
			UserMembershipController.create
