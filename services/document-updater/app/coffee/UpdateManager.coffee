LockManager = require "./LockManager"
RedisManager = require "./RedisManager"
ShareJsUpdateManager = require "./ShareJsUpdateManager"
Settings = require('settings-sharelatex')
async = require("async")
logger = require('logger-sharelatex')
Metrics = require "./Metrics"

module.exports = UpdateManager =
	resumeProcessing: (callback = (error) ->) ->
		RedisManager.getDocsWithPendingUpdates (error, docs) =>
			return callback(error) if error?
			jobs = for doc in (docs or [])
				do (doc) =>
					(callback) => @processOutstandingUpdatesWithLock doc.project_id, doc.doc_id, callback

			async.parallelLimit jobs, 5, callback

	processOutstandingUpdates: (project_id, doc_id, _callback = (error) ->) ->
		timer = new Metrics.Timer("updateManager.processOutstandingUpdates")
		callback = (args...) ->
			timer.done()
			_callback(args...)
		
		UpdateManager.fetchAndApplyUpdates project_id, doc_id, (error) =>
			return callback(error) if error?
			RedisManager.clearDocFromPendingUpdatesSet project_id, doc_id, (error) =>
				return callback(error) if error?
				callback()

	processOutstandingUpdatesWithLock: (project_id, doc_id, callback = (error) ->) ->
		LockManager.tryLock doc_id, (error, gotLock) =>
			return callback(error) if error?
			return callback() if !gotLock
			UpdateManager.processOutstandingUpdates project_id, doc_id, (error) ->
				return UpdateManager._handleErrorInsideLock(doc_id, error, callback) if error?
				LockManager.releaseLock doc_id, (error) =>
					return callback(error) if error?
					UpdateManager.continueProcessingUpdatesWithLock project_id, doc_id, callback

	continueProcessingUpdatesWithLock: (project_id, doc_id, callback = (error) ->) ->
		RedisManager.getUpdatesLength doc_id, (error, length) =>
			return callback(error) if error?
			if length > 0
				UpdateManager.processOutstandingUpdatesWithLock project_id, doc_id, callback
			else
				callback()

	fetchAndApplyUpdates: (project_id, doc_id, callback = (error) ->) ->
		RedisManager.getPendingUpdatesForDoc doc_id, (error, updates) =>
			return callback(error) if error?
			if updates.length == 0
				return callback()
			UpdateManager.applyUpdates project_id, doc_id, updates, callback

	applyUpdates: (project_id, doc_id, updates, callback = (error) ->) ->
		ShareJsUpdateManager.applyUpdates project_id, doc_id, updates, (error, updatedDocLines, version) ->
			return callback(error) if error?
			logger.log doc_id: doc_id, version: version, "updating doc via sharejs"
			RedisManager.setDocument doc_id, updatedDocLines, version, callback

	lockUpdatesAndDo: (method, project_id, doc_id, args..., callback) ->
		LockManager.getLock doc_id, (error) ->
			return callback(error) if error?
			UpdateManager.processOutstandingUpdates project_id, doc_id, (error) ->
				return UpdateManager._handleErrorInsideLock(doc_id, error, callback) if error?
				method project_id, doc_id, args..., (error, response_args...) ->
					return UpdateManager._handleErrorInsideLock(doc_id, error, callback) if error?
					LockManager.releaseLock doc_id, (error) ->
						return callback(error) if error?
						callback null, response_args...
						# We held the lock for a while so updates might have queued up
						UpdateManager.continueProcessingUpdatesWithLock project_id, doc_id

	_handleErrorInsideLock: (doc_id, original_error, callback = (error) ->) ->
		LockManager.releaseLock doc_id, (lock_error) ->
			callback(original_error)

			
