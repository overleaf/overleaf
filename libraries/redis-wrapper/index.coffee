_ = require("underscore")
async = require "async"
os = require('os')
crypto = require('crypto')

# generate unique values for health check
HOST = os.hostname()
PID = process.pid
RND = crypto.randomBytes(4).toString('hex')
COUNT = 0

module.exports = RedisSharelatex =
	createClient: (opts = {port: 6379, host: "localhost"})->
		if !opts.retry_max_delay?
			opts.retry_max_delay = 5000 # ms
		
		if opts.cluster?
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
		# check the redis connection by storing and retrieving a unique key/value pair
		uniqueToken = "host=#{HOST}:pid=#{PID}:random=#{RND}:time=#{Date.now()}:count=#{COUNT++}"
		timer = setTimeout () ->
			error = new Error("redis client health check timed out #{client?.options?.host}")
			console.error {
				err: error,
				key: client.options?.key # only present for cluster
				clientOptions: client.options
				uniqueToken: uniqueToken
			}, "client timed out"
			callback(error)
		, RedisSharelatex.HEARTBEAT_TIMEOUT
		healthCheckKey = "_redis-wrapper:healthCheckKey:{#{uniqueToken}}"
		healthCheckValue = "_redis-wrapper:healthCheckValue:{#{uniqueToken}}"
		# set the unique key/value pair
		multi = client.multi()
		multi.set healthCheckKey, healthCheckValue, "EX", 60
		multi.exec (err, reply) ->
			if err?
				clearTimeout timer
				return callback(err)
			# check that we can retrieve the unique key/value pair
			multi = client.multi()
			multi.get healthCheckKey
			multi.del healthCheckKey
			multi.exec (err, reply) ->
				clearTimeout timer
				return callback(err) if err?
				return callback(new Error("bad response from redis health check")) if reply?[0] isnt healthCheckValue or reply?[1] isnt 1
				return callback()

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
	
		
	

