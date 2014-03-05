MongoManager = require "./MongoManager"
RedisManager = require "./RedisManager"
UpdateCompressor = require "./UpdateCompressor"
LockManager = require "./LockManager"
logger = require "logger-sharelatex"

module.exports = HistoryManager =
	compressAndSaveRawUpdates: (doc_id, rawUpdates, callback = (error) ->) ->
		length = rawUpdates.length
		if length == 0
			return callback()

		MongoManager.popLastCompressedUpdate doc_id, (error, lastCompressedUpdate) ->
			return callback(error) if error?
			logger.log doc_id: doc_id, "popped last update"

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
		logger.log "processUncompressedUpdates"
		RedisManager.getOldestRawUpdates doc_id, HistoryManager.REDIS_READ_BATCH_SIZE, (error, rawUpdates) ->
			return callback(error) if error?
			length = rawUpdates.length
			logger.log doc_id: doc_id, length: length, "got raw updates from redis"
			HistoryManager.compressAndSaveRawUpdates doc_id, rawUpdates, (error) ->
				return callback(error) if error?
				logger.log doc_id: doc_id, "compressed and saved doc updates"
				RedisManager.deleteOldestRawUpdates doc_id, length, (error) ->
					return callback(error) if error?
					if length == HistoryManager.REDIS_READ_BATCH_SIZE
						# There might be more updates
						logger.log doc_id: doc_id, "continuing processing updates"
						setTimeout () ->
							HistoryManager.processUncompressedUpdates doc_id, callback
						, 0
					else
						logger.log doc_id: doc_id, "all raw updates processed"
						callback()

	processUncompressedUpdatesWithLock: (doc_id, callback = (error) ->) ->
		LockManager.runWithLock(
			"HistoryLock:#{doc_id}",
			(releaseLock) ->
				HistoryManager.processUncompressedUpdates doc_id, releaseLock
			callback
		)

