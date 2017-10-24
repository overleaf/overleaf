EditorRealTimeController = require "../Editor/EditorRealTimeController"
MetaHandler = require './MetaHandler'
logger = require 'logger-sharelatex'


module.exports = MetaController =

	getMetadata: (req, res, next) ->
		project_id = req.params.project_id
		logger.log {project_id}, "getting all labels for project"
		MetaHandler.getAllMetaForProject project_id, (err, projectMeta) ->
			if err?
				logger.err {project_id, err}, "[MetaController] error getting all labels from project"
				return next err
			res.json {projectId: project_id, projectMeta: projectMeta}

	broadcastMetadataForDoc: (req, res, next) ->
		project_id = req.params.project_id
		doc_id = req.params.doc_id
		logger.log {project_id, doc_id}, "getting labels for doc"
		MetaHandler.getMetaForDoc project_id, doc_id, (err, docMeta) ->
			if err?
				logger.err {project_id, doc_id, err}, "[MetaController] error getting labels from doc"
				return next err
			EditorRealTimeController.emitToRoom project_id, 'broadcastDocMeta', {
				docId: doc_id, meta: docMeta
			}
			res.sendStatus 200
