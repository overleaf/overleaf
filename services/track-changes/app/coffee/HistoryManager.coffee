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

			# Ensure that raw updates start where lastCompressedUpdate left off
			if lastCompressedUpdate?
				rawUpdates = rawUpdates.slice(0)
				while rawUpdates[0]? and rawUpdates[0].v <= lastCompressedUpdate.v
					rawUpdates.shift()

				if rawUpdates[0]? and rawUpdates[0].v != lastCompressedUpdate.v + 1
					return callback new Error("Tried to apply raw op at version #{rawUpdates[0].v} to last compressed update with version #{lastCompressedUpdate.v}")

			compressedUpdates = UpdateCompressor.compressRawUpdates lastCompressedUpdate, rawUpdates
			MongoManager.insertCompressedUpdates doc_id, compressedUpdates, (error) ->
				return callback(error) if error?
				logger.log doc_id: doc_id, rawUpdatesLength: length, compressedUpdatesLength: compressedUpdates.length, "compressed doc updates"
				callback()

	REDIS_READ_BATCH_SIZE: 100
	processUncompressedUpdates: (doc_id, callback = (error) ->) ->
		RedisManager.getOldestRawUpdates doc_id, HistoryManager.REDIS_READ_BATCH_SIZE, (error, rawUpdates) ->
			return callback(error) if error?
			length = rawUpdates.length
			HistoryManager.compressAndSaveRawUpdates doc_id, rawUpdates, (error) ->
				return callback(error) if error?
				RedisManager.deleteOldestRawUpdates doc_id, HistoryManager.REDIS_READ_BATCH_SIZE, (error) ->
					return callback(error) if error?
					if length == HistoryManager.REDIS_READ_BATCH_SIZE
						# There might be more updates
						setTimeout () ->
							HistoryManager.processUncompressedUpdates doc_id, callback
						, 0
					else
						callback()

	processUncompressedUpdatesWithLock: (doc_id, callback = (error) ->) ->
		LockManager.runWithLock(
			"HistoryLock:#{doc_id}",
			HistoryManager.processUncompressedUpdates,
			callback
		)

