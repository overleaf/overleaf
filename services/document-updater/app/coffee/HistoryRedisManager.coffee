Settings = require('settings-sharelatex')
rclient = require("redis-sharelatex").createClient(Settings.redis.history)
Keys = Settings.redis.history.key_schema
logger = require('logger-sharelatex')

module.exports = HistoryRedisManager =
	recordDocHasHistoryOps: (project_id, doc_id, ops = [], callback = (error) ->) ->
		if ops.length == 0
			return callback(new Error("cannot push no ops")) # This should never be called with no ops, but protect against a redis error if we sent an empty array to rpush
		logger.log project_id: project_id, doc_id: doc_id, "marking doc in project for history ops"
		rclient.sadd Keys.docsWithHistoryOps({project_id}), doc_id, (error) ->
			return callback(error) if error?
			callback()
