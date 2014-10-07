ProjectEntityHandler = require "../Project/ProjectEntityHandler"
logger = require "logger-sharelatex"
EditorRealTimeController = require "./EditorRealTimeController"
EditorController = require "./EditorController"

module.exports = EditorHttpController =
	restoreDoc: (req, res, next) ->
		project_id = req.params.Project_id
		doc_id = req.params.doc_id
		name = req.body.name

		if !name?
			return res.send 400 # Malformed request

		logger.log project_id: project_id, doc_id: doc_id, "restoring doc"
		ProjectEntityHandler.restoreDoc project_id, doc_id, name, (err, doc, folder_id) =>
			return next(error) if error?
			EditorRealTimeController.emitToRoom(project_id, 'reciveNewDoc', folder_id, doc)
			res.json {
				doc_id: doc._id
			}


	addDoc: (req, res, next) ->
		project_id = req.params.Project_id
		name = req.body.name
		parent_folder_id = req.body.parent_folder_id
		EditorController.addDoc project_id, parent_folder_id, name, [], (error, doc) ->
			return next(error) if error?
			res.json doc

	addFolder: (req, res, next) ->
		project_id = req.params.Project_id
		name = req.body.name
		parent_folder_id = req.body.parent_folder_id
		EditorController.addFolder project_id, parent_folder_id, name, (error, doc) ->
			return next(error) if error?
			res.json doc

	renameEntity: (req, res, next) ->
		project_id  = req.params.Project_id
		entity_id   = req.params.entity_id
		entity_type = req.params.entity_type
		name = req.body.name
		if name.length > 150
			return res.send 400
		EditorController.renameEntity project_id, entity_id, entity_type, name, (error) ->
			return next(error) if error?
			res.send 204

	moveEntity: (req, res, next) ->
		project_id  = req.params.Project_id
		entity_id   = req.params.entity_id
		entity_type = req.params.entity_type
		folder_id = req.body.folder_id
		EditorController.moveEntity project_id, entity_id, folder_id, entity_type, (error) ->
			return next(error) if error?
			res.send 204

	deleteEntity: (req, res, next) ->
		project_id  = req.params.Project_id
		entity_id   = req.params.entity_id
		entity_type = req.params.entity_type
		EditorController.deleteEntity project_id, entity_id, entity_type, (error) ->
			return next(error) if error?
			res.send 204


