Settings = require('settings-sharelatex')
rclient = require("redis-sharelatex").createClient(Settings.redis.documentupdater)
_ = require('underscore')
logger = require('logger-sharelatex')
metrics = require('./Metrics')
Errors = require "./Errors"
crypto = require "crypto"
ProjectHistoryRedisManager = require "./ProjectHistoryRedisManager"

# Sometimes Redis calls take an unexpectedly long time.  We have to be
# quick with Redis calls because we're holding a lock that expires
# after 30 seconds. We can't let any errors in the rest of the stack
# hold us up, and need to bail out quickly if there is a problem.
MAX_REDIS_REQUEST_LENGTH = 5000 # 5 seconds

# Make times easy to read
minutes = 60 # seconds for Redis expire

# LUA script to write document and return hash
# arguments: docLinesKey docLines
setScript = """
	redis.call('set', KEYS[1], ARGV[1])
	return redis.sha1hex(ARGV[1])
"""

logHashErrors = Settings.documentupdater?.logHashErrors
logHashReadErrors = logHashErrors?.read
logHashWriteErrors = logHashErrors?.write

MEGABYTES = 1024 * 1024
MAX_RANGES_SIZE = 3 * MEGABYTES

keys = Settings.redis.documentupdater.key_schema
historyKeys = Settings.redis.history.key_schema

module.exports = RedisManager =
	rclient: rclient

	putDocInMemory : (project_id, doc_id, docLines, version, ranges, pathname, _callback)->
		timer = new metrics.Timer("redis.put-doc")
		callback = (error) ->
			timer.done()
			_callback(error)
		docLines = JSON.stringify(docLines)
		if docLines.indexOf("\u0000") != -1
			error = new Error("null bytes found in doc lines")
			logger.error {err: error, doc_id: doc_id, docLines: docLines}, error.message
			return callback(error)
		docHash = RedisManager._computeHash(docLines)
		logger.log {project_id, doc_id, version, docHash, pathname}, "putting doc in redis"
		RedisManager._serializeRanges ranges, (error, ranges) ->
			if error?
				logger.error {err: error, doc_id, project_id}, error.message
				return callback(error)
			multi = rclient.multi()
			multi.eval setScript, 1, keys.docLines(doc_id:doc_id), docLines
			multi.set keys.projectKey({doc_id:doc_id}), project_id
			multi.set keys.docVersion(doc_id:doc_id), version
			multi.set keys.docHash(doc_id:doc_id), docHash
			if ranges?
				multi.set keys.ranges(doc_id:doc_id), ranges
			else
				multi.del keys.ranges(doc_id:doc_id)
			multi.set keys.pathname(doc_id:doc_id), pathname
			multi.exec (error, result) ->
				return callback(error) if error?
				# check the hash computed on the redis server
				writeHash = result?[0]
				if logHashWriteErrors and writeHash? and writeHash isnt docHash
					logger.error project_id: project_id, doc_id: doc_id, writeHash: writeHash, origHash: docHash, docLines:docLines, "hash mismatch on putDocInMemory"
				# update docsInProject set
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
		multi.del keys.docHash(doc_id:doc_id)
		multi.del keys.ranges(doc_id:doc_id)
		multi.del keys.pathname(doc_id:doc_id)
		multi.del keys.unflushedTime(doc_id:doc_id)
		multi.exec (error) ->
			return callback(error) if error?
			multi = rclient.multi()
			multi.srem keys.docsInProject(project_id:project_id), doc_id
			multi.del keys.projectState(project_id:project_id)
			multi.exec callback

	checkOrSetProjectState: (project_id, newState, callback = (error, stateChanged) ->) ->
		multi = rclient.multi()
		multi.getset keys.projectState(project_id:project_id), newState
		multi.expire keys.projectState(project_id:project_id), 30 * minutes
		multi.exec (error, response) ->
			return callback(error) if error?
			logger.log project_id: project_id, newState:newState, oldState: response[0], "checking project state"
			callback(null, response[0] isnt newState)

	clearProjectState: (project_id, callback = (error) ->) ->
		rclient.del keys.projectState(project_id:project_id), callback

	getDoc : (project_id, doc_id, callback = (error, lines, version, ranges, pathname, unflushedTime) ->)->
		timer = new metrics.Timer("redis.get-doc")
		multi = rclient.multi()
		multi.get keys.docLines(doc_id:doc_id)
		multi.get keys.docVersion(doc_id:doc_id)
		multi.get keys.docHash(doc_id:doc_id)
		multi.get keys.projectKey(doc_id:doc_id)
		multi.get keys.ranges(doc_id:doc_id)
		multi.get keys.pathname(doc_id:doc_id)
		multi.get keys.unflushedTime(doc_id:doc_id)
		multi.exec (error, [docLines, version, storedHash, doc_project_id, ranges, pathname, unflushedTime])->
			timeSpan = timer.done()
			return callback(error) if error?
			# check if request took too long and bail out.  only do this for
			# get, because it is the first call in each update, so if this
			# passes we'll assume others have a reasonable chance to succeed.
			if timeSpan > MAX_REDIS_REQUEST_LENGTH
				error = new Error("redis getDoc exceeded timeout")
				return callback(error)
			# check sha1 hash value if present
			if docLines? and storedHash?
				computedHash = RedisManager._computeHash(docLines)
				if logHashReadErrors and computedHash isnt storedHash
					logger.error project_id: project_id, doc_id: doc_id, doc_project_id: doc_project_id, computedHash: computedHash, storedHash: storedHash, docLines:docLines, "hash mismatch on retrieved document"

			try
				docLines = JSON.parse docLines
				ranges = RedisManager._deserializeRanges(ranges)
			catch e
				return callback(e)

			version = parseInt(version or 0, 10)
			# check doc is in requested project
			if doc_project_id? and doc_project_id isnt project_id
				logger.error project_id: project_id, doc_id: doc_id, doc_project_id: doc_project_id, "doc not in project"
				return callback(new Errors.NotFoundError("document not found"))

			# doc is not in redis, bail out
			if !docLines?
				return callback null, docLines, version, ranges, pathname, unflushedTime

			# doc should be in project set, check if missing (workaround for missing docs from putDoc)
			rclient.sadd keys.docsInProject(project_id:project_id), doc_id, (error, result) ->
				return callback(error) if error?
				if result isnt 0 # doc should already be in set
					logger.error project_id: project_id, doc_id: doc_id, doc_project_id: doc_project_id, "doc missing from docsInProject set"
				callback null, docLines, version, ranges, pathname, unflushedTime

	getDocVersion: (doc_id, callback = (error, version) ->) ->
		rclient.get keys.docVersion(doc_id: doc_id), (error, version) ->
			return callback(error) if error?
			version = parseInt(version, 10)
			callback null, version

	getDocLines: (doc_id, callback = (error, version) ->) ->
		rclient.get keys.docLines(doc_id: doc_id), (error, docLines) ->
			return callback(error) if error?
			callback null, docLines

	getPreviousDocOps: (doc_id, start, end, callback = (error, jsonOps) ->) ->
		timer = new metrics.Timer("redis.get-prev-docops")
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
					timeSpan = timer.done()
					if timeSpan > MAX_REDIS_REQUEST_LENGTH
						error = new Error("redis getPreviousDocOps exceeded timeout")
						return callback(error)
					callback null, ops

	DOC_OPS_TTL: 60 * minutes
	DOC_OPS_MAX_LENGTH: 100
	updateDocument : (project_id, doc_id, docLines, newVersion, appliedOps = [], ranges, callback = (error) ->)->
		RedisManager.getDocVersion doc_id, (error, currentVersion) ->
			return callback(error) if error?
			if currentVersion + appliedOps.length != newVersion
				error = new Error("Version mismatch. '#{doc_id}' is corrupted.")
				logger.error {err: error, doc_id, currentVersion, newVersion, opsLength: appliedOps.length}, "version mismatch"
				return callback(error)

			jsonOps = appliedOps.map (op) -> JSON.stringify op
			for op in jsonOps
				if op.indexOf("\u0000") != -1
					error = new Error("null bytes found in jsonOps")
					logger.error {err: error, doc_id: doc_id, jsonOps: jsonOps}, error.message
					return callback(error)

			newDocLines = JSON.stringify(docLines)
			if newDocLines.indexOf("\u0000") != -1
				error = new Error("null bytes found in doc lines")
				logger.error {err: error, doc_id: doc_id, newDocLines: newDocLines}, error.message
				return callback(error)
			newHash = RedisManager._computeHash(newDocLines)

			opVersions = appliedOps.map (op) -> op?.v
			logger.log doc_id: doc_id, version: newVersion, hash: newHash, op_versions: opVersions, "updating doc in redis"

			RedisManager._serializeRanges ranges, (error, ranges) ->
				if error?
					logger.error {err: error, doc_id}, error.message
					return callback(error)
				if ranges? and ranges.indexOf("\u0000") != -1
					error = new Error("null bytes found in ranges")
					logger.error err: error, doc_id: doc_id, ranges: ranges, error.message
					return callback(error)
				multi = rclient.multi()
				multi.eval setScript, 1, keys.docLines(doc_id:doc_id), newDocLines  # index 0
				multi.set    keys.docVersion(doc_id:doc_id), newVersion             # index 1
				multi.set    keys.docHash(doc_id:doc_id), newHash                   # index 2
				multi.ltrim  keys.docOps(doc_id: doc_id), -RedisManager.DOC_OPS_MAX_LENGTH, -1 # index 3
				if ranges?
					multi.set keys.ranges(doc_id:doc_id), ranges  # index 4
				else
					multi.del keys.ranges(doc_id:doc_id)          # also index 4
				# push the ops last so we can get the lengths at fixed index position 7
				if jsonOps.length > 0
					multi.rpush  keys.docOps(doc_id: doc_id), jsonOps...                         # index 5
					# expire must come after rpush since before it will be a no-op if the list is empty
					multi.expire keys.docOps(doc_id: doc_id), RedisManager.DOC_OPS_TTL           # index 6
					multi.rpush  historyKeys.uncompressedHistoryOps(doc_id: doc_id), jsonOps...  # index 7
					# Set the unflushed timestamp to the current time if the doc
					# hasn't been modified before (the content in mongo has been
					# valid up to this point). Otherwise leave it alone ("NX" flag).
					multi.set    keys.unflushedTime(doc_id: doc_id), Date.now(), "NX"
				multi.exec (error, result) ->
						return callback(error) if error?
						# check the hash computed on the redis server
						writeHash = result?[0]
						if logHashWriteErrors and writeHash? and writeHash isnt newHash
							logger.error doc_id: doc_id, writeHash: writeHash, origHash: newHash, docLines:newDocLines, "hash mismatch on updateDocument"

						# length of uncompressedHistoryOps queue (index 7)
						docUpdateCount = result[7]

						if jsonOps.length > 0 && Settings.apis?.project_history?.enabled
							ProjectHistoryRedisManager.queueOps project_id, jsonOps..., (error, projectUpdateCount) ->
								callback null, docUpdateCount, projectUpdateCount
						else
							callback null, docUpdateCount

	renameDoc: (project_id, doc_id, user_id, update, callback = (error) ->) ->
		RedisManager.getDoc project_id, doc_id, (error, lines, version) ->
			return callback(error) if error?

			if lines? and version?
				rclient.set keys.pathname(doc_id:doc_id), update.newPathname, (error) ->
					return callback(error) if error?
					ProjectHistoryRedisManager.queueRenameEntity project_id, 'doc', doc_id, user_id, update, callback
			else
				ProjectHistoryRedisManager.queueRenameEntity project_id, 'doc', doc_id, user_id, update, callback

	clearUnflushedTime: (doc_id, callback = (error) ->) ->
		rclient.del keys.unflushedTime(doc_id:doc_id), callback

	getDocIdsInProject: (project_id, callback = (error, doc_ids) ->) ->
		rclient.smembers keys.docsInProject(project_id: project_id), callback

	_serializeRanges: (ranges, callback = (error, serializedRanges) ->) ->
		jsonRanges = JSON.stringify(ranges)
		if jsonRanges? and jsonRanges.length > MAX_RANGES_SIZE
			return callback new Error("ranges are too large")
		if jsonRanges == '{}'
			# Most doc will have empty ranges so don't fill redis with lots of '{}' keys
			jsonRanges = null
		return callback null, jsonRanges

	_deserializeRanges: (ranges) ->
		if !ranges? or ranges == ""
			return {}
		else
			return JSON.parse(ranges)

	_computeHash: (docLines) ->
		# use sha1 checksum of doclines to detect data corruption.
		#
		# note: must specify 'utf8' encoding explicitly, as the default is
		# binary in node < v5
		return crypto.createHash('sha1').update(docLines, 'utf8').digest('hex')
