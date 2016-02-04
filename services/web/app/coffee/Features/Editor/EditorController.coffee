logger = require('logger-sharelatex')
Metrics = require('../../infrastructure/Metrics')
sanitize = require('sanitizer')
ProjectEntityHandler = require('../Project/ProjectEntityHandler')
ProjectOptionsHandler = require('../Project/ProjectOptionsHandler')
ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
ProjectDeleter = require("../Project/ProjectDeleter")
DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
EditorRealTimeController = require("./EditorRealTimeController")
TrackChangesManager = require("../TrackChanges/TrackChangesManager")
async = require('async')
LockManager = require("../../infrastructure/LockManager")
_ = require('underscore')

module.exports = EditorController =
	setDoc: (project_id, doc_id, user_id, docLines, source, callback = (err)->)->
		DocumentUpdaterHandler.setDocument project_id, doc_id, user_id, docLines, source, (err)=>
			logger.log project_id:project_id, doc_id:doc_id, "notifying users that the document has been updated"
			DocumentUpdaterHandler.flushDocToMongo project_id, doc_id, callback


	addDoc: (project_id, folder_id, docName, docLines, source, callback = (error, doc)->)->
		LockManager.getLock project_id, (err)->
			if err?
				logger.err err:err, project_id:project_id, source:source,  "could not get lock to addDoc"
				return callback(err)
			EditorController.addDocWithoutLock project_id, folder_id, docName, docLines, source, (error, doc)->
				LockManager.releaseLock project_id, ->
					callback(error, doc)

	addDocWithoutLock: (project_id, folder_id, docName, docLines, source, callback = (error, doc)->)->
		docName = docName.trim()
		logger.log {project_id, folder_id, docName, source}, "sending new doc to project"
		Metrics.inc "editor.add-doc"
		ProjectEntityHandler.addDoc project_id, folder_id, docName, docLines, (err, doc, folder_id)=>
			EditorRealTimeController.emitToRoom(project_id, 'reciveNewDoc', folder_id, doc, source)
			callback(err, doc)


	addFile: (project_id, folder_id, fileName, path, source, callback = (error, file)->)->
		LockManager.getLock project_id, (err)->
			if err?
				logger.err err:err, project_id:project_id, source:source,  "could not get lock to addFile"
				return callback(err)
			EditorController.addFileWithoutLock project_id, folder_id, fileName, path, source, (error, file)->
				LockManager.releaseLock project_id, ->
					callback(error, file)	


	addFileWithoutLock: (project_id, folder_id, fileName, path, source, callback = (error, file)->)->
		fileName = fileName.trim()
		logger.log {project_id, folder_id, fileName, path}, "sending new file to project"
		Metrics.inc "editor.add-file"
		ProjectEntityHandler.addFile project_id, folder_id, fileName, path, (err, fileRef, folder_id)=>
			EditorRealTimeController.emitToRoom(project_id, 'reciveNewFile', folder_id, fileRef, source)
			callback(err, fileRef)

	replaceFile: (project_id, file_id, fsPath, source, callback = (error) ->)->
		ProjectEntityHandler.replaceFile project_id, file_id, fsPath, callback



	addFolder : (project_id, folder_id, folderName, source, callback = (error, folder)->)->
		LockManager.getLock project_id, (err)->
			if err?
				logger.err err:err, project_id:project_id, source:source,  "could not get lock to addFolder"
				return callback(err)
			EditorController.addFolderWithoutLock project_id, folder_id, folderName, source, (error, folder)->
				LockManager.releaseLock project_id, ->
					callback(error, folder)	

	addFolderWithoutLock: (project_id, folder_id, folderName, source, callback = (error, folder)->)->
		folderName = folderName.trim()
		logger.log {project_id, folder_id, folderName, source}, "sending new folder to project"
		Metrics.inc "editor.add-folder"
		ProjectEntityHandler.addFolder project_id, folder_id, folderName, (err, folder, folder_id)=>
			@p.notifyProjectUsersOfNewFolder project_id, folder_id, folder, (error) ->
				callback error, folder


	mkdirp : (project_id, path, callback)->
		LockManager.getLock project_id, (err)->
			if err?
				logger.err err:err, project_id:project_id, "could not get lock to mkdirp"
				return callback(err)
			EditorController.mkdirpWithoutLock project_id, path, (err, newFolders, lastFolder)->
				LockManager.releaseLock project_id, ->
					callback(err, newFolders, lastFolder)	

	mkdirpWithoutLock: (project_id, path, callback)->
		logger.log project_id:project_id, path:path, "making directories if they don't exist"
		ProjectEntityHandler.mkdirp project_id, path, (err, newFolders, lastFolder)=>
			self = @
			jobs = _.map newFolders, (folder, index)->
				return (cb)->
					self.p.notifyProjectUsersOfNewFolder project_id, folder.parentFolder_id, folder, cb
			async.series jobs, (err)->
				callback err, newFolders, lastFolder

	deleteEntity : (project_id, entity_id, entityType, source, callback)->
		LockManager.getLock project_id, (err)->
			if err?
				logger.err err:err, project_id:project_id, "could not get lock to deleteEntity"
				return callback(err)
			EditorController.deleteEntityWithoutLock project_id, entity_id, entityType, source, (err)->
				LockManager.releaseLock project_id, ()->
					callback(err)

	deleteEntityWithoutLock: (project_id, entity_id, entityType, source, callback)->
		logger.log {project_id, entity_id, entityType, source}, "start delete process of entity"
		Metrics.inc "editor.delete-entity"
		ProjectEntityHandler.deleteEntity project_id, entity_id, entityType, =>
			logger.log project_id:project_id, entity_id:entity_id, entityType:entityType, "telling users entity has been deleted"
			EditorRealTimeController.emitToRoom(project_id, 'removeEntity', entity_id, source)
			if callback?
				callback()

	getListOfDocPaths: (project_id, callback)->
		ProjectEntityHandler.getAllDocs project_id, (err, docs)->
			docList = _.map docs, (doc, path)->
				return {_id:doc._id, path:path.substring(1)}
			callback(null, docList)

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

	renameEntity: (project_id, entity_id, entityType, newName, callback)->
		newName = sanitize.escape(newName)
		Metrics.inc "editor.rename-entity"
		logger.log entity_id:entity_id, entity_id:entity_id, entity_id:entity_id, "reciving new name for entity for project"
		ProjectEntityHandler.renameEntity project_id, entity_id, entityType, newName, =>
			if newName.length > 0
				EditorRealTimeController.emitToRoom project_id, 'reciveEntityRename', entity_id, newName
				callback?()
#
	moveEntity: (project_id, entity_id, folder_id, entityType, callback)->
		Metrics.inc "editor.move-entity"
		ProjectEntityHandler.moveEntity project_id, entity_id, folder_id, entityType, =>
			EditorRealTimeController.emitToRoom project_id, 'reciveEntityMove', entity_id, folder_id
			callback?()

	renameProject: (project_id, newName, callback = (err) ->) ->
		ProjectDetailsHandler.renameProject project_id, newName, =>
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
			EditorRealTimeController.emitToRoom project_id, 'publicAccessLevelUpdated', newAccessLevel
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

