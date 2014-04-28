DocManager = require "./DocManager"
logger = require "logger-sharelatex"

module.exports = HttpController =
	getDoc: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		doc_id = req.params.doc_id
		logger.log project_id: project_id, doc_id: doc_id, "getting doc"
		DocManager.getDoc project_id, doc_id, (error, doc) ->
			return next(error) if error?
			if !doc?
				res.send 404
			else
				res.send JSON.stringify({ lines: doc.lines })