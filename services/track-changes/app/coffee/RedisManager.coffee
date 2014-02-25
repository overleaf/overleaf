Settings = require "settings-sharelatex"
redis = require('redis')
redisConf = Settings.redis?.web or {host: "localhost", port: 6379}
rclient = redis.createClient(redisConf.port, redisConf.host)
rclient.auth(redisConf.password)

buildRawUpdatesKey = (doc_id) -> "UncompressedHistoryOps:#{doc_id}"

module.exports = RedisManager =
	getOldestRawUpdates: (doc_id, batchSize, callback = (error, rawUpdates) ->) ->
		key = buildRawUpdatesKey(doc_id)
		rclient.lrange key, 0, batchSize - 1, (error, jsonUpdates) -> 
			try
				rawUpdates = ( JSON.parse(update) for update in jsonUpdates or [] )
			catch e
				return callback(e)
			callback null, rawUpdates

	deleteOldestRawUpdates: (doc_id, batchSize, callback = (error, rawUpdates) ->) ->
		key = buildRawUpdatesKey(doc_id)
		rclient.ltrim key, batchSize, -1, callback
