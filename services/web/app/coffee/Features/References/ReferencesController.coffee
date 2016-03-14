logger = require('logger-sharelatex')
ReferencesHandler = require('./ReferencesHandler')
settings = require('settings-sharelatex')
EditorRealTimeController = require("../Editor/EditorRealTimeController")

module.exports = ReferencesController =


	index: (req, res) ->
		projectId = req.params.Project_id
		shouldBroadcast = req.body.shouldBroadcast
		docIds = req.body.docIds
		if (!docIds or !(docIds instanceof Array))
			logger.err {projectId, docIds}, "docIds is not valid, should be either Array or String 'ALL'"
			return res.sendStatus 400
		logger.log {projectId, docIds: docIds}, "index references for project"
		ReferencesHandler.index projectId, docIds, (err, data) ->
			if err
				logger.err {err, projectId}, "error indexing all references"
				return res.sendStatus 500
			ReferencesController._handleIndexResponse(req, res, projectId, shouldBroadcast, data)

	indexAll: (req, res) ->
		projectId = req.params.Project_id
		shouldBroadcast = req.body.shouldBroadcast
		logger.log {projectId}, "index all references for project"
		ReferencesHandler.indexAll projectId, (err, data) ->
			if err
				logger.err {err, projectId}, "error indexing all references"
				return res.sendStatus 500
			ReferencesController._handleIndexResponse(req, res, projectId, shouldBroadcast, data)

	_handleIndexResponse: (req, res, projectId, shouldBroadcast, data) ->
		if shouldBroadcast
			logger.log {projectId}, "emitting new references keys to connected clients"
			EditorRealTimeController.emitToRoom projectId, 'references:keys:updated', data.keys
		return res.json data
