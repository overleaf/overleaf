UserMembershipAuthorization = require './UserMembershipAuthorization'
UserMembershipController = require './UserMembershipController'
SubscriptionGroupController = require '../Subscription/SubscriptionGroupController'
TeamInvitesController = require '../Subscription/TeamInvitesController'
AuthorizationMiddlewear = require('../Authorization/AuthorizationMiddlewear')

module.exports =
	apply: (webRouter) ->
		# group members routes
		webRouter.get '/manage/groups/:id/members',
			UserMembershipAuthorization.requireGroupAccess,
			UserMembershipController.index
		webRouter.post '/manage/groups/:id/invites',
			UserMembershipAuthorization.requireGroupAccess,
			TeamInvitesController.createInvite
		webRouter.delete '/manage/groups/:id/user/:user_id',
			UserMembershipAuthorization.requireGroupAccess,
			SubscriptionGroupController.removeUserFromGroup
		webRouter.delete '/manage/groups/:id/invites/:email',
			UserMembershipAuthorization.requireGroupAccess,
			TeamInvitesController.revokeInvite
		webRouter.get '/manage/groups/:id/members/export',
			UserMembershipAuthorization.requireGroupAccess,
			UserMembershipController.exportCsv

		# group managers routes
		webRouter.get "/manage/groups/:id/managers",
			UserMembershipAuthorization.requireGroupManagersAccess,
			UserMembershipController.index
		webRouter.post "/manage/groups/:id/managers",
			UserMembershipAuthorization.requireGroupManagersAccess,
			UserMembershipController.add
		webRouter.delete "/manage/groups/:id/managers/:userId",
			UserMembershipAuthorization.requireGroupManagersAccess,
			UserMembershipController.remove

		# institution members routes
		webRouter.get "/manage/institutions/:id/managers",
			UserMembershipAuthorization.requireInstitutionAccess,
			UserMembershipController.index
		webRouter.post "/manage/institutions/:id/managers",
			UserMembershipAuthorization.requireInstitutionAccess,
			UserMembershipController.add
		webRouter.delete "/manage/institutions/:id/managers/:userId",
			UserMembershipAuthorization.requireInstitutionAccess,
			UserMembershipController.remove

		# publisher members routes
		webRouter.get "/manage/publishers/:id/managers",
			UserMembershipAuthorization.requirePublisherAccess,
			UserMembershipController.index
		webRouter.post "/manage/publishers/:id/managers",
			UserMembershipAuthorization.requirePublisherAccess,
			UserMembershipController.add
		webRouter.delete "/manage/publishers/:id/managers/:userId",
			UserMembershipAuthorization.requirePublisherAccess,
			UserMembershipController.remove

		# create new entitites
		webRouter.get "/entities/:name/create/:id",
			AuthorizationMiddlewear.ensureUserIsSiteAdmin,
			UserMembershipController.new
		webRouter.post "/entities/:name/create/:id",
			AuthorizationMiddlewear.ensureUserIsSiteAdmin,
			UserMembershipController.create
