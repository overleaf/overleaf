UpdatesManager = require "./UpdatesManager"
DiffManager = require "./DiffManager"
PackManager = require "./PackManager"
RestoreManager = require "./RestoreManager"
logger = require "logger-sharelatex"
HealthChecker = require "./HealthChecker"
_ = require "underscore"

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

	flushAll: (req, res, next = (error) ->) ->
		# limit on projects to flush or -1 for all (default)
		limit = if req.query.limit? then parseInt(req.query.limit, 10) else -1
		logger.log {limit: limit}, "flushing all projects"
		UpdatesManager.flushAll limit, (error, result) ->
			return next(error) if error?
			{failed, succeeded, all} = result
			status = "#{succeeded.length} succeeded, #{failed.length} failed"
			if limit == 0
				res.status(200).send "#{status}\nwould flush:\n#{all.join('\n')}\n"
			else if failed.length > 0
				logger.log {failed: failed, succeeded: succeeded}, "error flushing projects"
				res.status(500).send "#{status}\nfailed to flush:\n#{failed.join('\n')}\n"
			else
				res.status(200).send "#{status}\nflushed #{succeeded.length} projects of #{all.length}\n"

	checkDanglingUpdates: (req, res, next = (error) ->) ->
		logger.log "checking dangling updates"
		UpdatesManager.getDanglingUpdates (error, result) ->
			return next(error) if error?
			if result.length > 0
				logger.log {dangling: result}, "found dangling updates"
				res.status(500).send "dangling updates:\n#{result.join('\n')}\n"
			else
				res.status(200).send "no dangling updates found\n"

	checkDoc: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id
		logger.log project_id: project_id, doc_id: doc_id, "checking doc history"
		DiffManager.getDocumentBeforeVersion project_id, doc_id, 1, (error, document, rewoundUpdates) ->
			return next(error) if error?
			broken = []
			for update in rewoundUpdates
				for op in update.op when op.broken is true
					broken.push op
			if broken.length > 0
				res.send broken
			else
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

		logger.log {project_id, doc_id, from, to}, "getting diff"
		DiffManager.getDiff project_id, doc_id, from, to, (error, diff) ->
			return next(error) if error?
			res.json {diff: diff}

	getUpdates: (req, res, next = (error) ->) ->
		project_id = req.params.project_id

		if req.query.before?
			before = parseInt(req.query.before, 10)
		if req.query.min_count?
			min_count = parseInt(req.query.min_count, 10)

		UpdatesManager.getSummarizedProjectUpdates project_id, before: before, min_count: min_count, (error, updates, nextBeforeTimestamp) ->
			return next(error) if error?
			res.json {
				updates: updates
				nextBeforeTimestamp: nextBeforeTimestamp
			}

	restore: (req, res, next = (error) ->) ->
		{doc_id, project_id, version} = req.params
		user_id = req.headers["x-user-id"]
		version = parseInt(version, 10)
		RestoreManager.restoreToBeforeVersion project_id, doc_id, version, user_id, (error) ->
			return next(error) if error?
			res.send 204

	pushDocHistory: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		doc_id = req.params.doc_id
		logger.log {project_id, doc_id}, "pushing all finalised changes to s3"
		PackManager.pushOldPacks project_id, doc_id, (error) ->
			return next(error) if error?
			res.send 204

	pullDocHistory: (req, res, next = (error) ->) ->
		project_id = req.params.project_id
		doc_id = req.params.doc_id
		logger.log {project_id, doc_id}, "pulling all packs from s3"
		PackManager.pullOldPacks project_id, doc_id, (error) ->
			return next(error) if error?
			res.send 204

	healthCheck: (req, res)->
		HealthChecker.check (err)->
			if err?
				logger.err err:err, "error performing health check"
				res.send 500
			else
				res.send 200

	checkLock: (req, res)->
		HealthChecker.checkLock (err) ->
			if err?
				logger.err err:err, "error performing lock check"
				res.send 500
			else
				res.send 200
