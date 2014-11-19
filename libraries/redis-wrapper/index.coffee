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
		
	createRobustSubscriptionClient: (opts, heartbeatOpts = {}) ->
		sub = RedisSharelatex.createClient(opts)
		pub = RedisSharelatex.createClient(opts)
		
		heartbeatInterval = heartbeatOpts.heartbeat_interval or 1000 #ms
		reconnectAfter = heartbeatOpts.reconnect_after or 5000 #ms
		
		id = require("crypto").pseudoRandomBytes(16).toString("hex")
		heartbeatChannel = "heartbeat-#{id}"
		lastHeartbeat = Date.now()
		
		sub.subscribe heartbeatChannel, (error) ->
			if error?
				console.error "ERROR: failed to subscribe to #{heartbeatChannel} channel", error
		sub.on "message", (channel, message) ->
			if channel == heartbeatChannel
				lastHeartbeat = Date.now()
		
		reconnectIfInactive = () ->
			timeSinceLastHeartbeat = Date.now() - lastHeartbeat
			if timeSinceLastHeartbeat > reconnectAfter
				console.warn "[#{new Date()}] No heartbeat for #{timeSinceLastHeartbeat}ms on #{heartbeatChannel}, reconnecting"
				# If the client realises it isn't connected then will be trying to
				# restablish the connection, so there's nothing for us to do. If
				# it still thinks it's connected, then disconnect it and start to reconnect.
				if sub.connected
					sub.end()
					# We ended the connection, but want to start it up again, so set
					# the internal closing variable:
					sub.closing = false
					# Trigger the reconnect:
					sub.connection_gone("no heartbeat for #{timeSinceLastHeartbeat}ms")
				# Reset timer after triggering a reconnect to avoid potential cascading failure.
				lastHeartbeat = Date.now()
		
		setInterval () ->
			pub.publish heartbeatChannel, "PING"
			reconnectIfInactive()
		, heartbeatInterval
		
		return sub
			
		


