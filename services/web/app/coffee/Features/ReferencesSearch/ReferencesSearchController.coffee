logger = require('logger-sharelatex')
ReferencesSearchHandler = require('./ReferencesSearchHandler')
ProjectLocator = require("../Project/ProjectLocator")
settings = require('settings-sharelatex')
EditorRealTimeController = require("../Editor/EditorRealTimeController")

module.exports = ReferencesSearchController =

	indexFile: (req, res) ->
		project_id = req.params.Project_id
		doc_id = req.body.docId
		logger.log {project_id, doc_id}, "indexing references"

		if !doc_id
			logger.log project_id: project_id, "no fileUrl supplied"
			return res.send 400
		ProjectLocator.findElement {
			project_id: project_id,
			element_id: doc_id,
			type: 'doc'
		}, (err, doc) ->
			if err?
				logger.err {err, project_id, doc_id}, "error finding doc to index"
				return res.send 500
			ReferencesSearchHandler.indexFile project_id, doc_id, (err) ->
				if err
					logger.err {err, project_id, doc_id}, "error indexing references file"
					return res.send 500

				res.send 200

	getKeys: (req, res) ->
		project_id = req.params.Project_id
		logger.log {project_id}, "getting project references keys"
		ReferencesSearchHandler.getKeys project_id, (err, data) ->
			if err
				logger.err {err, project_id}, "error getting references keys"
				return res.send 500
			return res.json data

	index: (req, res) ->
		projectId = req.params.Project_id
		shouldBroadcast = req.body.shouldBroadcast
		docIds = req.body.docIds
		if (not docIds instanceof Array) and (docIds != "ALL")
			logger.err {projectId, docIds}, "docIds is not valid, should be either Array or String 'ALL'"
			return res.send 400
		logger.log {projectId, docIds}, "index references for project"
		ReferencesSearchHandler.index projectId, docIds, (err, data) ->
			if err
				logger.err {err, projectId}, "error indexing references"
				return res.send 500
			if shouldBroadcast
				logger.log {projectId}, "emitting new references keys to connected clients"
				EditorRealTimeController.emitToRoom projectId, 'references:keys:updated', data.keys
			return res.json data
