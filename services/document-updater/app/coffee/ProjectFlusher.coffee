request = require("request")
Settings = require('settings-sharelatex')
RedisManager = require("./RedisManager")
rclient = RedisManager.rclient
docUpdaterKeys = Settings.redis.documentupdater.key_schema
async = require("async")
ProjectManager = require("./ProjectManager")
_ = require("lodash")
logger = require("logger-sharelatex")

ProjectFlusher = 

	# iterate over keys asynchronously using redis scan (non-blocking)
	# handle all the cluster nodes or single redis server
	_getKeys: (pattern, limit, callback) ->
		nodes = rclient.nodes?('master') || [ rclient ];
		doKeyLookupForNode = (node, cb) ->
			ProjectFlusher._getKeysFromNode node, pattern, limit, cb
		async.concatSeries nodes, doKeyLookupForNode, callback

	_getKeysFromNode: (node, pattern, limit = 1000, callback) ->
		cursor = 0  # redis iterator
		keySet = {} # use hash to avoid duplicate results
		batchSize = if limit? then Math.min(limit, 1000) else 1000
		# scan over all keys looking for pattern
		doIteration = (cb) ->
			node.scan cursor, "MATCH", pattern, "COUNT", batchSize, (error, reply) ->
				return callback(error) if error?
				[cursor, keys] = reply
				for key in keys
					keySet[key] = true
				keys = Object.keys(keySet)
				noResults = cursor == "0" # redis returns string results not numeric
				limitReached = (limit? && keys.length >= limit)
				if noResults || limitReached
					return callback(null, keys)
				else
					setTimeout doIteration, 10 # avoid hitting redis too hard
		doIteration()

	# extract ids from keys like DocsWithHistoryOps:57fd0b1f53a8396d22b2c24b
	# or docsInProject:{57fd0b1f53a8396d22b2c24b} (for redis cluster)
	_extractIds: (keyList) ->
		ids = for key in keyList
			m = key.match(/:\{?([0-9a-f]{24})\}?/) # extract object id
			m[1]
		return ids

	flushAllProjects: (options, callback)->
		logger.log options:options, "flushing all projects"
		ProjectFlusher._getKeys docUpdaterKeys.docsInProject({project_id:"*"}), options.limit, (error, project_keys) ->
			if error?
				logger.err err:error, "error getting keys for flushing"
				return callback(error)
			project_ids = ProjectFlusher._extractIds(project_keys)
			if options.dryRun
				return callback(null, project_ids)
			jobs = _.map project_ids, (project_id)->
				return (cb)->
					ProjectManager.flushAndDeleteProjectWithLocks project_id, {background:true}, cb
			async.parallelLimit async.reflectAll(jobs), options.concurrency, (error, results)->
				success = []
				failure = []
				_.each results, (result, i)->
					if result.error?
						failure.push(project_ids[i])
					else 
						success.push(project_ids[i])
				logger.log success:success, failure:failure, "finished flushing all projects"
				return callback(error, {success:success, failure:failure})


module.exports = ProjectFlusher