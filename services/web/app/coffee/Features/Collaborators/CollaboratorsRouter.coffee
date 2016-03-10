CollaboratorsController = require('./CollaboratorsController')
AuthenticationController = require('../Authentication/AuthenticationController')
AuthorizationMiddlewear = require('../Authorization/AuthorizationMiddlewear')

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post '/project/:Project_id/leave', AuthenticationController.requireLogin(), CollaboratorsController.removeSelfFromProject

		webRouter.post   '/project/:Project_id/users', AuthorizationMiddlewear.ensureUserCanAdminProject, CollaboratorsController.addUserToProject
		webRouter.delete '/project/:Project_id/users/:user_id', AuthorizationMiddlewear.ensureUserCanAdminProject, CollaboratorsController.removeUserFromProject
