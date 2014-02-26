RedisManager = require "./RedisManager"
mongojs = require("./mongojs")
db = mongojs.db
ObjectId = mongojs.ObjectId
logger = require "logger-sharelatex"
async = require "async"
Metrics = require("./Metrics")

module.exports = DocOpsManager =
	flushDocOpsToMongo: (project_id, doc_id, _callback = (error) ->) ->
		timer = new Metrics.Timer("docOpsManager.flushDocOpsToMongo")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		DocOpsManager.getDocVersionInMongo doc_id, (error, mongoVersion) ->
			return callback(error) if error?
			RedisManager.getDocVersion doc_id, (error, redisVersion) ->
				return callback(error) if error?
				if !mongoVersion? or !redisVersion? or mongoVersion > redisVersion
					logger.error doc_id: doc_id, redisVersion: redisVersion, mongoVersion: mongoVersion, "mongo version is ahead of redis"
					return callback(new Error("inconsistent versions"))

				RedisManager.getPreviousDocOps doc_id, mongoVersion, -1, (error, ops) ->
					return callback(error) if error?
					if ops.length != redisVersion - mongoVersion
						logger.error doc_id: doc_id, redisVersion: redisVersion, mongoVersion: mongoVersion, opsLength: ops.length, "version difference does not match ops length"
						return callback(new Error("inconsistent versions"))
					logger.log doc_id: doc_id, redisVersion: redisVersion, mongoVersion: mongoVersion, "flushing doc ops to mongo"
					DocOpsManager._appendDocOpsInMongo doc_id, ops, redisVersion, (error) ->
						return callback(error) if error?
						callback null

	getPreviousDocOps: (project_id, doc_id, start, end, _callback = (error, ops) ->) ->
		timer = new Metrics.Timer("docOpsManager.getPreviousDocOps")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		DocOpsManager._ensureOpsAreLoaded project_id, doc_id, start, (error) ->
			return callback(error) if error?
			RedisManager.getPreviousDocOps doc_id, start, end, (error, ops) ->
				return callback(error) if error?
				callback null, ops

	pushDocOp: (project_id, doc_id, op, callback = (error) ->) ->
		RedisManager.pushDocOp doc_id, op, (error, version) ->
			return callback(error) if error?
			RedisManager.pushUncompressedHistoryOp doc_id, op, (error) ->
				return callback(error) if error?
				callback null, version

	_ensureOpsAreLoaded: (project_id, doc_id, backToVersion, callback = (error) ->) ->
		RedisManager.getDocVersion doc_id, (error, redisVersion) ->
			return callback(error) if error?
			RedisManager.getDocOpsLength doc_id, (error, opsLength) ->
				return callback(error) if error?
				oldestVersionInRedis = redisVersion - opsLength
				if oldestVersionInRedis > backToVersion
					# _getDocOpsFromMongo(<id>, 4, 6, ...) will return the ops in positions 4 and 5, but not 6.
					logger.log doc_id: doc_id, backToVersion: backToVersion, oldestVersionInRedis: oldestVersionInRedis, "loading old ops from mongo"
					DocOpsManager._getDocOpsFromMongo doc_id, backToVersion, oldestVersionInRedis, (error, ops) ->
						logger.log doc_id: doc_id, backToVersion: backToVersion, oldestVersionInRedis: oldestVersionInRedis, ops: ops, "loaded old ops from mongo"
						return callback(error) if error?
						RedisManager.prependDocOps doc_id, ops, (error) ->
							return callback(error) if error?
							callback null
				else
					logger.log doc_id: doc_id, backToVersion: backToVersion, oldestVersionInRedis: oldestVersionInRedis, "ops already in redis"
					callback()

	getDocVersionInMongo: (doc_id, callback = (error, version) ->) ->
		t = new Metrics.Timer("mongo-time")
		db.docOps.find {
			doc_id: ObjectId(doc_id)
		}, {
			version: 1
		}, (error, docs) ->
			t.done()
			return callback(error) if error?
			if docs.length < 1 or !docs[0].version?
				return callback null, 0
			else
				return callback null, docs[0].version

	APPEND_OPS_BATCH_SIZE: 100

	_appendDocOpsInMongo: (doc_id, docOps, newVersion, callback = (error) ->) ->
		currentVersion = newVersion - docOps.length
		batchSize = DocOpsManager.APPEND_OPS_BATCH_SIZE
		noOfBatches = Math.ceil(docOps.length / batchSize)
		if noOfBatches <= 0
			return callback()
		jobs = []
		for batchNo in [0..(noOfBatches-1)]
			do (batchNo) ->
				jobs.push (callback) ->
					batch = docOps.slice(batchNo * batchSize, (batchNo + 1) * batchSize)
					currentVersion += batch.length
					logger.log doc_id: doc_id, batchNo: batchNo, "appending doc op batch to Mongo"
					t = new Metrics.Timer("mongo-time")
					db.docOps.update {
						doc_id: ObjectId(doc_id)
					}, {
						$push: docOps: { $each: batch, $slice: -100 }
						$set: version: currentVersion
					}, {
						upsert: true
					}, (err)->
						t.done()
						callback(err)

		async.series jobs, (error) -> callback(error)

	_getDocOpsFromMongo: (doc_id, start, end, callback = (error, ops) ->) ->
		DocOpsManager.getDocVersionInMongo doc_id, (error, version) ->
			return callback(error) if error?
			offset = - (version - start) # Negative tells mongo to count from the end backwards
			limit = end - start
			t = new Metrics.Timer("mongo-time")
			db.docOps.find {
				doc_id: ObjectId(doc_id)
			}, {
				docOps: $slice: [offset, limit]
			}, (error, docs) ->
				t.done()
				if docs.length < 1 or !docs[0].docOps?
					return callback null, []
				else
					return callback null, docs[0].docOps
		
