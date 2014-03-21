Settings = require "settings-sharelatex"
redis = require('redis')
redisConf = Settings.redis?.web or {host: "localhost", port: 6379}
rclient = redis.createClient(redisConf.port, redisConf.host)
rclient.auth(redisConf.password)

rawUpdatesKey = (doc_id) -> "UncompressedHistoryOps:#{doc_id}"
docsWithHistoryOpsKey = (project_id) -> "DocsWithHistoryOps:#{project_id}"

module.exports = RedisManager =
	getOldestRawUpdates: (doc_id, batchSize, callback = (error, rawUpdates) ->) ->
		key = rawUpdatesKey(doc_id)
		rclient.lrange key, 0, batchSize - 1, (error, jsonUpdates) -> 
			try
				rawUpdates = ( JSON.parse(update) for update in jsonUpdates or [] )
			catch e
				return callback(e)
			callback null, rawUpdates

	deleteOldestRawUpdates: (project_id, doc_id, batchSize, callback = (error) ->) ->
		# It's ok to delete the doc_id from the set here. Even though the list
		# of updates may not be empty, we will continue to process it until it is.
		multi = rclient.multi()
		multi.ltrim rawUpdatesKey(doc_id), batchSize, -1
		multi.srem  docsWithHistoryOpsKey(project_id), doc_id
		multi.exec (error, results) ->
			return callback(error) if error?
			callback null
