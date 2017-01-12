settings = require("settings-sharelatex")
RedisWrapper = require('./RedisWrapper')
rclient = RedisWrapper.client('ratelimiter')
RollingRateLimiter = require('rolling-rate-limiter')


module.exports = RateLimiter =

	addCount: (opts, callback = (err, shouldProcess)->)->
		console.log ">> opts", opts
		namespace = "RateLimit:#{opts.endpointName}:"
		k = "{#{opts.subjectName}}"
		limiter = RollingRateLimiter({
			redis: rclient,
			namespace: namespace,
			interval: opts.timeInterval * 1000,
			maxInInterval: opts.throttle
		})
		limiter k, (err, timeLeft, actionsLeft) ->
			if err?
				return callback(err)
			allowed = timeLeft == 0
			console.log ">> limit", namespace, k, timeLeft, actionsLeft, ", allowed", allowed
			callback(null, allowed)

	clearRateLimit: (endpointName, subject, callback) ->
		# same as the key which will be built by RollingRateLimiter (namespace+k)
		keyName = "RateLimit:#{endpointName}:{#{subject}}"
		rclient.del keyName, callback
