Settings = require "settings-sharelatex"
redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.history)
Keys = Settings.redis.history.key_schema

module.exports = RedisManager =

	getOldestDocUpdates: (doc_id, batchSize, callback = (error, jsonUpdates) ->) ->
		key = Keys.uncompressedHistoryOps({doc_id})
		rclient.lrange key, 0, batchSize - 1, callback

	expandDocUpdates: (jsonUpdates, callback = (error, rawUpdates) ->) ->
		try
			rawUpdates = ( JSON.parse(update) for update in jsonUpdates or [] )
		catch e
			return callback(e)
		callback null, rawUpdates

	deleteAppliedDocUpdates: (project_id, doc_id, docUpdates, callback = (error) ->) ->
		multi = rclient.multi()
		# Delete all the updates which have been applied (exact match)
		for update in docUpdates or []
			multi.lrem Keys.uncompressedHistoryOps({doc_id}), 0, update
		multi.exec (error, results) ->
			return callback(error) if error?
			# It's ok to delete the doc_id from the set here. Even though the list
			# of updates may not be empty, we will continue to process it until it is.
			rclient.srem Keys.docsWithHistoryOps({project_id}), doc_id, (error) ->
				return callback(error) if error?
				callback null

	getDocIdsWithHistoryOps: (project_id, callback = (error, doc_ids) ->) ->
		rclient.smembers Keys.docsWithHistoryOps({project_id}), callback
