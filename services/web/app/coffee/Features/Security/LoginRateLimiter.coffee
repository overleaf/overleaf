RateLimiter = require('../../infrastructure/RateLimiter')


ONE_MIN = 60
ATTEMPT_LIMIT = 10


module.exports =

	processLoginRequest: (email, callback) ->
		opts =
			endpointName: 'login'
			throttle: ATTEMPT_LIMIT
			timeInterval: ONE_MIN * 2
			subjectName: email
		RateLimiter.addCount opts, (err, shouldAllow) ->
			callback(err, shouldAllow)

	recordSuccessfulLogin: (email, callback = ->)->
		RateLimiter.clearRateLimit 'login', email, callback

