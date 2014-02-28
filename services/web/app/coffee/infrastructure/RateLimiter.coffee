redback = require("redback").createClient()

module.exports =

	addCount: (opts, callback = (opts, shouldProcess)->)->
		ratelimit = redback.createRateLimit(opts.endpointName)
		ratelimit.addCount opts.subjectName, opts.timeInterval, (err, callCount)->
			shouldProcess = callCount < opts.throttle
			callback(err, shouldProcess)