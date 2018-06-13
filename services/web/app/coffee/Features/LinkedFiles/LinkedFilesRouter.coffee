AuthorizationMiddlewear = require('../Authorization/AuthorizationMiddlewear')
AuthenticationController = require('../Authentication/AuthenticationController')
LinkedFilesController = require "./LinkedFilesController"

module.exports =
	apply: (webRouter) ->
		webRouter.post '/project/:project_id/linked_file',
			AuthenticationController.requireLogin(),
			AuthorizationMiddlewear.ensureUserCanWriteProjectContent,
			LinkedFilesController.createLinkedFile

		webRouter.post '/project/:project_id/linked_file/:file_id/refresh',
			AuthenticationController.requireLogin(),
			AuthorizationMiddlewear.ensureUserCanWriteProjectContent,
			LinkedFilesController.refreshLinkedFile
