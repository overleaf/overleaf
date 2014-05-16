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
				res.json HttpController._buildDocView(doc)

	getAllDocs: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		logger.log project_id: project_id, "getting all docs"
		DocManager.getAllDocs project_id, (error, docs = []) ->
			return next(error) if error?
			docViews = []
			for doc in docs
				if doc? # There can end up being null docs for some reason :( (probably a race condition)
					docViews.push HttpController._buildDocView(doc)
				else
					logger.error err: new Error("null doc"), project_id: project_id, "encountered null doc"
			res.json docViews

	updateDoc: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		doc_id     = req.params.doc_id
		lines      = req.body?.lines

		if !lines? or lines not instanceof Array
			logger.error project_id: project_id, doc_id: doc_id, "no doc lines provided"
			res.send 400 # Bad Request
			return

		logger.log project_id: project_id, doc_id: doc_id, "updating doc"
		DocManager.updateDoc project_id, doc_id, lines, (error, modified, rev) ->
			return next(error) if error?
			res.json {
				modified: modified
				rev: rev
			}

	deleteDoc: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		doc_id     = req.params.doc_id
		logger.log project_id: project_id, doc_id: doc_id, "deleting doc"
		DocManager.deleteDoc project_id, doc_id, (error) ->
			return next(error) if error?
			res.send 204

	_buildDocView: (doc) -> 
		return {
			_id:     doc._id.toString()
			lines:   doc.lines
			rev:     doc.rev
		}