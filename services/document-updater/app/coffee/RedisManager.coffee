Settings = require('settings-sharelatex')
redis = require('redis')
redisConf = Settings.redis.web
rclient = redis.createClient(redisConf.port, redisConf.host)
rclient.auth(redisConf.password)
async = require('async')
_ = require('underscore')
keys = require('./RedisKeyBuilder')
logger = require('logger-sharelatex')
metrics = require('./Metrics')

# Make times easy to read
minutes = 60 # seconds for Redis expire

module.exports = RedisManager =
	putDocInMemory : (project_id, doc_id, docLines, version, callback)->
		timer = new metrics.Timer("redis.put-doc")
		logger.log project_id:project_id, doc_id:doc_id, docLines:docLines, version: version, "putting doc in redis"
		multi = rclient.multi()
		multi.set keys.docLines(doc_id:doc_id), JSON.stringify(docLines)
		multi.set keys.projectKey({doc_id:doc_id}), project_id
		multi.set keys.docVersion(doc_id:doc_id), version
		multi.sadd keys.allDocs, doc_id
		multi.sadd keys.docsInProject(project_id:project_id), doc_id
		multi.exec (err, replys)->
			timer.done()
			callback(err)

	removeDocFromMemory : (project_id, doc_id, callback)->
		logger.log project_id:project_id, doc_id:doc_id, "removing doc from redis"
		multi = rclient.multi()
		multi.get keys.docLines(doc_id:doc_id)
		multi.del keys.docLines(doc_id:doc_id)
		multi.del keys.projectKey(doc_id:doc_id)
		multi.del keys.docVersion(doc_id:doc_id)
		multi.srem keys.docsInProject(project_id:project_id), doc_id
		multi.srem keys.allDocs, doc_id
		multi.exec (err, replys)->
			if err?
				logger.err project_id:project_id, doc_id:doc_id, err:err, "error removing doc from redis"
				callback(err, null)
			else
				docLines = replys[0]
				logger.log project_id:project_id, doc_id:doc_id, docLines:docLines, "removed doc from redis"
				callback()

	getDoc : (doc_id, callback = (error, lines, version) ->)->
		timer = new metrics.Timer("redis.get-doc")
		multi = rclient.multi()
		linesKey = keys.docLines(doc_id:doc_id)
		multi.get linesKey
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

	getCountOfDocsInMemory : (callback)->
		rclient.smembers keys.allDocs, (err, members)->
			len = members.length
			callback null, len

	setDocument : (doc_id, docLines, version, callback = (error) ->)->
		multi = rclient.multi()
		multi.set keys.docLines(doc_id:doc_id), JSON.stringify(docLines)
		multi.set keys.docVersion(doc_id:doc_id), version
		multi.incr keys.now("docsets")
		multi.exec (error, replys) -> callback(error)

	getPendingUpdatesForDoc : (doc_id, callback)->
		multi = rclient.multi()
		multi.lrange keys.pendingUpdates(doc_id:doc_id), 0 , -1
		multi.del keys.pendingUpdates(doc_id:doc_id)
		multi.exec (error, replys) ->
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

	getDocsWithPendingUpdates: (callback = (error, docs) ->) ->
		rclient.smembers keys.docsWithPendingUpdates, (error, doc_keys) ->
			return callback(error) if error?
			docs = doc_keys.map (doc_key) ->
				[project_id, doc_id] = keys.splitProjectIdAndDocId(doc_key)
				return {
					doc_id: doc_id
					project_id: project_id
				}
			callback null, docs

	clearDocFromPendingUpdatesSet: (project_id, doc_id, callback = (error) ->) ->
		doc_key = keys.combineProjectIdAndDocId(project_id, doc_id)
		rclient.srem keys.docsWithPendingUpdates, doc_key, callback

	getPreviousDocOps: (doc_id, start, end, callback = (error, jsonOps) ->) ->
		rclient.llen keys.docOps(doc_id: doc_id), (error, length) ->
			return callback(error) if error?
			rclient.get keys.docVersion(doc_id: doc_id), (error, version) ->
				return callback(error) if error?
				version = parseInt(version, 10)
				first_version_in_redis = version - length

				if start < first_version_in_redis or end > version
					error = new Error("doc ops range is not loaded in redis")
					logger.error err: error, length: length, version: version, start: start, end: end, "inconsistent version or length"
					return callback(error)

				start = start - first_version_in_redis
				if end > -1
					end = end - first_version_in_redis

				if isNaN(start) or isNaN(end)
					error = new Error("inconsistent version or lengths")
					logger.error err: error, length: length, version: version, start: start, end: end, "inconsistent version or length"
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
		multi = rclient.multi()
		multi.rpush keys.uncompressedHistoryOp(doc_id: doc_id), jsonOp
		multi.sadd keys.docsWithHistoryOps(project_id: project_id), doc_id
		multi.exec (error, results) ->
			return callback(error) if error?
			[length, _] = results
			callback(error, length)

	getDocOpsLength: (doc_id, callback = (error, length) ->) ->
		rclient.llen keys.docOps(doc_id: doc_id), callback

	getDocIdsInProject: (project_id, callback = (error, doc_ids) ->) ->
		rclient.smembers keys.docsInProject(project_id: project_id), callback


getDocumentsProjectId = (doc_id, callback)->
	rclient.get keys.projectKey({doc_id:doc_id}), (err, project_id)->
		callback err, {doc_id:doc_id, project_id:project_id}

getAllProjectDocsIds = (project_id, callback)->
	rclient.SMEMBERS keys.docsInProject(project_id:project_id), (err, doc_ids)->
		if callback?
			callback(err, doc_ids)

getDocumentsAndExpire = (doc_ids, callback)->
	multi = rclient.multi()
	oneDay = 86400
	doc_ids.forEach (doc_id)->
		#		rclient.expire keys.docLines(doc_id:doc_id), oneDay, ->
	doc_ids.forEach (doc_id)->
		multi.get keys.docLines(doc_id:doc_id)
	multi.exec (err, docsLines)->
		callback err, docsLines
	

