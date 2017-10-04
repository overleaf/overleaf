EditorRealTimeController = require "../Editor/EditorRealTimeController"
MetadataHandler = require './MetadataHandler'
logger = require 'logger-sharelatex'


module.exports = MetadataController =

	getAllMetadata: (req, res, next) ->
		project_id = req.params.project_id
		logger.log {project_id}, "getting metadata for project"
		MetadataHandler.getMetadataForProject project_id, (err, projectMetadata) ->
			if err?
				logger.err {project_id, err}, "[MetadataController] error getting metadata from project"
				return next(err)
			res.json {
				projectId: project_id
				projectLabels: projectMetadata["labels"]
				projectPackages: projectMetadata["packages"]
			}

	broadcastMetadataForDoc: (req, res, next) ->
		project_id = req.params.project_id
		doc_id = req.params.doc_id
		logger.log {project_id, doc_id}, "getting metadata for doc"
		MetadataHandler.getMetadataForDoc project_id, doc_id, (err, docMetadata) ->
			if err?
				logger.err {project_id, doc_id, err}, "[MetadataController] error getting metadata from doc"
				return next(err)
			EditorRealTimeController.emitToRoom project_id, "broadcastDocMetadata", {
				docId: doc_id
				metadata: {
					labels: docMetadata["labels"]
					packages: docMetadata["packages"]
				}
			}
			res.sendStatus(200)
