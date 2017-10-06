EditorRealTimeController = require "../Editor/EditorRealTimeController"
LabelsHandler = require './LabelsHandler'
logger = require 'logger-sharelatex'


module.exports = LabelsController =

	getAllLabels: (req, res, next) ->
		project_id = req.params.project_id
		logger.log {project_id}, "getting all labels for project"
		LabelsHandler.getAllMetaForProject project_id, (err, projectMeta) ->
			if err?
				logger.err {project_id, err}, "[LabelsController] error getting all labels from project"
				return next(err)
			res.json {projectId: project_id, projectMeta: projectMeta}

	broadcastLabelsForDoc: (req, res, next) ->
		project_id = req.params.project_id
		doc_id = req.params.doc_id
		logger.log {project_id, doc_id}, "getting labels for doc"
		LabelsHandler.getMetaForDoc project_id, doc_id, (err, docMeta) ->
			if err?
				logger.err {project_id, doc_id, err}, "[LabelsController] error getting labels from doc"
				return next(err)
			EditorRealTimeController.emitToRoom project_id, 'broadcastDocMeta', {
				docId: doc_id, meta: docMeta
			}
			res.sendStatus(200)
