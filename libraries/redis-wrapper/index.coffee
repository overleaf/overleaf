_ = require("underscore")
async = require "async"

module.exports = RedisSharelatex =
	createClient: (opts = {port: 6379, host: "localhost"})->
		if !opts.retry_max_delay?
			opts.retry_max_delay = 5000 # ms
		
		if opts.endpoints?
			standardOpts = _.clone(opts)
			delete standardOpts.endpoints
			delete standardOpts.masterName
			client = require("redis-sentinel").createClient opts.endpoints, opts.masterName, standardOpts
			client.healthCheck = RedisSharelatex.singleInstanceHealthCheckBuilder(client)
		else if opts.cluster?
			Redis = require("ioredis")
			standardOpts = _.clone(opts)
			delete standardOpts.cluster
			delete standardOpts.key_schema
			client = new Redis.Cluster(opts.cluster, standardOpts)
			client.healthCheck = RedisSharelatex.clusterHealthCheckBuilder(client)
			RedisSharelatex._monkeyPatchIoredisExec(client)
		else
			standardOpts = _.clone(opts)
			ioredis = require("ioredis")
			client = new ioredis(standardOpts)
			RedisSharelatex._monkeyPatchIoredisExec(client)
			client.healthCheck = RedisSharelatex.singleInstanceHealthCheckBuilder(client)
		return client
	
	HEARTBEAT_TIMEOUT: 2000
	singleInstanceHealthCheckBuilder: (client) ->
		healthCheck = (callback) ->
			RedisSharelatex._checkClient(client, callback)
		return healthCheck
	
	clusterHealthCheckBuilder: (client) ->
		healthCheck = (callback) ->
			jobs = client.nodes("all").map (node) =>
				(cb) => RedisSharelatex._checkClient(node, cb)
			async.parallel jobs, callback
		
		return healthCheck
	
	_checkClient: (client, callback) ->
		callback = _.once(callback)
		timer = setTimeout () ->
			error = new Error("redis client ping check timed out")
			console.error {
				err: error,
				key: client.options?.key # only present for cluster
			}, "client timed out"
			callback(error)
		, RedisSharelatex.HEARTBEAT_TIMEOUT
		client.ping (err) ->
			clearTimeout timer
			callback(err)
		
	_monkeyPatchIoredisExec: (client) ->
		_multi = client.multi
		client.multi = (args...) ->
			multi = _multi.call(client, args...)
			_exec = multi.exec
			multi.exec = (callback = () ->) ->
				_exec.call multi, (error, result) ->
					# ioredis exec returns an results like:
					# [ [null, 42], [null, "foo"] ]
					# where the first entries in each 2-tuple are
					# presumably errors for each individual command,
					# and the second entry is the result. We need to transform
					# this into the same result as the old redis driver:
					# [ 42, "foo" ]
					filtered_result = []
					for entry in result or []
						if entry[0]?
							return callback(entry[0])
						else
							filtered_result.push entry[1]
					callback error, filtered_result
			return multi
	
		
	

