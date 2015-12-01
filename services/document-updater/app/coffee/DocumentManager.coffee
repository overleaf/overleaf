RedisManager = require "./RedisManager"
PersistenceManager = require "./PersistenceManager"
DocOpsManager = require "./DocOpsManager"
DiffCodec = require "./DiffCodec"
logger = require "logger-sharelatex"
Metrics = require "./Metrics"

module.exports = DocumentManager =
	getDoc: (project_id, doc_id, _callback = (error, lines, version) ->) ->
		timer = new Metrics.Timer("docManager.getDoc")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		RedisManager.getDoc doc_id, (error, lines, version) ->
			return callback(error) if error?
			if !lines? or !version?
				logger.log project_id: project_id, doc_id: doc_id, "doc not in redis so getting from persistence API"
				PersistenceManager.getDoc project_id, doc_id, (error, lines, version) ->
					return callback(error) if error?
					logger.log project_id: project_id, doc_id: doc_id, lines: lines, version: version, "got doc from persistence API"
					RedisManager.putDocInMemory project_id, doc_id, lines, version, (error) ->
						return callback(error) if error?
						callback null, lines, version
			else
				callback null, lines, version

	getDocAndRecentOps: (project_id, doc_id, fromVersion, _callback = (error, lines, version, recentOps) ->) ->
		timer = new Metrics.Timer("docManager.getDocAndRecentOps")
		callback = (args...) ->
			timer.done()
			_callback(args...)
		
		DocumentManager.getDoc project_id, doc_id, (error, lines, version) ->
			return callback(error) if error?
			if fromVersion == -1
				callback null, lines, version, []
			else
				DocOpsManager.getPreviousDocOps project_id, doc_id, fromVersion, version, (error, ops) ->
					return callback(error) if error?
					callback null, lines, version, ops

	setDoc: (project_id, doc_id, newLines, source, user_id, _callback = (error) ->) ->
		timer = new Metrics.Timer("docManager.setDoc")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		if !newLines?
			return callback(new Error("No lines were provided to setDoc"))

		UpdateManager = require "./UpdateManager"
		DocumentManager.getDoc project_id, doc_id, (error, oldLines, version) ->
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
				UpdateManager.applyUpdates project_id, doc_id, [update], (error) ->
					return callback(error) if error?
					DocumentManager.flushDocIfLoaded project_id, doc_id, (error) ->
						return callback(error) if error?
						callback null
		

	flushDocIfLoaded: (project_id, doc_id, _callback = (error) ->) ->
		timer = new Metrics.Timer("docManager.flushDocIfLoaded")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		RedisManager.getDoc doc_id, (error, lines, version) ->
			return callback(error) if error?
			if !lines? or !version?
				logger.log project_id: project_id, doc_id: doc_id, "doc is not loaded so not flushing"
				callback null
			else
				logger.log project_id: project_id, doc_id: doc_id, version: version, "flushing doc"
				PersistenceManager.setDoc project_id, doc_id, lines, version, (error) ->
					return callback(error) if error?
					callback null

	flushAndDeleteDoc: (project_id, doc_id, _callback = (error) ->) ->
		timer = new Metrics.Timer("docManager.flushAndDeleteDoc")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		DocumentManager.flushDocIfLoaded project_id, doc_id, (error) ->
			return callback(error) if error?
			RedisManager.removeDocFromMemory project_id, doc_id, (error) ->
				return callback(error) if error?
				callback null

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
