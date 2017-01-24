RedisManager = require "./RedisManager"
PersistenceManager = require "./PersistenceManager"
DiffCodec = require "./DiffCodec"
logger = require "logger-sharelatex"
Metrics = require "./Metrics"
HistoryManager = require "./HistoryManager"
WebRedisManager = require "./WebRedisManager"
Errors = require "./Errors"
RangesManager = require "./RangesManager"

module.exports = DocumentManager =
	getDoc: (project_id, doc_id, _callback = (error, lines, version, alreadyLoaded) ->) ->
		timer = new Metrics.Timer("docManager.getDoc")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		RedisManager.getDoc project_id, doc_id, (error, lines, version, ranges) ->
			return callback(error) if error?
			if !lines? or !version?
				logger.log {project_id, doc_id}, "doc not in redis so getting from persistence API"
				PersistenceManager.getDoc project_id, doc_id, (error, lines, version, ranges) ->
					return callback(error) if error?
					logger.log {project_id, doc_id, lines, version}, "got doc from persistence API"
					RedisManager.putDocInMemory project_id, doc_id, lines, version, ranges, (error) ->
						return callback(error) if error?
						callback null, lines, version, ranges, false
			else
				callback null, lines, version, ranges, true

	getDocAndRecentOps: (project_id, doc_id, fromVersion, _callback = (error, lines, version, recentOps, ranges) ->) ->
		timer = new Metrics.Timer("docManager.getDocAndRecentOps")
		callback = (args...) ->
			timer.done()
			_callback(args...)
		
		DocumentManager.getDoc project_id, doc_id, (error, lines, version, ranges) ->
			return callback(error) if error?
			if fromVersion == -1
				callback null, lines, version, [], ranges
			else
				RedisManager.getPreviousDocOps doc_id, fromVersion, version, (error, ops) ->
					return callback(error) if error?
					callback null, lines, version, ops, ranges

	setDoc: (project_id, doc_id, newLines, source, user_id, _callback = (error) ->) ->
		timer = new Metrics.Timer("docManager.setDoc")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		if !newLines?
			return callback(new Error("No lines were provided to setDoc"))

		UpdateManager = require "./UpdateManager"
		DocumentManager.getDoc project_id, doc_id, (error, oldLines, version, ranges, alreadyLoaded) ->
			return callback(error) if error?
			
			if oldLines? and oldLines.length > 0 and oldLines[0].text?
				logger.log doc_id: doc_id, project_id: project_id, oldLines: oldLines, newLines: newLines, "document is JSON so not updating"
				return callback(null)

			logger.log doc_id: doc_id, project_id: project_id, oldLines: oldLines, newLines: newLines, "setting a document via http"
			DiffCodec.diffAsShareJsOp oldLines, newLines, (error, op) ->
				return callback(error) if error?
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
						DocumentManager.flushAndDeleteDoc project_id, doc_id, (error) ->
							return callback(error) if error?
							callback null

	flushDocIfLoaded: (project_id, doc_id, _callback = (error) ->) ->
		timer = new Metrics.Timer("docManager.flushDocIfLoaded")
		callback = (args...) ->
			timer.done()
			_callback(args...)
		RedisManager.getDoc project_id, doc_id, (error, lines, version, ranges) ->
			return callback(error) if error?
			if !lines? or !version?
				logger.log project_id: project_id, doc_id: doc_id, "doc is not loaded so not flushing"
				callback null  # TODO: return a flag to bail out, as we go on to remove doc from memory?
			else
				logger.log project_id: project_id, doc_id: doc_id, version: version, "flushing doc"
				PersistenceManager.setDoc project_id, doc_id, lines, version, ranges, (error) ->
					return callback(error) if error?
					callback null

	flushAndDeleteDoc: (project_id, doc_id, _callback = (error) ->) ->
		timer = new Metrics.Timer("docManager.flushAndDeleteDoc")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		DocumentManager.flushDocIfLoaded project_id, doc_id, (error) ->
			return callback(error) if error?
			
			# Flush in the background since it requires and http request
			# to track changes
			HistoryManager.flushDocChanges project_id, doc_id, (err) ->
				if err?
					logger.err {err, project_id, doc_id}, "error flushing to track changes"

			RedisManager.removeDocFromMemory project_id, doc_id, (error) ->
				return callback(error) if error?
				callback null
	
	acceptChange: (project_id, doc_id, change_id, _callback = (error) ->) ->
		timer = new Metrics.Timer("docManager.acceptChange")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		DocumentManager.getDoc project_id, doc_id, (error, lines, version, ranges) ->
			return callback(error) if error?
			if !lines? or !version?
				return callback(new Errors.NotFoundError("document not found: #{doc_id}"))
			RangesManager.acceptChange change_id, ranges, (error, new_ranges) ->
				return callback(error) if error?
				RedisManager.updateDocument doc_id, lines, version, [], new_ranges, (error) ->
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
				RedisManager.updateDocument doc_id, lines, version, [], new_ranges, (error) ->
					return callback(error) if error?
					callback()

	getDocWithLock: (project_id, doc_id, callback = (error, lines, version) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.getDoc, project_id, doc_id, callback
		
	getDocAndRecentOpsWithLock: (project_id, doc_id, fromVersion, callback = (error, lines, version) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.getDocAndRecentOps, project_id, doc_id, fromVersion, callback
		
	setDocWithLock: (project_id, doc_id, lines, source, user_id, callback = (error) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.setDoc, project_id, doc_id, lines, source, user_id, callback
		
	flushDocIfLoadedWithLock: (project_id, doc_id, callback = (error) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.flushDocIfLoaded, project_id, doc_id, callback

	flushAndDeleteDocWithLock: (project_id, doc_id, callback = (error) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.flushAndDeleteDoc, project_id, doc_id, callback

	acceptChangeWithLock: (project_id, doc_id, change_id, callback = (error) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.acceptChange, project_id, doc_id, change_id, callback

	deleteCommentWithLock: (project_id, doc_id, thread_id, callback = (error) ->) ->
		UpdateManager = require "./UpdateManager"
		UpdateManager.lockUpdatesAndDo DocumentManager.deleteComment, project_id, doc_id, thread_id, callback
