SecurityManager = require('../../managers/SecurityManager')
AuthenticationController = require('../Authentication/AuthenticationController')
ProjectUploadController = require "./ProjectUploadController"

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post '/project/new/upload',
			AuthenticationController.requireLogin(),
			ProjectUploadController.uploadProject
		webRouter.post '/Project/:Project_id/upload',
			SecurityManager.requestCanModifyProject,
			ProjectUploadController.uploadFile

