RedisManager = require "./RedisManager"
ProjectHistoryRedisManager = require "./ProjectHistoryRedisManager"
PersistenceManager = require "./PersistenceManager"
DiffCodec = require "./DiffCodec"
logger = require "logger-sharelatex"
Metrics = require "./Metrics"
HistoryManager = require "./HistoryManager"
RealTimeRedisManager = require "./RealTimeRedisManager"
Errors = require "./Errors"
RangesManager = require "./RangesManager"
async = require "async"

MAX_UNFLUSHED_AGE = 300 * 1000 # 5 mins, document should be flushed to mongo this time after a change

module.exports = DocumentManager =
	getDoc: (project_id, doc_id, _callback = (error, lines, version, ranges, pathname, projectHistoryId, unflushedTime, alreadyLoaded) ->) ->
		timer = new Metrics.Timer("docManager.getDoc")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		RedisManager.getDoc project_id, doc_id, (error, lines, version, ranges, pathname, projectHistoryId, unflushedTime) ->
			return callback(error) if error?
			if !lines? or !version?
				logger.log {project_id, doc_id}, "doc not in redis so getting from persistence API"
				PersistenceManager.getDoc project_id, doc_id, (error, lines, version, ranges, pathname, projectHistoryId, projectHistoryType) ->
					return callback(error) if error?
					logger.log {project_id, doc_id, lines, version, pathname, projectHistoryId, projectHistoryType}, "got doc from persistence API"
					RedisManager.putDocInMemory project_id, doc_id, lines, version, ranges, pathname, projectHistoryId, (error) ->
						return callback(error) if error?
						RedisManager.setHistoryType doc_id, projectHistoryType, (error) ->
							return callback(error) if error?
							callback null, lines, version, ranges || {}, pathname, projectHistoryId, null, false
			else
				callback null, lines, version, ranges, pathname, projectHistoryId, unflushedTime, true

	getDocAndRecentOps: (project_id, doc_id, fromVersion, _callback = (error, lines, version, ops, ranges, pathname, projectHistoryId) ->) ->
		timer = new Metrics.Timer("docManager.getDocAndRecentOps")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		DocumentManager.getDoc project_id, doc_id, (error, lines, version, ranges, pathname, projectHistoryId) ->
			return callback(error) if error?
			if fromVersion == -1
				callback null, lines, version, [], ranges, pathname, projectHistoryId
			else
				RedisManager.getPreviousDocOps doc_id, fromVersion, version, (error, ops) ->
					return callback(error) if error?
					callback null, lines, version, ops, ranges, pathname, projectHistoryId

	setDoc: (project_id, doc_id, newLines, source, user_id, undoing, _callback = (error) ->) ->
		timer = new Metrics.Timer("docManager.setDoc")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		if !newLines?
			return callback(new Error("No lines were provided to setDoc"))

		UpdateManager = require "./UpdateManager"
		DocumentManager.getDoc project_id, doc_id, (error, oldLines, version, ranges, pathname, projectHistoryId, unflushedTime, alreadyLoaded) ->
			return callback(error) if error?

			if oldLines? and oldLines.length > 0 and oldLines[0].text?
				logger.log doc_id: doc_id, project_id: project_id, oldLines: oldLines, newLines: newLines, "document is JSON so not updating"
				return callback(null)

			logger.log doc_id: doc_id, project_id: project_id, oldLines: oldLines, newLines: newLines, "setting a document via http"
			DiffCodec.diffAsShareJsOp oldLines, newLines, (error, op) ->
				return callback(error) if error?
				if undoing
					for o in op or []
						o.u = true # Turn on undo flag for each op for track changes
				update =
					doc: doc_id
					op: op
					v: version
					meta:
						type: "external"
						source: source
						user_id: user_id
				UpdateManager.applyUpdate project_id, doc_id, update, (error) ->
					return callback(error) if error?
					# If the document was loaded already, then someone has it open
					# in a project, and the usual flushing mechanism will happen.
					# Otherwise we should remove it immediately since nothing else
					# is using it.
					if alreadyLoaded
						DocumentManager.flushDocIfLoaded project_id, doc_id, (error) ->
							return callback(error) if error?
							callback null
					else
						DocumentManager.flushAndDeleteDoc project_id, doc_id, {}, (error) ->
							# There is no harm in flushing project history if the previous
							# call failed and sometimes it is required
							HistoryManager.flushProjectChangesAsync project_id

							return callback(error) if error?
							callback null

	flushDocIfLoaded: (project_id, doc_id, _callback = (error) ->) ->
		timer = new Metrics.Timer("docManager.flushDocIfLoaded")
		callback = (args...) ->
			timer.done()
			_callback(args...)
		RedisManager.getDoc project_id, doc_id, (error, lines, version, ranges, pathname, projectHistoryId, unflushedTime, lastUpdatedAt, lastUpdatedBy) ->
			return callback(error) if error?
			if !lines? or !version?
				logger.log project_id: project_id, doc_id: doc_id, "doc is not loaded so not flushing"
				callback null  # TODO: return a flag to bail out, as we go on to remove doc from memory?
			else
				logger.log project_id: project_id, doc_id: doc_id, version: version, "flushing doc"
				PersistenceManager.setDoc project_id, doc_id, lines, version, ranges, lastUpdatedAt, lastUpdatedBy, (error) ->
					return callback(error) if error?
					RedisManager.clearUnflushedTime doc_id, callback

	flushAndDeleteDoc: (project_id, doc_id, options, _callback) ->
		timer = new Metrics.Timer("docManager.flushAndDeleteDoc")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		DocumentManager.flushDocIfLoaded project_id, doc_id, (error) ->
			if error?
				if options.ignoreFlushErrors
					logger.warn {project_id: project_id, doc_id: doc_id, err: error}, "ignoring flush error while deleting document"
				else
					return callback(error)

			# Flush in the background since it requires a http request
			HistoryManager.flushDocChangesAsync project_id, doc_id

			RedisManager.removeDocFromMemory project_id, doc_id, (error) ->
				return callback(error) if error?
				callback null

	acceptChanges: (project_id, doc_id, change_ids = [], _callback = (error) ->) ->
		timer = new Metrics.Timer("docManager.acceptChanges")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		DocumentManager.getDoc project_id, doc_id, (error, lines, version, ranges) ->
			return callback(error) if error?
			if !lines? or !version?
				return callback(new Errors.NotFoundError("document not found: #{doc_id}"))
			RangesManager.acceptChanges change_ids, ranges, (error, new_ranges) ->
				return callback(error) if error?
				RedisManager.updateDocument project_id, doc_id, lines, version, [], new_ranges, {}, (error) ->
					return callback(error) if error?
					callback()

	deleteComment: (project_id, doc_id, comment_id, _callback = (error) ->) ->
		timer = new Metrics.Timer("docManager.deleteComment")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		DocumentManager.getDoc project_id, doc_id, (error, lines, version, ranges) ->
			return callback(error) if error?
			if !lines? or !version?
				return callback(new Errors.NotFoundError("document not found: #{doc_id}"))
			RangesManager.deleteComment comment_id, ranges, (error, new_ranges) ->
				return callback(error) if error?
				RedisManager.updateDocument project_id, doc_id, lines, version, [], new_ranges, {}, (error) ->
					return callback(error) if error?
					callback()

	renameDoc: (project_id, doc_id, user_id, update, projectHistoryId, _callback = (error) ->) ->
		timer = new Metrics.Timer("docManager.updateProject")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		RedisManager.renameDoc project_id, doc_id, user_id, update, projectHistoryId, callback

	getDocAndFlushIfOld: (project_id, doc_id, callback = (error, doc) ->) ->
		DocumentManager.getDoc project_id, doc_id, (error, lines, version, ranges, pathname, projectHistoryId, unflushedTime, alreadyLoaded) ->
			return callback(error) if error?
			# if doc was already loaded see if it needs to be flushed
			if alreadyLoaded and unflushedTime? and (Date.now() - unflushedTime) > MAX_UNFLUSHED_AGE
				DocumentManager.flushDocIfLoaded project_id, doc_id, (error) ->
					return callback(error) if error?
					callback(null, lines, version)
			else
				callback(null, lines, version)

	resyncDocContents: (project_id, doc_id, callback) ->
		logger.log {project_id: project_id, doc_id: doc_id}, "start resyncing doc contents"
		RedisManager.getDoc project_id, doc_id, (error, lines, version, ranges, pathname, projectHistoryId) ->
			return callback(error) if error?

			if !lines? or !version?
				logger.log {project_id: project_id, doc_id: doc_id}, "resyncing doc contents - not found in redis - retrieving from web"
				PersistenceManager.getDoc project_id, doc_id, (error, lines, version, ranges, pathname, projectHistoryId) ->
					if error?
						logger.error {project_id: project_id, doc_id: doc_id, getDocError: error}, "resyncing doc contents - error retrieving from web"
						return callback(error)
					ProjectHistoryRedisManager.queueResyncDocContent project_id, projectHistoryId, doc_id, lines, version, pathname, callback
			else
				logger.log {project_id: project_id, doc_id: doc_id}, "resyncing doc contents - doc in redis - will queue in redis"
				ProjectHistoryRedisManager.queueResyncDocContent project_id, projectHistoryId, doc_id, lines, version, pathname, callback

	getDocWithLock: (project_id, doc_id, callback = (error, lines, version) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.getDoc, project_id, doc_id, callback

	getDocAndRecentOpsWithLock: (project_id, doc_id, fromVersion, callback = (error, lines, version, ops, ranges, pathname, projectHistoryId) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.getDocAndRecentOps, project_id, doc_id, fromVersion, callback

	getDocAndFlushIfOldWithLock: (project_id, doc_id, callback = (error, doc) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.getDocAndFlushIfOld, project_id, doc_id, callback

	setDocWithLock: (project_id, doc_id, lines, source, user_id, undoing, callback = (error) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.setDoc, project_id, doc_id, lines, source, user_id, undoing, callback

	flushDocIfLoadedWithLock: (project_id, doc_id, callback = (error) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.flushDocIfLoaded, project_id, doc_id, callback

	flushAndDeleteDocWithLock: (project_id, doc_id, options, callback) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.flushAndDeleteDoc, project_id, doc_id, options, callback

	acceptChangesWithLock: (project_id, doc_id, change_ids, callback = (error) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.acceptChanges, project_id, doc_id, change_ids, callback

	deleteCommentWithLock: (project_id, doc_id, thread_id, callback = (error) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.deleteComment, project_id, doc_id, thread_id, callback

	renameDocWithLock: (project_id, doc_id, user_id, update, projectHistoryId, callback = (error) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.renameDoc, project_id, doc_id, user_id, update, projectHistoryId, callback

	resyncDocContentsWithLock: (project_id, doc_id, callback = (error) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.resyncDocContents, project_id, doc_id, callback
