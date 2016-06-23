Settings = require "settings-sharelatex"
async = require "async"
_ = require "underscore"
logger = require "logger-sharelatex"

class Client
	constructor: (@clients) ->
		@HEARTBEAT_INTERVAL = 5000
		@HEARTBEAT_TIMEOUT = 2000
		
	multi: () ->
		return new MultiClient(
			@clients.map (client) -> {
				rclient: client.rclient.multi()
				key_schema: client.key_schema
				primary: client.primary
				driver: client.driver
			}
		)

	monitorTcpAndReconnect: () ->
		for client in @clients
			if client.driver == "ioredis"
				@_monitorCluster(client.rclient)
	
	_monitorCluster: (rclient) ->
		setInterval () =>
			# Nodes can come and go as the cluster moves/heals, so each heartbeat
			# we ask again for the currently known nodes.
			for node in rclient.nodes("all")
				@_checkNode(node)
		, @HEARTBEAT_INTERVAL
	
	_checkNode: (node) ->
		timer = setTimeout () ->
			logger.error {err: new Error("Node timed out, reconnecting"), key: node.options.key}
			# Discussion of application layer monitoring recommends this way of reconnecting at https://github.com/luin/ioredis/issues/275
			node.stream.destroy()
		, @HEARTBEAT_TIMEOUT
		node.ping (err) ->
			if !err?
				clearTimeout timer

class MultiClient
	constructor: (@clients) ->
	
	exec: (callback) ->
		jobs = @clients.map (client) ->
			(cb) ->
				client.rclient.exec (error, result) ->
					if client.driver == "ioredis"
						# ioredis returns an results like:
						# [ [null, 42], [null, "foo"] ]
						# where the first entries in each 2-tuple are
						# presumably errors for each individual command,
						# and the second entry is the result. We need to transform
						# this into the same result as the old redis driver:
						# [ 42, "foo" ]
						filtered_result = []
						for entry in result or []
							if entry[0]?
								return cb(entry[0])
							else
								filtered_result.push entry[1]
						result = filtered_result
						
					if client.primary
						# Return this result as the actual result
						callback(error, result)
					# Send the rest through for comparison
					cb(error, result)
		async.parallel jobs, (error, results) ->
			if error?
				logger.error {err: error}, "error in redis backend"
			else
				compareResults(results)

COMMANDS = {
	"get": 0,
	"smembers": 0,
	"set": 0,
	"srem": 0,
	"sadd": 0,
	"del": 0,
	"lrange": 0,
	"llen": 0,
	"rpush": 0,
	"expire": 0,
	"ltrim": 0,
	"incr": 0,
	"eval": 2
}
for command, key_pos of COMMANDS
	do (command, key_pos) ->
		Client.prototype[command] = (args..., callback) ->
			jobs = @clients.map (client) ->
				(cb) ->
					key_builder = args[key_pos]
					key = key_builder(client.key_schema)
					args_with_key = args.slice(0)
					args_with_key[key_pos] = key
					client.rclient[command] args_with_key..., (error, result...) ->
						if client.primary
							# Return this result as the actual result
							callback(error, result...)
						# Send the rest through for comparison
						cb(error, result...)
			async.parallel jobs, (error, results) ->
				if error?
					logger.error {err: error}, "error in redis backend"
				else
					compareResults(results)

		MultiClient.prototype[command] = (args...) ->
			for client in @clients
				key_builder = args[key_pos]
				key = key_builder(client.key_schema)
				args_with_key = args.slice(0)
				args_with_key[key_pos] = key
				client.rclient[command] args_with_key...

compareResults = (results) ->
	return if results.length < 2
	first = results[0]
	for result in results.slice(1)
		if not _.isEqual(first, result)
			logger.warn { results }, "redis return values do not match"

module.exports =
	createClient: () ->
		client_configs = Settings.redis.documentupdater
		unless client_configs instanceof Array
			client_configs.primary = true
			client_configs = [client_configs]
		clients = client_configs.map (config) ->
			if config.cluster?
				Redis = require("ioredis")
				rclient = new Redis.Cluster(config.cluster)
				driver = "ioredis"
			else
				redis_config = {}
				for key in ["host", "port", "password", "endpoints", "masterName"]
					if config[key]?
						redis_config[key] = config[key]
				rclient = require("redis-sharelatex").createClient(redis_config)
				driver = "redis"
			return {
				rclient: rclient
				key_schema: config.key_schema
				primary: config.primary
				driver: driver
			}
		return new Client(clients)