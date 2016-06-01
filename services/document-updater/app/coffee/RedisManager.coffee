Settings = require('settings-sharelatex')
redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.web)
async = require('async')
_ = require('underscore')
keys = require('./RedisKeyBuilder')
logger = require('logger-sharelatex')
metrics = require('./Metrics')
Errors = require "./Errors"

redisOptions = _.clone(Settings.redis.web)
redisOptions.return_buffers = true

# Make times easy to read
minutes = 60 # seconds for Redis expire

module.exports = RedisManager =
	putDocInMemory : (project_id, doc_id, docLines, version, callback)->
		timer = new metrics.Timer("redis.put-doc")
		logger.log project_id:project_id, doc_id:doc_id, version: version, "putting doc in redis"
		async.parallel [
			(cb) ->
				multi = rclient.multi()
				multi.set keys.docLines(doc_id:doc_id), JSON.stringify(docLines)
				multi.set keys.projectKey({doc_id:doc_id}), project_id
				multi.set keys.docVersion(doc_id:doc_id), version
				multi.exec cb
			(cb) ->
				rclient.sadd keys.docsInProject(project_id:project_id), doc_id, cb
		], (err) ->
			timer.done()
			callback(err)

	removeDocFromMemory : (project_id, doc_id, callback)->
		logger.log project_id:project_id, doc_id:doc_id, "removing doc from redis"
		async.parallel [
			(cb) ->
				multi = rclient.multi()
				multi.del keys.docLines(doc_id:doc_id)
				multi.del keys.projectKey(doc_id:doc_id)
				multi.del keys.docVersion(doc_id:doc_id)
				multi.exec cb
			(cb) ->
				rclient.srem keys.docsInProject(project_id:project_id), doc_id, cb
		], (err) ->
			if err?
				logger.err project_id:project_id, doc_id:doc_id, err:err, "error removing doc from redis"
				callback(err, null)
			else
				logger.log project_id:project_id, doc_id:doc_id, "removed doc from redis"
				callback()

	getDoc : (doc_id, callback = (error, lines, version) ->)->
		timer = new metrics.Timer("redis.get-doc")
		multi = rclient.multi()
		multi.get keys.docLines(doc_id:doc_id)
		multi.get keys.docVersion(doc_id:doc_id)
		multi.exec (error, result)->
			timer.done()
			return callback(error) if error?
			try
				docLines = JSON.parse result[0]
			catch e
				return callback(e)
			version = parseInt(result[1] or 0, 10)
			callback null, docLines, version

	getDocVersion: (doc_id, callback = (error, version) ->) ->
		rclient.get keys.docVersion(doc_id: doc_id), (error, version) ->
			return callback(error) if error?
			version = parseInt(version, 10)
			callback null, version

	setDocument : (doc_id, docLines, version, callback = (error) ->)->
		multi = rclient.multi()
		multi.set keys.docLines(doc_id:doc_id), JSON.stringify(docLines)
		multi.set keys.docVersion(doc_id:doc_id), version
		multi.exec (error, replys) -> callback(error)

	getPendingUpdatesForDoc : (doc_id, callback)->
		multi = rclient.multi()
		multi.lrange keys.pendingUpdates(doc_id:doc_id), 0 , -1
		multi.del keys.pendingUpdates(doc_id:doc_id)
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
		rclient.llen keys.pendingUpdates(doc_id:doc_id), callback

	getPreviousDocOps: (doc_id, start, end, callback = (error, jsonOps) ->) ->
		rclient.llen keys.docOps(doc_id: doc_id), (error, length) ->
			return callback(error) if error?
			rclient.get keys.docVersion(doc_id: doc_id), (error, version) ->
				return callback(error) if error?
				version = parseInt(version, 10)
				first_version_in_redis = version - length

				if start < first_version_in_redis or end > version
					error = new Errors.OpRangeNotAvailableError("doc ops range is not loaded in redis")
					logger.warn {err: error, doc_id, length, version, start, end}, "doc ops range is not loaded in redis"
					return callback(error)

				start = start - first_version_in_redis
				if end > -1
					end = end - first_version_in_redis

				if isNaN(start) or isNaN(end)
					error = new Error("inconsistent version or lengths")
					logger.error {err: error, doc_id, length, version, start, end}, "inconsistent version or length"
					return callback(error)

				rclient.lrange keys.docOps(doc_id: doc_id), start, end, (error, jsonOps) ->
					return callback(error) if error?
					try
						ops = jsonOps.map (jsonOp) -> JSON.parse jsonOp
					catch e
						return callback(e)
					callback null, ops

	DOC_OPS_TTL: 60 * minutes
	DOC_OPS_MAX_LENGTH: 100
	pushDocOp: (doc_id, op, callback = (error, new_version) ->) ->
		jsonOp = JSON.stringify op
		multi = rclient.multi()
		multi.rpush  keys.docOps(doc_id: doc_id), jsonOp
		multi.expire keys.docOps(doc_id: doc_id), RedisManager.DOC_OPS_TTL
		multi.ltrim  keys.docOps(doc_id: doc_id), -RedisManager.DOC_OPS_MAX_LENGTH, -1
		multi.incr   keys.docVersion(doc_id: doc_id)
		multi.exec (error, replys) ->
			[_, __, ___, version] = replys
			return callback(error) if error?
			version = parseInt(version, 10)
			callback null, version

	pushUncompressedHistoryOp: (project_id, doc_id, op, callback = (error, length) ->) ->
		jsonOp = JSON.stringify op
		async.parallel [
			(cb) -> rclient.rpush keys.uncompressedHistoryOp(doc_id: doc_id), jsonOp, cb
			(cb) -> rclient.sadd keys.docsWithHistoryOps(project_id: project_id), doc_id, cb
		], (error, results) ->
			return callback(error) if error?
			[length, _] = results
			callback(error, length)

	getDocOpsLength: (doc_id, callback = (error, length) ->) ->
		rclient.llen keys.docOps(doc_id: doc_id), callback

	getDocIdsInProject: (project_id, callback = (error, doc_ids) ->) ->
		rclient.smembers keys.docsInProject(project_id: project_id), callback
