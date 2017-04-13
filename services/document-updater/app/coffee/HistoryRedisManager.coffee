Settings = require('settings-sharelatex')
rclient = require("redis-sharelatex").createClient(Settings.redis.history)
Keys = Settings.redis.history.key_schema
async = require "async"
logger = require('logger-sharelatex')

module.exports = HistoryRedisManager =
	pushUncompressedHistoryOps: (project_id, doc_id, ops = [], callback = (error, length) ->) ->
		if ops.length == 0
			return callback(new Error("cannot push no ops")) # This should never be called with no ops, but protect against a redis error if we sent an empty array to rpush
		opVersions = ops.map (op) -> op?.v
		logger.log project_id: project_id, doc_id: doc_id, op_versions: opVersions, "pushing uncompressed history ops"
		jsonOps = ops.map (op) -> JSON.stringify op
		async.parallel [
			(cb) -> rclient.rpush Keys.uncompressedHistoryOps({doc_id}), jsonOps..., cb
			(cb) -> rclient.sadd Keys.docsWithHistoryOps({project_id}), doc_id, cb
		], (error, results) ->
			return callback(error) if error?
			[length, _] = results
			callback(error, length)