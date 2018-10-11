AuthenticationController = require('../Authentication/AuthenticationController')
UserMembershipController = require './UserMembershipController'

module.exports =
	apply: (webRouter) ->
		webRouter.get '/manage/group/members',
			AuthenticationController.requireLogin(),
			(req, res, next) -> UserMembershipController.index('group', req, res, next)


		regularEntitites =
			group: 'groupManagers'
			institution: 'institution'
		for pathName, entityName of regularEntitites
			do (pathName, entityName) ->
				webRouter.get "/manage/#{pathName}/managers",
					AuthenticationController.requireLogin(),
					(req, res, next) -> UserMembershipController.index(entityName, req, res, next)

				webRouter.post "/manage/#{pathName}/managers",
					AuthenticationController.requireLogin(),
					(req, res, next) -> UserMembershipController.add(entityName, req, res, next)

				webRouter.delete "/manage/#{pathName}/managers/:userId",
					AuthenticationController.requireLogin(),
					(req, res, next) -> UserMembershipController.remove(entityName, req, res, next)
