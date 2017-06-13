EditorRealTimeController = require "../Editor/EditorRealTimeController"
LabelsHandler = require './LabelsHandler'
logger = require 'logger-sharelatex'


module.exports = LabelsController =

	getAllLabels: (req, res, next) ->
		project_id = req.params.project_id
		LabelsHandler.getAllLabelsForProject project_id, (err, projectLabels) ->
			if err?
				logger.err {project_id, err}, "[LabelsController] error getting all labels from project"
				return next(err)
			res.json {projectId: project_id, projectLabels: projectLabels}

	broadcastLabelsForDoc: (req, res, next) ->
		project_id = req.params.project_id
		doc_id = req.params.doc_id
		LabelsHandler.getLabelsForDoc project_id, doc_id, (err, docLabels) ->
			if err?
				logger.err {project_id, doc_id, err}, "[LabelsController] error getting labels from doc"
				return next(err)
			EditorRealTimeController.emitToRoom project_id, 'broadcastDocLabels', {
				docId: doc_id, labels: docLabels
			}
			res.sendStatus(200)
