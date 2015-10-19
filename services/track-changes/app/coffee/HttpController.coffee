UpdatesManager = require "./UpdatesManager"
DiffManager = require "./DiffManager"
PackManager = require "./PackManager"
RestoreManager = require "./RestoreManager"
logger = require "logger-sharelatex"
DocArchiveManager = require "./DocArchiveManager"
HealthChecker = require "./HealthChecker"

module.exports = HttpController =
	flushDoc: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id
		logger.log project_id: project_id, doc_id: doc_id, "compressing doc history"
		UpdatesManager.processUncompressedUpdatesWithLock project_id, doc_id, (error) ->
			return next(error) if error?
			res.send 204

	flushProject: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		logger.log project_id: project_id, "compressing project history"
		UpdatesManager.processUncompressedUpdatesForProject project_id, (error) ->
			return next(error) if error?
			res.send 204

	packDoc: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		logger.log doc_id: doc_id, "packing doc history"
		PackManager.packDocHistory doc_id, (error) ->
			return next(error) if error?
			res.send 204

	getDiff: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id

		if req.query.from?
			from = parseInt(req.query.from, 10)
		else
			from = null
		if req.query.to?
			to = parseInt(req.query.to, 10)
		else
			to = null

		logger.log project_id, doc_id: doc_id, from: from, to: to, "getting diff"
		DiffManager.getDiff project_id, doc_id, from, to, (error, diff) ->
			return next(error) if error?
			res.send JSON.stringify(diff: diff)

	getUpdates: (req, res, next = (error) ->) ->
		project_id = req.params.project_id

		if req.query.before?
			before = parseInt(req.query.before, 10)
		if req.query.min_count?
			min_count = parseInt(req.query.min_count, 10)

		UpdatesManager.getSummarizedProjectUpdates project_id, before: before, min_count: min_count, (error, updates, nextBeforeTimestamp) ->
			return next(error) if error?
			res.send JSON.stringify
				updates: updates
				nextBeforeTimestamp: nextBeforeTimestamp

	restore: (req, res, next = (error) ->) ->
		{doc_id, project_id, version} = req.params
		user_id = req.headers["x-user-id"]
		version = parseInt(version, 10)
		RestoreManager.restoreToBeforeVersion project_id, doc_id, version, user_id, (error) ->
			return next(error) if error?
			res.send 204

	archiveProject: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		logger.log project_id: project_id, "archiving all track changes to s3"
		DocArchiveManager.archiveAllDocsChanges project_id, (error) ->
			return next(error) if error?
			res.send 204

	unArchiveProject: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		logger.log project_id: project_id, "unarchiving all track changes from s3"
		DocArchiveManager.unArchiveAllDocsChanges project_id, (error) ->
			return next(error) if error?
			res.send 204

	healthCheck: (req, res)->
		HealthChecker.check (err)->
			if err?
				logger.err err:err, "error performing health check"
				res.send 500
			else
				res.send 200
