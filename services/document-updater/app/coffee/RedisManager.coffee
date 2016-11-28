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

	putDocInMemory : (project_id, doc_id, docLines, version, track_changes, track_changes_entries, _callback)->
		timer = new metrics.Timer("redis.put-doc")
		callback = (error) ->
			timer.done()
			_callback(error)
		logger.log project_id:project_id, doc_id:doc_id, version: version, "putting doc in redis"
		multi = rclient.multi()
		multi.set keys.docLines(doc_id:doc_id), JSON.stringify(docLines)
		multi.set keys.projectKey({doc_id:doc_id}), project_id
		multi.set keys.docVersion(doc_id:doc_id), version
		multi.set keys.trackChangesEnabled(doc_id:doc_id), if track_changes then "1" else "0"
		multi.set keys.trackChangesEntries(doc_id:doc_id), JSON.stringify(track_changes_entries)
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
		multi.del keys.trackChangesEnabled(doc_id:doc_id)
		multi.del keys.trackChangesEntries(doc_id:doc_id)
		multi.exec (error) ->
			return callback(error) if error?
			rclient.srem keys.docsInProject(project_id:project_id), doc_id, callback

	getDoc : (project_id, doc_id, callback = (error, lines, version, track_changes, track_changes_entries) ->)->
		timer = new metrics.Timer("redis.get-doc")
		multi = rclient.multi()
		multi.get keys.docLines(doc_id:doc_id)
		multi.get keys.docVersion(doc_id:doc_id)
		multi.get keys.projectKey(doc_id:doc_id)
		multi.get keys.trackChangesEnabled(doc_id:doc_id)
		multi.get keys.trackChangesEntries(doc_id:doc_id)
		multi.exec (error, result)->
			timer.done()
			return callback(error) if error?
			try
				docLines = JSON.parse result[0]
				track_changes_entries = JSON.parse result[4]
			catch e
				return callback(e)
			version = parseInt(result[1] or 0, 10)
			doc_project_id = result[2]
			track_changes = (result[3] == "1")
			# check doc is in requested project
			if doc_project_id? and doc_project_id isnt project_id
				logger.error project_id: project_id, doc_id: doc_id, doc_project_id: doc_project_id, "doc not in project"
				return callback(new Errors.NotFoundError("document not found"))
			callback null, docLines, version, track_changes, track_changes_entries

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
	updateDocument : (doc_id, docLines, newVersion, appliedOps = [], track_changes_entries, callback = (error) ->)->
		RedisManager.getDocVersion doc_id, (error, currentVersion) ->
			return callback(error) if error?
			if currentVersion + appliedOps.length != newVersion
				error = new Error("Version mismatch. '#{doc_id}' is corrupted.")
				logger.error {err: error, doc_id, currentVersion, newVersion, opsLength: appliedOps.length}, "version mismatch"
				return callback(error)
			jsonOps = appliedOps.map (op) -> JSON.stringify op
			multi = rclient.multi()
			multi.set    keys.docLines(doc_id:doc_id), JSON.stringify(docLines)
			multi.set    keys.docVersion(doc_id:doc_id), newVersion
			if jsonOps.length > 0
				multi.rpush  keys.docOps(doc_id: doc_id), jsonOps...
			multi.expire keys.docOps(doc_id: doc_id), RedisManager.DOC_OPS_TTL
			multi.ltrim  keys.docOps(doc_id: doc_id), -RedisManager.DOC_OPS_MAX_LENGTH, -1
			multi.set    keys.trackChangesEntries(doc_id:doc_id), JSON.stringify(track_changes_entries)
			multi.exec (error, replys) ->
					return callback(error) if error?
					return callback()

	getDocIdsInProject: (project_id, callback = (error, doc_ids) ->) ->
		rclient.smembers keys.docsInProject(project_id: project_id), callback

	setTrackChanges: (project_id, doc_id, track_changes_on, callback = (error) ->) ->
		value = (if track_changes_on then "1" else "0")
		rclient.set keys.trackChangesEnabled({doc_id}), value, callback
