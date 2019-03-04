EditorHttpController = require('./EditorHttpController')
AuthenticationController = require "../Authentication/AuthenticationController"
AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware')
RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post   '/project/:Project_id/doc', AuthorizationMiddleware.ensureUserCanWriteProjectContent,
			RateLimiterMiddleware.rateLimit({
				endpointName: "add-doc-to-project"
				params: ["Project_id"]
				maxRequests: 30
				timeInterval: 60
			}), EditorHttpController.addDoc
		webRouter.post   '/project/:Project_id/folder', AuthorizationMiddleware.ensureUserCanWriteProjectContent,
			RateLimiterMiddleware.rateLimit({
				endpointName: "add-folder-to-project"
				params: ["Project_id"]
				maxRequests: 60
				timeInterval: 60
			}), EditorHttpController.addFolder

		webRouter.post   '/project/:Project_id/:entity_type/:entity_id/rename', AuthorizationMiddleware.ensureUserCanWriteProjectContent, EditorHttpController.renameEntity
		webRouter.post   '/project/:Project_id/:entity_type/:entity_id/move', AuthorizationMiddleware.ensureUserCanWriteProjectContent, EditorHttpController.moveEntity

		webRouter.delete '/project/:Project_id/file/:entity_id', AuthorizationMiddleware.ensureUserCanWriteProjectContent, EditorHttpController.deleteFile
		webRouter.delete '/project/:Project_id/doc/:entity_id', AuthorizationMiddleware.ensureUserCanWriteProjectContent, EditorHttpController.deleteDoc
		webRouter.delete '/project/:Project_id/folder/:entity_id', AuthorizationMiddleware.ensureUserCanWriteProjectContent, EditorHttpController.deleteFolder

		# Called by the real-time API to load up the current project state.
		# This is a post request because it's more than just a getting of data. We take actions
		# whenever a user joins a project, like updating the deleted status.
		apiRouter.post '/project/:Project_id/join', AuthenticationController.httpAuth, EditorHttpController.joinProject
