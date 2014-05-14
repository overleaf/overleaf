RedisManager = require "./RedisManager"
TrackChangesManager = require "./TrackChangesManager"

module.exports = DocOpsManager =
	getPreviousDocOps: (project_id, doc_id, start, end, callback = (error, ops) ->) ->
		RedisManager.getPreviousDocOps doc_id, start, end, (error, ops) ->
			return callback(error) if error?
			callback null, ops

	pushDocOp: (project_id, doc_id, op, callback = (error) ->) ->
		RedisManager.pushDocOp doc_id, op, (error, version) ->
			return callback(error) if error?
			TrackChangesManager.pushUncompressedHistoryOp project_id, doc_id, op, (error) ->
				return callback(error) if error?
				callback null, version


