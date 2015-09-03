CollaboratorsController = require('./CollaboratorsController')
SecurityManager = require('../../managers/SecurityManager')
AuthenticationController = require('../Authentication/AuthenticationController')

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post '/project/:project_id/leave', AuthenticationController.requireLogin(), CollaboratorsController.removeSelfFromProject
		apiRouter.get  '/project/:Project_id/collaborators', SecurityManager.requestCanAccessProject(allow_auth_token: true), CollaboratorsController.getCollaborators

		webRouter.post   '/project/:Project_id/users', SecurityManager.requestIsOwner, CollaboratorsController.addUserToProject
		webRouter.delete '/project/:Project_id/users/:user_id', SecurityManager.requestIsOwner, CollaboratorsController.removeUserFromProject
