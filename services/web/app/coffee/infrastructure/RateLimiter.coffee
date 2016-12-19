settings = require("settings-sharelatex")
RedisWrapper = require('./RedisWrapper')
rclient = RedisWrapper.client('ratelimiter')


module.exports = RateLimiter =

	_buildKey: (endpoint, subject) ->
		return "RateLimiter:#{endpoint}:{#{subject}}"

	addCount: (opts, callback = (opts, shouldProcess)->)->
		k = RateLimiter._buildKey(opts.endpointName, opts.subjectName)
		multi = rclient.multi()
		multi.incr(k)
		multi.get(k)
		multi.expire(k, opts.timeInterval)
		multi.exec (err, results)->
			console.log ">> results", results
			count = results[1]
			# account for the different results from `multi` when using cluster
			if count instanceof Object
				count = count[1]
			allow = count < opts.throttle
			callback err, allow

	clearRateLimit: (endpointName, subject, callback) ->
		k = RateLimiter._buildKey(endpointName, subject)
		rclient.del k, callback
