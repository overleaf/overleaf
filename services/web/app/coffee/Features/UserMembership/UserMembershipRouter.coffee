UserMembershipAuthorization = require './UserMembershipAuthorization'
UserMembershipController = require './UserMembershipController'

module.exports =
	apply: (webRouter) ->
		webRouter.get '/manage/groups/:id/members',
			UserMembershipAuthorization.requireEntityAccess('group'),
			UserMembershipController.index


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
