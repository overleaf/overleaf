DocumentManager = require "./DocumentManager"
ProjectManager = require "./ProjectManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"
Metrics = require "./Metrics"

module.exports = HttpController =
	getDoc: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id
		logger.log project_id: project_id, doc_id: doc_id, "getting doc via http"
		timer = new Metrics.Timer("http.getDoc")

		if req.query?.fromVersion?
			fromVersion = parseInt(req.query.fromVersion, 10)
		else
			fromVersion = -1

		DocumentManager.getDocAndRecentOpsWithLock project_id, doc_id, fromVersion, (error, lines, version, ops) ->
			timer.done()
			return next(error) if error?
			logger.log project_id: project_id, doc_id: doc_id, "got doc via http"
			if !lines? or !version?
				return next(new Errors.NotFoundError("document not found"))
			res.send JSON.stringify
				id: doc_id
				lines: lines
				version: version
				ops: ops

	setDoc: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id
		lines = req.body.lines
		source = req.body.source
		user_id = req.body.user_id
		logger.log project_id: project_id, doc_id: doc_id, lines: lines, source: source, user_id: user_id, "setting doc via http"
		timer = new Metrics.Timer("http.setDoc")
		DocumentManager.setDocWithLock project_id, doc_id, lines, source, user_id, (error) ->
			timer.done()
			return next(error) if error?
			logger.log project_id: project_id, doc_id: doc_id, "set doc via http"
			res.send 204 # No Content
		

	flushDocIfLoaded: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id
		logger.log project_id: project_id, doc_id: doc_id, "flushing doc via http"
		timer = new Metrics.Timer("http.flushDoc")
		DocumentManager.flushDocIfLoadedWithLock project_id, doc_id, (error) ->
			timer.done()
			return next(error) if error?
			logger.log project_id: project_id, doc_id: doc_id, "flushed doc via http"
			res.send 204 # No Content
		
	flushAndDeleteDoc: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id
		logger.log project_id: project_id, doc_id: doc_id, "deleting doc via http"
		timer = new Metrics.Timer("http.deleteDoc")
		DocumentManager.flushAndDeleteDocWithLock project_id, doc_id, (error) ->
			timer.done()
			return next(error) if error?
			logger.log project_id: project_id, doc_id: doc_id, "deleted doc via http"
			res.send 204 # No Content

	flushProject: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		logger.log project_id: project_id, "flushing project via http"
		timer = new Metrics.Timer("http.flushProject")
		ProjectManager.flushProjectWithLocks project_id, (error) ->
			timer.done()
			return next(error) if error?
			logger.log project_id: project_id, "flushed project via http"
			res.send 204 # No Content
		
	deleteProject: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		logger.log project_id: project_id, "deleting project via http"
		timer = new Metrics.Timer("http.deleteProject")
		ProjectManager.flushAndDeleteProjectWithLocks project_id, (error) ->
			timer.done()
			return next(error) if error?
			logger.log project_id: project_id, "deleted project via http"
			res.send 204 # No Content
			
