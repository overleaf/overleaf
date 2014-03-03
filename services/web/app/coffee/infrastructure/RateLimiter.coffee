settings = require("settings-sharelatex")
redis = require('redis')
rclient = redis.createClient(settings.redis.web.port, settings.redis.web.host)
rclient.auth(settings.redis.web.password)
redback = require("redback").use(rclient)

module.exports =

	addCount: (opts, callback = (opts, shouldProcess)->)->
		ratelimit = redback.createRateLimit(opts.endpointName)
		ratelimit.addCount opts.subjectName, opts.timeInterval, (err, callCount)->
			shouldProcess = callCount < opts.throttle
			callback(err, shouldProcess)