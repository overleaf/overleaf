UserMembershipAuthorization = require './UserMembershipAuthorization'
UserMembershipController = require './UserMembershipController'
SubscriptionGroupController = require '../Subscription/SubscriptionGroupController'
TeamInvitesController = require '../Subscription/TeamInvitesController'

module.exports =
	apply: (webRouter) ->
		webRouter.get '/manage/groups/:id/members',
			UserMembershipAuthorization.requireEntityAccess('group'),
			UserMembershipController.index
		webRouter.post '/manage/groups/:id/invites',
			UserMembershipAuthorization.requireEntityAccess('group'),
			TeamInvitesController.createInvite
		webRouter.delete '/manage/groups/:id/user/:user_id',
			UserMembershipAuthorization.requireEntityAccess('group'),
			SubscriptionGroupController.removeUserFromGroup
		webRouter.delete '/manage/groups/:id/invites/:email',
			UserMembershipAuthorization.requireEntityAccess('group'),
			TeamInvitesController.revokeInvite
		webRouter.get '/manage/groups/:id/members/export',
			UserMembershipAuthorization.requireEntityAccess('group'),
			UserMembershipController.exportCsv


		regularEntitites =
			groups: 'groupManagers'
			institutions: 'institution'
		for pathName, entityName of regularEntitites
			do (pathName, entityName) ->
				webRouter.get "/manage/#{pathName}/:id/managers",
					UserMembershipAuthorization.requireEntityAccess(entityName),
					UserMembershipController.index

				webRouter.post "/manage/#{pathName}/:id/managers",
					UserMembershipAuthorization.requireEntityAccess(entityName),
					UserMembershipController.add

				webRouter.delete "/manage/#{pathName}/:id/managers/:userId",
					UserMembershipAuthorization.requireEntityAccess(entityName),
					UserMembershipController.remove
