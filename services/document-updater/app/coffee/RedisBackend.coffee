Settings = require "settings-sharelatex"
async = require "async"

class Client
	constructor: (@clients) ->
		
	multi: () ->
		return new MultiClient(
			@clients.map (client) -> {
				rclient: client.rclient.multi()
				key_schema: client.key_schema
				primary: client.primary
			}
		)

class MultiClient
	constructor: (@clients) ->
	
	exec: (callback) ->
		jobs = @clients.map (client) ->
			(cb) ->
				console.error "EXEC", client.rclient.queue
				client.rclient.exec (result...) ->
					console.error "EXEC RESULT", result
					if client.primary
						# Return this result as the actual result
						callback(result...)
					# Send the rest through for comparison
					cb(result...)
		async.parallel jobs, (error, results) ->
			console.error "EXEC RESULTS", results

COMMANDS = [
	"get", "smembers", "set", "srem", "sadd", "del", "lrange",
	"llen", "rpush", "expire", "ltrim", "incr"
]
for command in COMMANDS
	do (command) ->
		Client.prototype[command] = (key_builder, args..., callback) ->
			async.parallel @clients.map (client) ->
				(cb) ->
					key = key_builder(client.key_schema)
					console.error "COMMAND", command, key, args
					client.rclient[command] key, args..., (result...) ->
						console.log "RESULT", command, result
						if client.primary
							# Return this result as the actual result
							callback?(result...)
						# Send the rest through for comparison
						cb(result...)
			, (error, results) ->
				console.log "#{command} RESULTS", results

		MultiClient.prototype[command] = (key_builder, args...) ->
			for client in @clients
				key = key_builder(client.key_schema)
				console.error "MULTI COMMAND", command, key, args
				client.rclient[command] key, args...

Client::eval = (script, pos, key_builder, args..., callback) ->
	async.parallel @clients.map (client) ->
		(cb) ->
			key = key_builder(client.key_schema)
			client.rclient.eval script, pos, key, args..., (result...) ->
				if client.primary
					# Return this result as the actual result
					callback(result...)
				# Send the rest through for comparison
				cb(result...)
	, (error, results) ->
		console.log "#{command} RESULTS", results

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
			else
				rclient = require("redis-sharelatex").createClient(config)
			rclient: rclient
			key_schema: config.key_schema
			primary: config.primary
		return new Client(clients)