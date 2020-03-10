DocumentManager = require "./DocumentManager"
HistoryManager = require "./HistoryManager"
ProjectManager = require "./ProjectManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"
Metrics = require "./Metrics"
ProjectFlusher = require("./ProjectFlusher")
DeleteQueueManager = require("./DeleteQueueManager")
async = require "async"

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

		DocumentManager.getDocAndRecentOpsWithLock project_id, doc_id, fromVersion, (error, lines, version, ops, ranges, pathname) ->
			timer.done()
			return next(error) if error?
			logger.log project_id: project_id, doc_id: doc_id, "got doc via http"
			if !lines? or !version?
				return next(new Errors.NotFoundError("document not found"))
			res.json
				id: doc_id
				lines: lines
				version: version
				ops: ops
				ranges: ranges
				pathname: pathname

	_getTotalSizeOfLines: (lines) ->
		size = 0
		for line in lines
			size += (line.length + 1)
		return size

	getProjectDocsAndFlushIfOld: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		projectStateHash = req.query?.state
		# exclude is string of existing docs "id:version,id:version,..."
		excludeItems = req.query?.exclude?.split(',') or []
		logger.log project_id: project_id, exclude: excludeItems, "getting docs via http"
		timer = new Metrics.Timer("http.getAllDocs")
		excludeVersions = {}
		for item in excludeItems
			[id,version] = item?.split(':')
			excludeVersions[id] = version
		logger.log {project_id: project_id, projectStateHash: projectStateHash, excludeVersions: excludeVersions}, "excluding versions"
		ProjectManager.getProjectDocsAndFlushIfOld project_id, projectStateHash, excludeVersions, (error, result) ->
			timer.done()
			if error instanceof Errors.ProjectStateChangedError
				res.send 409 # conflict
			else if error?
				return next(error)
			else
				logger.log project_id: project_id, result: ("#{doc._id}:#{doc.v}" for doc in result), "got docs via http"
				res.send result

	clearProjectState: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		timer = new Metrics.Timer("http.clearProjectState")
		logger.log project_id: project_id, "clearing project state via http"
		ProjectManager.clearProjectState project_id, (error) ->
			timer.done()
			if error?
				return next(error)
			else
				res.send 200

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

	deleteDoc: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id
		ignoreFlushErrors = req.query.ignore_flush_errors == 'true'
		timer = new Metrics.Timer("http.deleteDoc")
		logger.log project_id: project_id, doc_id: doc_id, "deleting doc via http"
		DocumentManager.flushAndDeleteDocWithLock project_id, doc_id, { ignoreFlushErrors: ignoreFlushErrors }, (error) ->
			timer.done()
			# There is no harm in flushing project history if the previous call
			# failed and sometimes it is required
			HistoryManager.flushProjectChangesAsync project_id

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
		options = {}
		options.background = true if req.query?.background # allow non-urgent flushes to be queued
		options.skip_history_flush = true if req.query?.shutdown # don't flush history when realtime shuts down
		if req.query?.background
			ProjectManager.queueFlushAndDeleteProject project_id, (error) ->
				return next(error) if error?
				logger.log project_id: project_id, "queue delete of project via http"
				res.send 204 # No Content
		else
			timer = new Metrics.Timer("http.deleteProject")
			ProjectManager.flushAndDeleteProjectWithLocks project_id, options, (error) ->
				timer.done()
				return next(error) if error?
				logger.log project_id: project_id, "deleted project via http"
				res.send 204 # No Content

	deleteMultipleProjects: (req, res, next = (error) ->) ->
		project_ids = req.body?.project_ids || []
		logger.log project_ids: project_ids, "deleting multiple projects via http"
		async.eachSeries project_ids, (project_id, cb) ->
			logger.log project_id: project_id, "queue delete of project via http"
			ProjectManager.queueFlushAndDeleteProject project_id, cb
		, (error) ->
			return next(error) if error?
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

	updateProject: (req, res, next = (error) ->) ->
		timer = new Metrics.Timer("http.updateProject")
		project_id = req.params.project_id
		{projectHistoryId, userId, docUpdates, fileUpdates, version} = req.body
		logger.log {project_id, docUpdates, fileUpdates, version}, "updating project via http"

		ProjectManager.updateProjectWithLocks project_id, projectHistoryId, userId, docUpdates, fileUpdates, version, (error) ->
			timer.done()
			return next(error) if error?
			logger.log project_id: project_id, "updated project via http"
			res.send 204 # No Content

	resyncProjectHistory: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		{projectHistoryId, docs, files} = req.body

		logger.log {project_id, docs, files}, "queuing project history resync via http"
		HistoryManager.resyncProjectHistory project_id, projectHistoryId, docs, files, (error) ->
			return next(error) if error?
			logger.log {project_id}, "queued project history resync via http"
			res.send 204

	flushAllProjects: (req, res, next = (error)-> )->
		res.setTimeout(5 * 60 * 1000)
		options =
			limit : req.query.limit || 1000
			concurrency : req.query.concurrency || 5
			dryRun : req.query.dryRun || false
		ProjectFlusher.flushAllProjects options, (err, project_ids)->
			if err?
				logger.err err:err, "error bulk flushing projects"
				res.send 500
			else
				res.send project_ids

	flushQueuedProjects: (req, res, next = (error) ->) ->
		res.setTimeout(10 * 60 * 1000)
		options =
			limit : req.query.limit || 1000
			timeout: 5 * 60 * 1000
			min_delete_age: req.query.min_delete_age || 5 * 60 * 1000
		DeleteQueueManager.flushAndDeleteOldProjects options, (err, flushed)->
			if err?
				logger.err err:err, "error flushing old projects"
				res.send 500
			else
				logger.log {flushed: flushed}, "flush of queued projects completed"
				res.send {flushed: flushed}
