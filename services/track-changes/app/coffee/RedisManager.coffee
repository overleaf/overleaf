Settings = require "settings-sharelatex"
redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.web)

rawUpdatesKey = (doc_id) -> "UncompressedHistoryOps:#{doc_id}"
docsWithHistoryOpsKey = (project_id) -> "DocsWithHistoryOps:#{project_id}"

module.exports = RedisManager =

	getOldestDocUpdates: (doc_id, batchSize, callback = (error, jsonUpdates) ->) ->
		key = rawUpdatesKey(doc_id)
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
			multi.lrem rawUpdatesKey(doc_id), 0, update
		# It's ok to delete the doc_id from the set here. Even though the list
		# of updates may not be empty, we will continue to process it until it is.
		multi.srem  docsWithHistoryOpsKey(project_id), doc_id
		multi.exec (error, results) ->
			return callback(error) if error?
			callback null

	getDocIdsWithHistoryOps: (project_id, callback = (error, doc_ids) ->) ->
		rclient.smembers docsWithHistoryOpsKey(project_id), callback
