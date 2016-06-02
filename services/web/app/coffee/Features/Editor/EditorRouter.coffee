EditorHttpController = require('./EditorHttpController')
AuthenticationController = require "../Authentication/AuthenticationController"
AuthorizationMiddlewear = require('../Authorization/AuthorizationMiddlewear')

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post   '/project/:Project_id/doc', AuthorizationMiddlewear.ensureUserCanWriteProjectContent, EditorHttpController.addDoc
		webRouter.post   '/project/:Project_id/folder', AuthorizationMiddlewear.ensureUserCanWriteProjectContent, EditorHttpController.addFolder

		webRouter.post   '/project/:Project_id/:entity_type/:entity_id/rename', AuthorizationMiddlewear.ensureUserCanWriteProjectContent, EditorHttpController.renameEntity
		webRouter.post   '/project/:Project_id/:entity_type/:entity_id/move', AuthorizationMiddlewear.ensureUserCanWriteProjectContent, EditorHttpController.moveEntity

		webRouter.delete '/project/:Project_id/file/:entity_id', AuthorizationMiddlewear.ensureUserCanWriteProjectContent, EditorHttpController.deleteFile
		webRouter.delete '/project/:Project_id/doc/:entity_id', AuthorizationMiddlewear.ensureUserCanWriteProjectContent, EditorHttpController.deleteDoc
		webRouter.delete '/project/:Project_id/folder/:entity_id', AuthorizationMiddlewear.ensureUserCanWriteProjectContent, EditorHttpController.deleteFolder

		webRouter.post   '/project/:Project_id/doc/:doc_id/restore', AuthorizationMiddlewear.ensureUserCanWriteProjectContent, EditorHttpController.restoreDoc

		# Called by the real-time API to load up the current project state.
		# This is a post request because it's more than just a getting of data. We take actions
		# whenever a user joins a project, like updating the deleted status.
		apiRouter.post '/project/:Project_id/join', AuthenticationController.httpAuth, EditorHttpController.joinProject
