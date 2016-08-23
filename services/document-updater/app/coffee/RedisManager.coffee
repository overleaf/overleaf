Settings = require('settings-sharelatex')
async = require('async')
rclient = require("./RedisBackend").createClient()
_ = require('underscore')
keys = require('./RedisKeyBuilder')
logger = require('logger-sharelatex')
metrics = require('./Metrics')
Errors = require "./Errors"

# Make times easy to read
minutes = 60 # seconds for Redis expire

module.exports = RedisManager =
	rclient: rclient

	putDocInMemory : (project_id, doc_id, docLines, version, _callback)->
		timer = new metrics.Timer("redis.put-doc")
		callback = (error) ->
			timer.done()
			_callback(error)
		logger.log project_id:project_id, doc_id:doc_id, version: version, "putting doc in redis"
		multi = rclient.multi()
		multi.set keys.docLines(doc_id:doc_id), JSON.stringify(docLines)
		multi.set keys.projectKey({doc_id:doc_id}), project_id
		multi.set keys.docVersion(doc_id:doc_id), version
		multi.exec (error) ->
			return callback(error) if error?
			rclient.sadd keys.docsInProject(project_id:project_id), doc_id, callback

	removeDocFromMemory : (project_id, doc_id, _callback)->
		logger.log project_id:project_id, doc_id:doc_id, "removing doc from redis"
		callback = (err) ->
			if err?
				logger.err project_id:project_id, doc_id:doc_id, err:err, "error removing doc from redis"
				_callback(err)
			else
				logger.log project_id:project_id, doc_id:doc_id, "removed doc from redis"
				_callback()

		multi = rclient.multi()
		multi.del keys.docLines(doc_id:doc_id)
		multi.del keys.projectKey(doc_id:doc_id)
		multi.del keys.docVersion(doc_id:doc_id)
		multi.exec (error) ->
			return callback(error) if error?
			rclient.srem keys.docsInProject(project_id:project_id), doc_id, callback

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

	getDocIdsInProject: (project_id, callback = (error, doc_ids) ->) ->
		rclient.smembers keys.docsInProject(project_id: project_id), callback

