AuthorizationMiddlewear = require('../Authorization/AuthorizationMiddlewear')
AuthenticationController = require('../Authentication/AuthenticationController')
LinkedFilesController = require "./LinkedFilesController"

module.exports =
	apply: (webRouter) ->
		webRouter.post '/project/:project_id/linked_file',
			AuthenticationController.requireLogin(),
			AuthorizationMiddlewear.ensureUserCanWriteProjectContent,
			LinkedFilesController.createLinkedFile

