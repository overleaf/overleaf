DocManager = require "./DocManager"
logger = require "logger-sharelatex"
DocArchive = require "./DocArchiveManager"
HealthChecker = require "./HealthChecker"


module.exports = HttpController =
	getDoc: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		doc_id     = req.params.doc_id
		include_deleted = req.query?.include_deleted == "true"
		logger.log project_id: project_id, doc_id: doc_id, "getting doc"
		DocManager.getDoc project_id, doc_id, {version: true}, (error, doc) ->
			return next(error) if error?
			logger.log doc: doc, "got doc"
			if !doc?
				res.send 404
			else if doc.deleted && !include_deleted
				res.send 404
			else
				res.json HttpController._buildDocView(doc)

	getRawDoc: (req, res, next = (error)->)->
		project_id = req.params.project_id
		doc_id     = req.params.doc_id
		logger.log project_id: project_id, doc_id: doc_id, "getting raw doc"
		DocManager.getDoc project_id, doc_id, {version: false}, (error, doc) ->
			return next(error) if error?
			if !doc?
				res.send 404
			else
				res.setHeader('content-type', 'text/plain')
				res.send HttpController._buildRawDocView(doc)

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
		version    = req.body?.version

		if !lines? or lines not instanceof Array
			logger.error project_id: project_id, doc_id: doc_id, "no doc lines provided"
			res.send 400 # Bad Request
			return
		
		if !version? or typeof version is not "number"
			logger.error project_id: project_id, doc_id: doc_id, "no doc version provided"
			res.send 400 # Bad Request
			return

		logger.log project_id: project_id, doc_id: doc_id, "got http request to update doc"
		DocManager.updateDoc project_id, doc_id, lines, version, (error, modified, rev) ->
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
		doc_view = {
			_id:     doc._id?.toString()
			lines:   doc.lines
			rev:     doc.rev
			deleted: !!doc.deleted
		}
		if doc.version?
			doc_view.version = doc.version
		return doc_view

	_buildRawDocView: (doc)->
		return (doc?.lines or []).join("\n")

	archiveAllDocs: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		logger.log project_id: project_id, "archiving all docs"
		DocArchive.archiveAllDocs project_id, (error) ->
			return next(error) if error?
			res.send 204

	unArchiveAllDocs: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		logger.log project_id: project_id, "unarchiving all docs"
		DocArchive.unArchiveAllDocs project_id, (error) ->
			return next(error) if error?
			res.send 200

	healthCheck: (req, res)->
		HealthChecker.check (err)->
			if err?
				logger.err err:err, "error performing health check"
				res.send 500
			else
				res.send 200

