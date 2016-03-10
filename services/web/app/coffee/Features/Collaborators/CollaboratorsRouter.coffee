CollaboratorsController = require('./CollaboratorsController')
SecurityManager = require('../../managers/SecurityManager')
AuthenticationController = require('../Authentication/AuthenticationController')

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post '/project/:Project_id/leave', AuthenticationController.requireLogin(), CollaboratorsController.removeSelfFromProject

		webRouter.post   '/project/:Project_id/users', SecurityManager.requestIsOwner, CollaboratorsController.addUserToProject
		webRouter.delete '/project/:Project_id/users/:user_id', SecurityManager.requestIsOwner, CollaboratorsController.removeUserFromProject
