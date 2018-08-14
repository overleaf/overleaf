logger = require('logger-sharelatex')
Metrics = require('metrics-sharelatex')
sanitize = require('sanitizer')
ProjectEntityUpdateHandler = require('../Project/ProjectEntityUpdateHandler')
ProjectOptionsHandler = require('../Project/ProjectOptionsHandler')
ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
ProjectDeleter = require("../Project/ProjectDeleter")
DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
EditorRealTimeController = require("./EditorRealTimeController")
async = require('async')
PublicAccessLevels = require("../Authorization/PublicAccessLevels")
_ = require('underscore')

module.exports = EditorController =
	addDoc: (project_id, folder_id, docName, docLines, source, user_id, callback = (error, doc)->)->
		docName = docName.trim()
		logger.log {project_id, folder_id, docName, source}, "sending new doc to project"
		Metrics.inc "editor.add-doc"
		ProjectEntityUpdateHandler.addDoc project_id, folder_id, docName, docLines, user_id, (err, doc, folder_id)=>
			if err?
				logger.err err:err, project_id:project_id, docName:docName, "error adding doc without lock"
				return callback(err)
			EditorRealTimeController.emitToRoom(project_id, 'reciveNewDoc', folder_id, doc, source)
			callback(err, doc)

	addFile: (project_id, folder_id, fileName, fsPath, linkedFileData, source, user_id, callback = (error, file)->)->
		fileName = fileName.trim()
		logger.log {project_id, folder_id, fileName, fsPath, linkedFileData, source, user_id}, "sending new file to project"
		Metrics.inc "editor.add-file"
		ProjectEntityUpdateHandler.addFile project_id, folder_id, fileName, fsPath, linkedFileData, user_id, (err, fileRef, folder_id)=>
			if err?
				logger.err err:err, project_id:project_id, folder_id:folder_id, fileName:fileName, "error adding file without lock"
				return callback(err)
			EditorRealTimeController.emitToRoom(project_id, 'reciveNewFile', folder_id, fileRef, source, linkedFileData)
			callback(err, fileRef)

	upsertDoc: (project_id, folder_id, docName, docLines, source, user_id, callback = (err)->)->
		ProjectEntityUpdateHandler.upsertDoc project_id, folder_id, docName, docLines, source, user_id, (err, doc, didAddNewDoc) ->
			if didAddNewDoc
				EditorRealTimeController.emitToRoom(project_id, 'reciveNewDoc', folder_id, doc, source)
			callback err, doc

	upsertFile: (project_id, folder_id, fileName, fsPath, linkedFileData, source, user_id, callback = (err, file) ->) ->
		ProjectEntityUpdateHandler.upsertFile project_id, folder_id, fileName, fsPath, linkedFileData, user_id, (err, newFile, didAddFile, existingFile) ->
			return callback(err) if err?
			if not didAddFile # replacement, so remove the existing file from the client
				EditorRealTimeController.emitToRoom project_id, 'removeEntity', existingFile._id, source
			# now add the new file on the client
			EditorRealTimeController.emitToRoom project_id, 'reciveNewFile', folder_id, newFile, source, linkedFileData
			callback null, newFile

	upsertDocWithPath: (project_id, elementPath, docLines, source, user_id, callback) ->
		ProjectEntityUpdateHandler.upsertDocWithPath project_id, elementPath, docLines, source, user_id, (err, doc, didAddNewDoc, newFolders, lastFolder) ->
			return callback(err) if err?
			EditorController._notifyProjectUsersOfNewFolders project_id, newFolders, (err) ->
				return callback(err) if err?
				if didAddNewDoc
					EditorRealTimeController.emitToRoom project_id, 'reciveNewDoc', lastFolder._id, doc, source
				callback()

	upsertFileWithPath: (project_id, elementPath, fsPath, linkedFileData, source, user_id, callback) ->
		ProjectEntityUpdateHandler.upsertFileWithPath project_id, elementPath, fsPath, linkedFileData, user_id, (err, newFile, didAddFile, existingFile, newFolders, lastFolder) ->
			return callback(err) if err?
			EditorController._notifyProjectUsersOfNewFolders project_id, newFolders, (err) ->
				return callback(err) if err?
				if not didAddFile # replacement, so remove the existing file from the client
					EditorRealTimeController.emitToRoom project_id, 'removeEntity', existingFile._id, source
				# now add the new file on the client
				EditorRealTimeController.emitToRoom project_id, 'reciveNewFile', lastFolder._id, newFile, source, linkedFileData
				callback()

	addFolder : (project_id, folder_id, folderName, source, callback = (error, folder)->)->
		folderName = folderName.trim()
		logger.log {project_id, folder_id, folderName, source}, "sending new folder to project"
		Metrics.inc "editor.add-folder"
		ProjectEntityUpdateHandler.addFolder project_id, folder_id, folderName, (err, folder, folder_id)=>
			if err?
				logger.err {err, project_id, folder_id, folderName, source}, "could not add folder"
				return callback(err)
			EditorController._notifyProjectUsersOfNewFolder project_id, folder_id, folder, (err) ->
				return callback(err) if err?
				callback null, folder

	mkdirp : (project_id, path, callback = (error, newFolders, lastFolder)->)->
		logger.log project_id:project_id, path:path, "making directories if they don't exist"
		ProjectEntityUpdateHandler.mkdirp project_id, path, (err, newFolders, lastFolder)=>
			if err?
				logger.err err:err, project_id:project_id, path:path, "could not mkdirp"
				return callback(err)

			EditorController._notifyProjectUsersOfNewFolders project_id, newFolders, (err) ->
				return callback(err) if err?
				callback null, newFolders, lastFolder

	deleteEntity : (project_id, entity_id, entityType, source, userId, callback = (error)->)->
		logger.log {project_id, entity_id, entityType, source}, "start delete process of entity"
		Metrics.inc "editor.delete-entity"
		ProjectEntityUpdateHandler.deleteEntity project_id, entity_id, entityType, userId, (err)->
			if err?
				logger.err {err, project_id, entity_id, entityType}, "could not delete entity"
				return callback(err)
			logger.log {project_id, entity_id, entityType}, "telling users entity has been deleted"
			EditorRealTimeController.emitToRoom(project_id, 'removeEntity', entity_id, source)
			callback()

	deleteEntityWithPath: (project_id, path, source, user_id, callback) ->
		ProjectEntityUpdateHandler.deleteEntityWithPath project_id, path, user_id, (err, entity_id) ->
			return callback(err) if err?
			EditorRealTimeController.emitToRoom(project_id, 'removeEntity', entity_id, source)
			callback null, entity_id

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
		ProjectEntityUpdateHandler.renameEntity project_id, entity_id, entityType, newName, userId, (err) ->
			if err?
				logger.err err:err, project_id:project_id, entity_id:entity_id, entityType:entityType, newName:newName, "error renaming entity"
				return callback(err)
			if newName.length > 0
				EditorRealTimeController.emitToRoom project_id, 'reciveEntityRename', entity_id, newName
			callback()

	moveEntity: (project_id, entity_id, folder_id, entityType, userId, callback = (error) ->)->
		Metrics.inc "editor.move-entity"
		ProjectEntityUpdateHandler.moveEntity project_id, entity_id, folder_id, entityType, userId, (err) ->
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

	setImageName : (project_id, imageName, callback = (err) ->) ->
		ProjectOptionsHandler.setImageName project_id, imageName, (err) ->
			return callback(err) if err?
			logger.log imageName:imageName, project_id:project_id, "setting imageName"
			EditorRealTimeController.emitToRoom project_id, 'imageNameUpdated', imageName
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
		ProjectEntityUpdateHandler.setRootDoc project_id, newRootDocID, (err) ->
			return callback(err) if err?
			EditorRealTimeController.emitToRoom project_id, 'rootDocUpdated', newRootDocID
			callback()

	_notifyProjectUsersOfNewFolders: (project_id, folders, callback = (error)->)->
		async.eachSeries folders,
			(folder, cb) -> EditorController._notifyProjectUsersOfNewFolder project_id, folder.parentFolder_id, folder, cb
			callback

	_notifyProjectUsersOfNewFolder: (project_id, folder_id, folder, callback = (error)->)->
		logger.log project_id:project_id, folder:folder, parentFolder_id:folder_id, "sending newly created folder out to users"
		EditorRealTimeController.emitToRoom(project_id, "reciveNewFolder", folder_id, folder)
		callback()
