MongoManager = require "./MongoManager"
RedisManager = require "./RedisManager"
UpdateCompressor = require "./UpdateCompressor"
LockManager = require "./LockManager"
WebApiManager = require "./WebApiManager"
logger = require "logger-sharelatex"
async = require "async"

module.exports = UpdatesManager =
	compressAndSaveRawUpdates: (doc_id, rawUpdates, callback = (error) ->) ->
		length = rawUpdates.length
		if length == 0
			return callback()

		MongoManager.popLastCompressedUpdate doc_id, (error, lastCompressedUpdate) ->
			return callback(error) if error?

			# Ensure that raw updates start where lastCompressedUpdate left off
			if lastCompressedUpdate?
				rawUpdates = rawUpdates.slice(0)
				while rawUpdates[0]? and rawUpdates[0].v <= lastCompressedUpdate.v
					rawUpdates.shift()

				if rawUpdates[0]? and rawUpdates[0].v != lastCompressedUpdate.v + 1
					error = new Error("Tried to apply raw op at version #{rawUpdates[0].v} to last compressed update with version #{lastCompressedUpdate.v}")
					logger.error err: error, doc_id: doc_id, "inconsistent doc versions"
					# Push the update back into Mongo - catching errors at this
					# point is useless, we're already bailing
					MongoManager.insertCompressedUpdates doc_id, [lastCompressedUpdate], () ->
						return callback error
					return

			compressedUpdates = UpdateCompressor.compressRawUpdates lastCompressedUpdate, rawUpdates
			MongoManager.insertCompressedUpdates doc_id, compressedUpdates, (error) ->
				return callback(error) if error?
				logger.log doc_id: doc_id, rawUpdatesLength: length, compressedUpdatesLength: compressedUpdates.length, "compressed doc updates"
				callback()

	REDIS_READ_BATCH_SIZE: 100
	processUncompressedUpdates: (doc_id, callback = (error) ->) ->
		RedisManager.getOldestRawUpdates doc_id, UpdatesManager.REDIS_READ_BATCH_SIZE, (error, rawUpdates) ->
			return callback(error) if error?
			length = rawUpdates.length
			UpdatesManager.compressAndSaveRawUpdates doc_id, rawUpdates, (error) ->
				return callback(error) if error?
				logger.log doc_id: doc_id, "compressed and saved doc updates"
				RedisManager.deleteOldestRawUpdates doc_id, length, (error) ->
					return callback(error) if error?
					if length == UpdatesManager.REDIS_READ_BATCH_SIZE
						# There might be more updates
						logger.log doc_id: doc_id, "continuing processing updates"
						setTimeout () ->
							UpdatesManager.processUncompressedUpdates doc_id, callback
						, 0
					else
						logger.log doc_id: doc_id, "all raw updates processed"
						callback()

	processUncompressedUpdatesWithLock: (doc_id, callback = (error) ->) ->
		LockManager.runWithLock(
			"HistoryLock:#{doc_id}",
			(releaseLock) ->
				UpdatesManager.processUncompressedUpdates doc_id, releaseLock
			callback
		)

	getUpdates: (doc_id, options = {}, callback = (error, updates) ->) ->
		UpdatesManager.processUncompressedUpdatesWithLock doc_id, (error) ->
			return callback(error) if error?
			MongoManager.getUpdates doc_id, options, callback

	getUpdatesWithUserInfo: (doc_id, options = {}, callback = (error, updates) ->) ->
		UpdatesManager.getUpdates doc_id, options, (error, updates) ->
			return callback(error) if error?
			UpdatesManager.fillUserInfo updates, (error, updates) ->
				return callback(error) if error?
				callback null, updates

	fillUserInfo: (updates, callback = (error, updates) ->) ->
		users = {}
		for update in updates
			if UpdatesManager._validUserId(update.meta.user_id)
				users[update.meta.user_id] = true

		jobs = []
		for user_id, _ of users
			do (user_id) ->
				jobs.push (callback) ->
					WebApiManager.getUserInfo user_id, (error, userInfo) ->
						return callback(error) if error?
						users[user_id] = userInfo
						callback()

		async.series jobs, (error) ->
			return callback(error) if error?
			for update in updates
				user_id = update.meta.user_id
				delete update.meta.user_id
				if UpdatesManager._validUserId(user_id)
					update.meta.user = users[user_id]
			callback null, updates

	_validUserId: (user_id) ->
		if !user_id?
			return false
		else
			return !!user_id.match(/^[a-f0-9]{24}$/)
