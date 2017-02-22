Settings = require('settings-sharelatex')
async = require('async')
rclient = require("./RedisBackend").createClient()
_ = require('underscore')
keys = require('./RedisKeyBuilder')
logger = require('logger-sharelatex')
metrics = require('./Metrics')
Errors = require "./Errors"
crypto = require "crypto"

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

module.exports = RedisManager =
	rclient: rclient

	putDocInMemory : (project_id, doc_id, docLines, version, ranges, _callback)->
		timer = new metrics.Timer("redis.put-doc")
		callback = (error) ->
			timer.done()
			_callback(error)
		docLines = JSON.stringify(docLines)
		docHash = RedisManager._computeHash(docLines)
		logger.log project_id:project_id, doc_id:doc_id, version: version, hash:docHash, "putting doc in redis"
		ranges = RedisManager._serializeRanges(ranges)
		multi = rclient.multi()
		multi.eval setScript, 1, keys.docLines(doc_id:doc_id), docLines
		multi.set keys.projectKey({doc_id:doc_id}), project_id
		multi.set keys.docVersion(doc_id:doc_id), version
		multi.set keys.docHash(doc_id:doc_id), docHash
		if ranges?
			multi.set keys.ranges(doc_id:doc_id), ranges
		else
			multi.del keys.ranges(doc_id:doc_id)
		multi.exec (error, result) ->
			return callback(error) if error?
			# check the hash computed on the redis server
			writeHash = result?[0]
			if logHashWriteErrors and writeHash? and writeHash isnt docHash
				logger.error project_id: project_id, doc_id: doc_id, writeHash: writeHash, origHash: docHash, "hash mismatch on putDocInMemory"
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
		multi.exec (error) ->
			return callback(error) if error?
			rclient.srem keys.docsInProject(project_id:project_id), doc_id, callback

	getDoc : (project_id, doc_id, callback = (error, lines, version, ranges) ->)->
		timer = new metrics.Timer("redis.get-doc")
		multi = rclient.multi()
		multi.get keys.docLines(doc_id:doc_id)
		multi.get keys.docVersion(doc_id:doc_id)
		multi.get keys.docHash(doc_id:doc_id)
		multi.get keys.projectKey(doc_id:doc_id)
		multi.get keys.ranges(doc_id:doc_id)
		multi.exec (error, [docLines, version, storedHash, doc_project_id, ranges])->
			timer.done()
			return callback(error) if error?

			# check sha1 hash value if present
			if docLines? and storedHash?
				computedHash = RedisManager._computeHash(docLines)
				if logHashReadErrors and computedHash isnt storedHash
					logger.error project_id: project_id, doc_id: doc_id, doc_project_id: doc_project_id, computedHash: computedHash, storedHash: storedHash, "hash mismatch on retrieved document"

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
			callback null, docLines, version, ranges

	getDocVersion: (doc_id, callback = (error, version) ->) ->
		rclient.get keys.docVersion(doc_id: doc_id), (error, version) ->
			return callback(error) if error?
			version = parseInt(version, 10)
			callback null, version

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
	updateDocument : (doc_id, docLines, newVersion, appliedOps = [], ranges, callback = (error) ->)->
		RedisManager.getDocVersion doc_id, (error, currentVersion) ->
			return callback(error) if error?
			if currentVersion + appliedOps.length != newVersion
				error = new Error("Version mismatch. '#{doc_id}' is corrupted.")
				logger.error {err: error, doc_id, currentVersion, newVersion, opsLength: appliedOps.length}, "version mismatch"
				return callback(error)
			jsonOps = appliedOps.map (op) -> JSON.stringify op
			multi = rclient.multi()
			newDocLines = JSON.stringify(docLines)
			newHash = RedisManager._computeHash(newDocLines)
			multi.eval setScript, 1, keys.docLines(doc_id:doc_id), newDocLines
			multi.set    keys.docVersion(doc_id:doc_id), newVersion
			multi.set    keys.docHash(doc_id:doc_id), newHash
			if jsonOps.length > 0
				multi.rpush  keys.docOps(doc_id: doc_id), jsonOps...
			multi.expire keys.docOps(doc_id: doc_id), RedisManager.DOC_OPS_TTL
			multi.ltrim  keys.docOps(doc_id: doc_id), -RedisManager.DOC_OPS_MAX_LENGTH, -1
			ranges = RedisManager._serializeRanges(ranges)
			if ranges?
				multi.set keys.ranges(doc_id:doc_id), ranges
			else
				multi.del keys.ranges(doc_id:doc_id)
			multi.exec (error, result) ->
					return callback(error) if error?
					# check the hash computed on the redis server
					writeHash = result?[0]
					if logHashWriteErrors and writeHash? and writeHash isnt newHash
						logger.error doc_id: doc_id, writeHash: writeHash, origHash: newHash, "hash mismatch on updateDocument"
					return callback()

	getDocIdsInProject: (project_id, callback = (error, doc_ids) ->) ->
		rclient.smembers keys.docsInProject(project_id: project_id), callback
	
	_serializeRanges: (ranges) ->
		jsonRanges = JSON.stringify(ranges)
		if jsonRanges == '{}'
			# Most doc will have empty ranges so don't fill redis with lots of '{}' keys
			jsonRanges = null
		return jsonRanges
	
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
