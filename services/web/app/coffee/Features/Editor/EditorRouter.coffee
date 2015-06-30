EditorHttpController = require('./EditorHttpController')
SecurityManager = require('../../managers/SecurityManager')
AuthenticationController = require "../Authentication/AuthenticationController"

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post   '/project/:Project_id/doc', SecurityManager.requestCanModifyProject, EditorHttpController.addDoc
		webRouter.post   '/project/:Project_id/folder', SecurityManager.requestCanModifyProject, EditorHttpController.addFolder

		webRouter.post   '/project/:Project_id/:entity_type/:entity_id/rename', SecurityManager.requestCanModifyProject, EditorHttpController.renameEntity
		webRouter.post   '/project/:Project_id/:entity_type/:entity_id/move', SecurityManager.requestCanModifyProject, EditorHttpController.moveEntity

		webRouter.delete '/project/:Project_id/file/:entity_id', SecurityManager.requestCanModifyProject, EditorHttpController.deleteFile
		webRouter.delete '/project/:Project_id/doc/:entity_id', SecurityManager.requestCanModifyProject, EditorHttpController.deleteDoc
		webRouter.delete '/project/:Project_id/folder/:entity_id', SecurityManager.requestCanModifyProject, EditorHttpController.deleteFolder

		webRouter.post   '/project/:Project_id/doc/:doc_id/restore', SecurityManager.requestCanModifyProject, EditorHttpController.restoreDoc

		# Called by the real-time API to load up the current project state.
		# This is a post request because it's more than just a getting of data. We take actions
		# whenever a user joins a project, like updating the deleted status.
		apiRouter.post '/project/:Project_id/join', AuthenticationController.httpAuth, EditorHttpController.joinProject
