Settings = require('settings-sharelatex')
rclient = require("redis-sharelatex").createClient(Settings.redis.web)
async = require "async"

module.exports = WebRedisManager =
	getPendingUpdatesForDoc : (doc_id, callback)->
		multi = rclient.multi()
		multi.lrange "PendingUpdates:#{doc_id}", 0 , -1
		multi.del "PendingUpdates:#{doc_id}"
		multi.exec (error, replys) ->
			return callback(error) if error?
			jsonUpdates = replys[0]
			updates = []
			for jsonUpdate in jsonUpdates
				try
					update = JSON.parse jsonUpdate
				catch e
					return callback e
				updates.push update
			callback error, updates

	getUpdatesLength: (doc_id, callback)->
		rclient.llen "PendingUpdates:#{doc_id}", callback

	pushUncompressedHistoryOps: (project_id, doc_id, ops = [], callback = (error, length) ->) ->
		jsonOps = ops.map (op) -> JSON.stringify op
		async.parallel [
			(cb) -> rclient.rpush "UncompressedHistoryOps:#{doc_id}", jsonOps..., cb
			(cb) -> rclient.sadd "DocsWithHistoryOps:#{project_id}", doc_id, cb
		], (error, results) ->
			return callback(error) if error?
			[length, _] = results
			callback(error, length)