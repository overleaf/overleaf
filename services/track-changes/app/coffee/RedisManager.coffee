Settings = require "settings-sharelatex"
redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.history)
Keys = Settings.redis.history.key_schema
async = require "async"

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
			multi.lrem Keys.uncompressedHistoryOps({doc_id}), 1, update
		multi.exec (error, results) ->
			return callback(error) if error?
			# It's ok to delete the doc_id from the set here. Even though the list
			# of updates may not be empty, we will continue to process it until it is.
			rclient.srem Keys.docsWithHistoryOps({project_id}), doc_id, (error) ->
				return callback(error) if error?
				callback null

	getDocIdsWithHistoryOps: (project_id, callback = (error, doc_ids) ->) ->
		rclient.smembers Keys.docsWithHistoryOps({project_id}), callback

	# iterate over keys asynchronously using redis scan (non-blocking)
	# handle all the cluster nodes or single redis server
	_getKeys: (pattern, callback) ->
		nodes = rclient.nodes?('master') || [ rclient ];
		doKeyLookupForNode = (node, cb) ->
			RedisManager._getKeysFromNode node, pattern, cb
		async.concatSeries nodes, doKeyLookupForNode, callback

	_getKeysFromNode: (node, pattern, callback) ->
		cursor = 0  # redis iterator
		keySet = {} # use hash to avoid duplicate results
		# scan over all keys looking for pattern
		doIteration = (cb) ->
			node.scan cursor, "MATCH", pattern, "COUNT", 1000, (error, reply) ->
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
	# or DocsWithHistoryOps:{57fd0b1f53a8396d22b2c24b} (for redis cluster)
	_extractIds: (keyList) ->
		ids = for key in keyList
			m = key.match(/:\{?([0-9a-f]{24})\}?/) # extract object id
			m[1]
		return ids

	getProjectIdsWithHistoryOps: (callback = (error, project_ids) ->) ->
		RedisManager._getKeys Keys.docsWithHistoryOps({project_id:"*"}), (error, project_keys) ->
			return callback(error) if error?
			project_ids = RedisManager._extractIds project_keys
			callback(error, project_ids)

	getAllDocIdsWithHistoryOps: (callback = (error, doc_ids) ->) ->
		# return all the docids, to find dangling history entries after
		# everything is flushed.
		RedisManager._getKeys Keys.uncompressedHistoryOps({doc_id:"*"}), (error, doc_keys) ->
			return callback(error) if error?
			doc_ids = RedisManager._extractIds doc_keys
			callback(error, doc_ids)
