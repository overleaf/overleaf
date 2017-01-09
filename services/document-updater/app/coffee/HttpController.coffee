DocumentManager = require "./DocumentManager"
ProjectManager = require "./ProjectManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"
Metrics = require "./Metrics"

TWO_MEGABYTES = 2 * 1024 * 1024

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

		DocumentManager.getDocAndRecentOpsWithLock project_id, doc_id, fromVersion, (error, lines, version, ops, ranges) ->
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
				ranges: ranges

	_getTotalSizeOfLines: (lines) ->
		size = 0
		for line in lines
			size += (line.length + 1)
		return size

	setDoc: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id
		lines = req.body.lines
		source = req.body.source
		user_id = req.body.user_id
		lineSize = HttpController._getTotalSizeOfLines(lines)
		if lineSize > TWO_MEGABYTES
			logger.log {project_id, doc_id, source, lineSize, user_id}, "document too large, returning 406 response"
			return res.send 406
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
	
	acceptChange: (req, res, next = (error) ->) ->
		{project_id, doc_id, change_id} = req.params
		logger.log {project_id, doc_id, change_id}, "accepting change via http"
		timer = new Metrics.Timer("http.acceptChange")
		DocumentManager.acceptChangeWithLock project_id, doc_id, change_id, (error) ->
			timer.done()
			return next(error) if error?
			logger.log {project_id, doc_id, change_id}, "accepted change via http"
			res.send 204 # No Content
		

