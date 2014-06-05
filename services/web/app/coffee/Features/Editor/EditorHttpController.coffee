ProjectEntityHandler = require "../Project/ProjectEntityHandler"
logger = require "logger-sharelatex"
EditorRealTimeController = require "./EditorRealTimeController"

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

