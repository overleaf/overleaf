EditorHttpController = require('./EditorHttpController')
SecurityManager = require('../../managers/SecurityManager')

module.exports =
	apply: (app) ->
		app.post   '/project/:Project_id/doc', SecurityManager.requestCanModifyProject, EditorHttpController.addDoc
		app.post   '/project/:Project_id/folder', SecurityManager.requestCanModifyProject, EditorHttpController.addFolder

		app.post   '/project/:Project_id/:entity_type/:entity_id/rename', SecurityManager.requestCanModifyProject, EditorHttpController.renameEntity
		app.post   '/project/:Project_id/:entity_type/:entity_id/move', SecurityManager.requestCanModifyProject, EditorHttpController.moveEntity

		app.delete '/project/:Project_id/file/:entity_id', SecurityManager.requestCanModifyProject, EditorHttpController.deleteFile
		app.delete '/project/:Project_id/doc/:entity_id', SecurityManager.requestCanModifyProject, EditorHttpController.deleteDoc
		app.delete '/project/:Project_id/folder/:entity_id', SecurityManager.requestCanModifyProject, EditorHttpController.deleteFolder

		app.post   '/project/:Project_id/doc/:doc_id/restore', SecurityManager.requestCanModifyProject, EditorHttpController.restoreDoc

		app.post   '/project/:Project_id/users', SecurityManager.requestIsOwner, EditorHttpController.addUserToProject
		app.delete '/project/:Project_id/users/:user_id', SecurityManager.requestIsOwner, EditorHttpController.removeUserFromProject
