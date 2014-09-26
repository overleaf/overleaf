settings = require("settings-sharelatex")
redis = require("redis-sharelatex")
rclient = redis.createClient(settings.redis.web)
redback = require("redback").use(rclient)

module.exports =

	addCount: (opts, callback = (opts, shouldProcess)->)->
		ratelimit = redback.createRateLimit(opts.endpointName)
		ratelimit.addCount opts.subjectName, opts.timeInterval, (err, callCount)->
			shouldProcess = callCount < opts.throttle
			callback(err, shouldProcess)