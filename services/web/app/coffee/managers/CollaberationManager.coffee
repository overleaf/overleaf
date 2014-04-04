#this file is being slowly refactored out

logger = require('logger-sharelatex')
sanitize = require('sanitizer')
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

	setPublicAccessLevel : (project_id, newAccessLevel, callback)->
		projectHandler.setPublicAccessLevel project_id, newAccessLevel, =>
			EditorRealTimeController.emitToRoom project_id, 'publicAccessLevelUpdated', newAccessLevel
			callback?()

	distributMessage: (project_id, client, message)->
		message = sanitize.escape(message)
		metrics.inc "editor.instant-message"
		client.get "first_name", (err, first_name)=>
			EditorRealTimeController.emitToRoom project_id, 'reciveNewMessage', first_name, message

	setRootDoc: (project_id, newRootDocID, callback)->
		projectEntityHandler.setRootDoc project_id, newRootDocID, () =>
			EditorRealTimeController.emitToRoom project_id, 'rootDocUpdated', newRootDocID
			callback?()

	takeVersionSnapShot : (project_id, message, callback)->
		versioningApiHandler.takeVersionSnapshot project_id, message, callback
