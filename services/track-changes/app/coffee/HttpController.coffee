UpdatesManager = require "./UpdatesManager"
DiffManager = require "./DiffManager"
RestoreManager = require "./RestoreManager"
logger = require "logger-sharelatex"

module.exports = HttpController =
	flushUpdatesWithLock: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id
		logger.log doc_id: doc_id, "compressing doc history"
		UpdatesManager.processUncompressedUpdatesWithLock project_id, doc_id, (error) ->
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
