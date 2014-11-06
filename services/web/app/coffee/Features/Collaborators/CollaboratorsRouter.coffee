CollaboratorsController = require('./CollaboratorsController')
SecurityManager = require('../../managers/SecurityManager')
AuthenticationController = require('../Authentication/AuthenticationController')

module.exports =
	apply: (app) ->
		app.post '/project/:project_id/leave', AuthenticationController.requireLogin(), CollaboratorsController.removeSelfFromProject
		app.get  '/project/:Project_id/collaborators', SecurityManager.requestCanAccessProject(allow_auth_token: true), CollaboratorsController.getCollaborators

		app.post   '/project/:Project_id/users', SecurityManager.requestIsOwner, CollaboratorsController.addUserToProject
		app.delete '/project/:Project_id/users/:user_id', SecurityManager.requestIsOwner, CollaboratorsController.removeUserFromProject
