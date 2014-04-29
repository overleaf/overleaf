DocManager = require "./DocManager"
logger = require "logger-sharelatex"

module.exports = HttpController =
	getDoc: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		doc_id     = req.params.doc_id
		logger.log project_id: project_id, doc_id: doc_id, "getting doc"
		DocManager.getDoc project_id, doc_id, (error, doc) ->
			return next(error) if error?
			if !doc?
				res.send 404
			else
				res.json {
					lines: doc.lines
				}

	updateDoc: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		doc_id     = req.params.doc_id
		lines      = req.body?.lines

		if !lines? or lines not instanceof Array
			logger.error project_id: project_id, doc_id: doc_id, "no doc lines provided"
			res.send 400 # Bad Request
			return

		logger.log project_id: project_id, doc_id: doc_id, "updating doc"
		DocManager.updateDoc project_id, doc_id, lines, (error, modified) ->
			return next(error) if error?
			res.json {
				modified: modified
			}