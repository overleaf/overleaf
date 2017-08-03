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

	getProjectDocs: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		# exclude is string of existing docs "id:version,id:version,..."
		excludeItems = req.query?.exclude?.split(',') or []
		logger.log project_id: project_id, exclude: excludeItems, "getting docs via http"
		timer = new Metrics.Timer("http.getAllDocs")
		excludeVersions = {}
		for item in excludeItems
			[id,version] = item?.split(':')
			excludeVersions[id] = version
		logger.log {project_id: project_id, excludeVersions: excludeVersions}, "excluding versions"
		ProjectManager.getProjectDocs project_id, excludeVersions, (error, result) ->
			timer.done()
			return next(error) if error?
			logger.log project_id: project_id, result: result, "got docs via http"
			res.send result

	setDoc: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id
		{lines, source, user_id, undoing} = req.body
		lineSize = HttpController._getTotalSizeOfLines(lines)
		if lineSize > TWO_MEGABYTES
			logger.log {project_id, doc_id, source, lineSize, user_id}, "document too large, returning 406 response"
			return res.send 406
		logger.log {project_id, doc_id, lines, source, user_id, undoing}, "setting doc via http"
		timer = new Metrics.Timer("http.setDoc")
		DocumentManager.setDocWithLock project_id, doc_id, lines, source, user_id, undoing, (error) ->
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

	acceptChanges: (req, res, next = (error) ->) ->
		{project_id, doc_id} = req.params
		change_ids = req.body?.change_ids
		if !change_ids?
			change_ids = [ req.params.change_id ]
		logger.log {project_id, doc_id}, "accepting #{ change_ids.length } changes via http"
		timer = new Metrics.Timer("http.acceptChanges")
		DocumentManager.acceptChangesWithLock project_id, doc_id, change_ids, (error) ->
			timer.done()
			return next(error) if error?
			logger.log {project_id, doc_id}, "accepted #{ change_ids.length } changes via http"
			res.send 204 # No Content
	
	deleteComment: (req, res, next = (error) ->) ->
		{project_id, doc_id, comment_id} = req.params
		logger.log {project_id, doc_id, comment_id}, "deleting comment via http"
		timer = new Metrics.Timer("http.deleteComment")
		DocumentManager.deleteCommentWithLock project_id, doc_id, comment_id, (error) ->
			timer.done()
			return next(error) if error?
			logger.log {project_id, doc_id, comment_id}, "deleted comment via http"
			res.send 204 # No Content
		

