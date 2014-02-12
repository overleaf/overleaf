SecurityManager = require('../../managers/SecurityManager')
AuthenticationController = require('../Authentication/AuthenticationController')
ProjectUploadController = require "./ProjectUploadController"

module.exports =
	apply: (app) ->
		app.post '/project/new/upload',
			AuthenticationController.requireLogin(),
			ProjectUploadController.uploadProject
		app.post '/Project/:Project_id/upload',
			SecurityManager.requestCanModifyProject,
			ProjectUploadController.uploadFile

