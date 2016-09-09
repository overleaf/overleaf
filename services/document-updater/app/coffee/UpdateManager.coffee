LockManager = require "./LockManager"
RedisManager = require "./RedisManager"
WebRedisManager = require "./WebRedisManager"
ShareJsUpdateManager = require "./ShareJsUpdateManager"
TrackChangesManager = require "./TrackChangesManager"
Settings = require('settings-sharelatex')
async = require("async")
logger = require('logger-sharelatex')
Metrics = require "./Metrics"

module.exports = UpdateManager =
	processOutstandingUpdates: (project_id, doc_id, callback = (error) ->) ->
		timer = new Metrics.Timer("updateManager.processOutstandingUpdates")
		UpdateManager.fetchAndApplyUpdates project_id, doc_id, (error) ->
			timer.done()
			return callback(error) if error?
			callback()

	processOutstandingUpdatesWithLock: (project_id, doc_id, callback = (error) ->) ->
		LockManager.tryLock doc_id, (error, gotLock, lockValue) =>
			return callback(error) if error?
			return callback() if !gotLock
			UpdateManager.processOutstandingUpdates project_id, doc_id, (error) ->
				return UpdateManager._handleErrorInsideLock(doc_id, lockValue, error, callback) if error?
				LockManager.releaseLock doc_id, lockValue, (error) =>
					return callback(error) if error?
					UpdateManager.continueProcessingUpdatesWithLock project_id, doc_id, callback

	continueProcessingUpdatesWithLock: (project_id, doc_id, callback = (error) ->) ->
		WebRedisManager.getUpdatesLength doc_id, (error, length) =>
			return callback(error) if error?
			if length > 0
				UpdateManager.processOutstandingUpdatesWithLock project_id, doc_id, callback
			else
				callback()

	fetchAndApplyUpdates: (project_id, doc_id, callback = (error) ->) ->
		WebRedisManager.getPendingUpdatesForDoc doc_id, (error, updates) =>
			return callback(error) if error?
			if updates.length == 0
				return callback()
			async.eachSeries updates,
				(update, cb) -> UpdateManager.applyUpdate project_id, doc_id, update, cb
				callback

	applyUpdate: (project_id, doc_id, update, callback = (error) ->) ->
		UpdateManager._sanitizeUpdate update
		ShareJsUpdateManager.applyUpdate project_id, doc_id, update, (error, updatedDocLines, version, appliedOps) ->
			return callback(error) if error?
			logger.log doc_id: doc_id, version: version, "updating doc in redis"
			RedisManager.updateDocument doc_id, updatedDocLines, version, appliedOps, (error) ->
				return callback(error) if error?
				TrackChangesManager.pushUncompressedHistoryOps project_id, doc_id, appliedOps, callback

	lockUpdatesAndDo: (method, project_id, doc_id, args..., callback) ->
		LockManager.getLock doc_id, (error, lockValue) ->
			return callback(error) if error?
			UpdateManager.processOutstandingUpdates project_id, doc_id, (error) ->
				return UpdateManager._handleErrorInsideLock(doc_id, lockValue, error, callback) if error?
				method project_id, doc_id, args..., (error, response_args...) ->
					return UpdateManager._handleErrorInsideLock(doc_id, lockValue, error, callback) if error?
					LockManager.releaseLock doc_id, lockValue, (error) ->
						return callback(error) if error?
						callback null, response_args...
						# We held the lock for a while so updates might have queued up
						UpdateManager.continueProcessingUpdatesWithLock project_id, doc_id

	_handleErrorInsideLock: (doc_id, lockValue, original_error, callback = (error) ->) ->
		LockManager.releaseLock doc_id, lockValue, (lock_error) ->
			callback(original_error)
	
	_sanitizeUpdate: (update) ->
		# In Javascript, characters are 16-bits wide. It does not understand surrogates as characters.
		# 
		# From Wikipedia (http://en.wikipedia.org/wiki/Plane_(Unicode)#Basic_Multilingual_Plane):
		# "The High Surrogates (U+D800–U+DBFF) and Low Surrogate (U+DC00–U+DFFF) codes are reserved
		# for encoding non-BMP characters in UTF-16 by using a pair of 16-bit codes: one High Surrogate
		# and one Low Surrogate. A single surrogate code point will never be assigned a character.""
		# 
		# The main offender seems to be \uD835 as a stand alone character, which would be the first
		# 16-bit character of a blackboard bold character (http://www.fileformat.info/info/unicode/char/1d400/index.htm).
		# Something must be going on client side that is screwing up the encoding and splitting the
		# two 16-bit characters so that \uD835 is standalone.
		for op in update.op or []
			if op.i?
				# Replace high and low surrogate characters with 'replacement character' (\uFFFD)
				op.i = op.i.replace(/[\uD800-\uDFFF]/g, "\uFFFD")
		return update

