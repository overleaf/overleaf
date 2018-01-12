logger = require('logger-sharelatex')
Metrics = require('metrics-sharelatex')
sanitize = require('sanitizer')
ProjectEntityHandler = require('../Project/ProjectEntityHandler')
ProjectOptionsHandler = require('../Project/ProjectOptionsHandler')
ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
ProjectDeleter = require("../Project/ProjectDeleter")
DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
EditorRealTimeController = require("./EditorRealTimeController")
async = require('async')
LockManager = require("../../infrastructure/LockManager")
PublicAccessLevels = require("../Authorization/PublicAccessLevels")
_ = require('underscore')

module.exports = EditorController =
	setDoc: (project_id, doc_id, user_id, docLines, source, callback = (err)->)->
		DocumentUpdaterHandler.setDocument project_id, doc_id, user_id, docLines, source, (err)=>
			logger.log project_id:project_id, doc_id:doc_id, "notifying users that the document has been updated"
			DocumentUpdaterHandler.flushDocToMongo project_id, doc_id, callback


	addDoc: (project_id, folder_id, docName, docLines, source, user_id, callback = (error, doc)->)->
		LockManager.runWithLock project_id,
			(cb) -> EditorController.addDocWithoutLock project_id, folder_id, docName, docLines, source, user_id, cb
			(err, doc) ->
				if err?
					logger.err err:err, project_id:project_id, source:source,  "could add doc"
					return callback err
				callback null, doc

	addDocWithoutLock: (project_id, folder_id, docName, docLines, source, user_id, callback = (error, doc)->)->
		docName = docName.trim()
		logger.log {project_id, folder_id, docName, source}, "sending new doc to project"
		Metrics.inc "editor.add-doc"
		ProjectEntityHandler.addDoc project_id, folder_id, docName, docLines, user_id, (err, doc, folder_id)=>
			if err?
				logger.err err:err, project_id:project_id, docName:docName, "error adding doc without lock"
				return callback(err)
			EditorRealTimeController.emitToRoom(project_id, 'reciveNewDoc', folder_id, doc, source)
			callback(err, doc)

	addFile: (project_id, folder_id, fileName, path, source, user_id, callback = (error, file)->)->
		LockManager.runWithLock project_id,
			(cb) -> EditorController.addFileWithoutLock project_id, folder_id, fileName, path, source, user_id, cb
			(err, file) ->
				if err?
					logger.err err:err, project_id:project_id, source:source,  "could add file"
					return callback(err)
				callback null, file

	addFileWithoutLock: (project_id, folder_id, fileName, path, source, user_id, callback = (error, file)->)->
		fileName = fileName.trim()
		logger.log {project_id, folder_id, fileName, path}, "sending new file to project"
		Metrics.inc "editor.add-file"
		ProjectEntityHandler.addFile project_id, folder_id, fileName, path, user_id, (err, fileRef, folder_id)=>
			if err?
				logger.err err:err, project_id:project_id, folder_id:folder_id, fileName:fileName, "error adding file without lock"
				return callback(err)
			EditorRealTimeController.emitToRoom(project_id, 'reciveNewFile', folder_id, fileRef, source)
			callback(err, fileRef)

	replaceFileWithoutLock: (project_id, file_id, fsPath, source, user_id, callback = (error) ->)->
		ProjectEntityHandler.replaceFile project_id, file_id, fsPath, user_id, callback

	addFolder : (project_id, folder_id, folderName, source, callback = (error, folder)->)->
		LockManager.runWithLock project_id,
			(cb) -> EditorController.addFolderWithoutLock project_id, folder_id, folderName, source, cb
			(err, folder)->
				if err?
					logger.err err:err, project_id:project_id, source:source,  "could not add folder"
					return callback(err)
				callback null, folder

	addFolderWithoutLock: (project_id, folder_id, folderName, source, callback = (error, folder)->)->
		folderName = folderName.trim()
		logger.log {project_id, folder_id, folderName, source}, "sending new folder to project"
		Metrics.inc "editor.add-folder"
		ProjectEntityHandler.addFolder project_id, folder_id, folderName, (err, folder, folder_id)=>
			if err?
				logger.err err:err, project_id:project_id, folder_id:folder_id, folderName:folderName, "error adding folder without lock"
				return callback(err)
			@p.notifyProjectUsersOfNewFolder project_id, folder_id, folder, (error) ->
				callback error, folder

	mkdirp : (project_id, path, callback = (error, newFolders, lastFolder)->)->
		LockManager.runWithLock project_id,
			(cb) -> EditorController.mkdirpWithoutLock project_id, path, cb
			(err, newFolders, lastFolder) ->
				if err?
					logger.err err:err, project_id:project_id, "could not mkdirp"
					return callback(err)
				callback err, newFolders, lastFolder

	mkdirpWithoutLock: (project_id, path, callback = (error, newFolders, lastFolder)->)->
		logger.log project_id:project_id, path:path, "making directories if they don't exist"
		ProjectEntityHandler.mkdirp project_id, path, (err, newFolders, lastFolder)=>
			if err?
				logger.err err:err, project_id:project_id, path:path, "error mkdirp without lock"
				return callback(err)
			self = @
			jobs = _.map newFolders, (folder, index)->
				return (cb)->
					self.p.notifyProjectUsersOfNewFolder project_id, folder.parentFolder_id, folder, cb
			async.series jobs, (err)->
				callback err, newFolders, lastFolder

	deleteEntity : (project_id, entity_id, entityType, source, userId, callback = (error)->)->
		LockManager.runWithLock project_id,
			(cb) -> EditorController.deleteEntityWithoutLock project_id, entity_id, entityType, source, userId, cb
			(err)->
				if err?
					logger.err err:err, project_id:project_id, "could not delete entity"
				callback(err)

	deleteEntityWithoutLock: (project_id, entity_id, entityType, source, userId, callback)->
		logger.log {project_id, entity_id, entityType, source}, "start delete process of entity"
		Metrics.inc "editor.delete-entity"
		ProjectEntityHandler.deleteEntity project_id, entity_id, entityType, userId, (err)->
			if err?
				logger.err err:err, project_id:project_id, entity_id:entity_id, entityType:entityType, "error deleting entity"
				return callback(err)
			logger.log project_id:project_id, entity_id:entity_id, entityType:entityType, "telling users entity has been deleted"
			EditorRealTimeController.emitToRoom(project_id, 'removeEntity', entity_id, source)
			if callback?
				callback()

	notifyUsersProjectHasBeenDeletedOrRenamed: (project_id, callback)->
		EditorRealTimeController.emitToRoom(project_id, 'projectRenamedOrDeletedByExternalSource')
		callback()

	updateProjectDescription: (project_id, description, callback = ->)->
		logger.log project_id:project_id, description:description, "updating project description"
		ProjectDetailsHandler.setProjectDescription project_id, description, (err)->
			if err?
				logger.err err:err, project_id:project_id, description:description, "something went wrong setting the project description"
				return callback(err)
			EditorRealTimeController.emitToRoom(project_id, 'projectDescriptionUpdated', description)
			callback()

	deleteProject: (project_id, callback)->
		Metrics.inc "editor.delete-project"
		logger.log project_id:project_id, "recived message to delete project"
		ProjectDeleter.deleteProject project_id, callback

	renameEntity: (project_id, entity_id, entityType, newName, userId, callback = (error) ->)->
		newName = sanitize.escape(newName)
		Metrics.inc "editor.rename-entity"
		logger.log entity_id:entity_id, entity_id:entity_id, entity_id:entity_id, "reciving new name for entity for project"
		LockManager.runWithLock project_id,
			(cb) -> ProjectEntityHandler.renameEntity project_id, entity_id, entityType, newName, userId, cb
			(err) ->
				if err?
					logger.err err:err, project_id:project_id, entity_id:entity_id, entityType:entityType, newName:newName, "error renaming entity"
					return callback(err)
				if newName.length > 0
					EditorRealTimeController.emitToRoom project_id, 'reciveEntityRename', entity_id, newName
				callback()

	moveEntity: (project_id, entity_id, folder_id, entityType, userId, callback = (error) ->)->
		Metrics.inc "editor.move-entity"
		LockManager.runWithLock project_id,
			(cb) -> ProjectEntityHandler.moveEntity project_id, entity_id, folder_id, entityType, userId, cb
			(err) ->
				if err?
					logger.err err:err, project_id:project_id, entity_id:entity_id, folder_id:folder_id, "error moving entity"
					return callback(err)
				EditorRealTimeController.emitToRoom project_id, 'reciveEntityMove', entity_id, folder_id
				callback()

	renameProject: (project_id, newName, callback = (err) ->) ->
		ProjectDetailsHandler.renameProject project_id, newName, (err) ->
			if err?
				logger.err err:err, project_id:project_id, newName:newName, "error renaming project"
				return callback(err)
			EditorRealTimeController.emitToRoom project_id, 'projectNameUpdated', newName
			callback()

	setCompiler : (project_id, compiler, callback = (err) ->) ->
		ProjectOptionsHandler.setCompiler project_id, compiler, (err) ->
			return callback(err) if err?
			logger.log compiler:compiler, project_id:project_id, "setting compiler"
			EditorRealTimeController.emitToRoom project_id, 'compilerUpdated', compiler
			callback()

	setSpellCheckLanguage : (project_id, languageCode, callback = (err) ->) ->
		ProjectOptionsHandler.setSpellCheckLanguage project_id, languageCode, (err) ->
			return callback(err) if err?
			logger.log languageCode:languageCode, project_id:project_id, "setting languageCode for spell check"
			EditorRealTimeController.emitToRoom project_id, 'spellCheckLanguageUpdated', languageCode
			callback()

	setPublicAccessLevel : (project_id, newAccessLevel, callback = (err) ->) ->
		ProjectDetailsHandler.setPublicAccessLevel project_id, newAccessLevel, (err) ->
			return callback(err) if err?
			EditorRealTimeController.emitToRoom(
				project_id,
				'project:publicAccessLevel:changed',
				{newAccessLevel}
			)
			if newAccessLevel == PublicAccessLevels.TOKEN_BASED
				ProjectDetailsHandler.ensureTokensArePresent project_id, (err, tokens) ->
					return callback(err) if err?
					EditorRealTimeController.emitToRoom(
						project_id,
						'project:tokens:changed',
						{tokens}
					)
					callback()
			else
				callback()

	setRootDoc: (project_id, newRootDocID, callback = (err) ->) ->
		ProjectEntityHandler.setRootDoc project_id, newRootDocID, (err) ->
			return callback(err) if err?
			EditorRealTimeController.emitToRoom project_id, 'rootDocUpdated', newRootDocID
			callback()

	p:
		notifyProjectUsersOfNewFolder: (project_id, folder_id, folder, callback = (error)->)->
			logger.log project_id:project_id, folder:folder, parentFolder_id:folder_id, "sending newly created folder out to users"
			EditorRealTimeController.emitToRoom(project_id, "reciveNewFolder", folder_id, folder)
			callback()
