#this file is being slowly refactored out

logger = require('logger-sharelatex')
sanitize = require('validator').sanitize
projectHandler = require('../handlers/ProjectHandler')
projectHandler = new projectHandler()
SecurityManager = require('./SecurityManager')
_ = require('underscore')
projectEditorHandler = require('../Features/Project/ProjectEditorHandler')
projectEntityHandler = require('../Features/Project/ProjectEntityHandler')
versioningApiHandler = require('../Features/Versioning/VersioningApiHandler')
metrics = require('../infrastructure/Metrics')
EditorRealTimeController = require('../Features/Editor/EditorRealTimeController')

module.exports = class CollaberationManager
	constructor: (@io)->

	deleteProject: (project_id, callback)->
		metrics.inc "editor.delete-project"
		logger.log project_id:project_id, "recived message to delete project"
		projectHandler.deleteProject project_id, callback

	renameEntity: (project_id, entity_id, entityType, newName, callback)->
		newName = sanitize(newName).xss()
		metrics.inc "editor.rename-entity"
		logger.log entity_id:entity_id, entity_id:entity_id, entity_id:entity_id, "reciving new name for entity for project"
		projectHandler.renameEntity project_id, entity_id, entityType, newName, =>
			if newName.length > 0
				EditorRealTimeController.emitToRoom project_id, 'reciveEntityRename', entity_id, newName
				callback?()

	moveEntity: (project_id, entity_id, folder_id, entityType, callback)->
		metrics.inc "editor.move-entity"
		projectEntityHandler.moveEntity project_id, entity_id, folder_id, entityType, =>
			EditorRealTimeController.emitToRoom project_id, 'reciveEntityMove', entity_id, folder_id
			callback?()

	renameProject: (project_id, window_id, newName, callback)->
		newName = sanitize(newName).xss()
		projectHandler.renameProject project_id, window_id, newName, =>
			newName = sanitize(newName).xss()
			EditorRealTimeController.emitToRoom project_id, 'projectNameUpdated', window_id, newName
			callback?()

	setPublicAccessLevel : (project_id, newAccessLevel, callback)->
		projectHandler.setPublicAccessLevel project_id, newAccessLevel, =>
			EditorRealTimeController.emitToRoom project_id, 'publicAccessLevelUpdated', newAccessLevel
			callback?()

	distributMessage: (project_id, client, message)->
		message = sanitize(message).xss()
		metrics.inc "editor.instant-message"
		client.get "first_name", (err, first_name)=>
			EditorRealTimeController.emitToRoom project_id, 'reciveNewMessage', first_name, message

	setRootDoc: (project_id, newRootDocID, callback)->
		projectEntityHandler.setRootDoc project_id, newRootDocID, () =>
			EditorRealTimeController.emitToRoom project_id, 'rootDocUpdated', newRootDocID
			callback?()

	takeVersionSnapShot : (project_id, message, callback)->
		versioningApiHandler.takeVersionSnapshot project_id, message, callback
