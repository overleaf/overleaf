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

	# iterate over keys asynchronously using redis scan (non-blocking)
	_getKeys: (pattern, callback) ->
		cursor = 0  # redis iterator
		keySet = {} # use hash to avoid duplicate results
		# scan over all keys looking for pattern
		doIteration = (cb) ->
			rclient.scan cursor, "MATCH", pattern, "COUNT", 1000, (error, reply) ->
				return callback(error) if error?
				[cursor, keys] = reply
				for key in keys
					keySet[key] = true
				if cursor == '0'  # note redis returns string result not numeric
					return callback(null, Object.keys(keySet))
				else
					doIteration()
		doIteration()

	# extract ids from keys like DocsWithHistoryOps:57fd0b1f53a8396d22b2c24b
	_extractIds: (keyList) ->
		ids = (key.split(":")[1] for key in keyList)
		return ids

	# this will only work on single node redis, not redis cluster
	getProjectIdsWithHistoryOps: (callback = (error, project_ids) ->) ->
		RedisManager._getKeys docsWithHistoryOpsKey("*"), (error, project_keys) ->
			return callback(error) if error?
			project_ids = RedisManager._extractIds project_keys
			callback(error, project_ids)

	# this will only work on single node redis, not redis cluster
	getAllDocIdsWithHistoryOps: (callback = (error, doc_ids) ->) ->
		# return all the docids, to find dangling history entries after
		# everything is flushed.
		RedisManager._getKeys rawUpdatesKey("*"), (error, doc_keys) ->
			return callback(error) if error?
			doc_ids = RedisManager._extractIds doc_keys
			callback(error, doc_ids)
