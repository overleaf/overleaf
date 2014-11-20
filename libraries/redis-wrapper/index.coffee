_ = require("underscore")

module.exports = RedisSharelatex =
	createClient: (opts = {port: 6379, host: "localhost"})->
		if !opts.retry_max_delay?
			opts.retry_max_delay = 5000 # ms
		
		if opts.password?
			opts.auth_pass = opts.password
			delete opts.password
		if opts.endpoints?
			standardOpts = _.clone(opts)
			delete standardOpts.endpoints
			delete standardOpts.masterName
			client = require("redis-sentinel").createClient opts.endpoints, opts.masterName, standardOpts
		else
			standardOpts = _.clone(opts)
			delete standardOpts.port
			delete standardOpts.host
			client = require("redis").createClient opts.port, opts.host, standardOpts
		return client


	activeHealthCheckRedis: (connectionInfo)->
		sub = RedisSharelatex.createClient(connectionInfo)
		pub = RedisSharelatex.createClient(connectionInfo)
		
		redisIsOk = true
		lastPingMessage = ""
		heartbeatInterval = 2000 #ms
		isAliveTimeout = 10000 #ms
		
		id = require("crypto").pseudoRandomBytes(16).toString("hex")
		heartbeatChannel = "heartbeat-#{id}"
		lastHeartbeat = Date.now()
		
		sub.subscribe heartbeatChannel, (error) ->
			if error?
				console.error "ERROR: failed to subscribe to #{heartbeatChannel} channel", error
		sub.on "message", (channel, message) ->
			if lastPingMessage == message #we got the same message twice
				redisIsOk = false
			lastPingMessage = message
			if channel == heartbeatChannel
				lastHeartbeat = Date.now()
		
		setInterval ->
			message = "ping:#{Date.now()}"
			pub.publish heartbeatChannel, message
		, heartbeatInterval

		isAlive = ->
			timeSinceLastHeartbeat = Date.now() - lastHeartbeat
			if !redisIsOk
				return false
			else if timeSinceLastHeartbeat > isAliveTimeout
				console.error "heartbeat from redis timed out"
				redisIsOk = false
				return false
			else
				return true

		return {
			isAlive:isAlive
		}
