Settings = require('settings-sharelatex')
redis = require('redis')
rclient = redis.createClient(Settings.redis.web.port, Settings.redis.web.host)
rclient.auth(Settings.redis.web.password)

buildKey = (k)->
	return "LoginRateLimit:#{k}"

ONE_MIN = 60
ATTEMPT_LIMIT = 10

module.exports =
	processLoginRequest: (email, callback)->
		multi = rclient.multi()
		multi.incr(buildKey(email))
		multi.get(buildKey(email))
		multi.expire(buildKey(email), ONE_MIN * 2)
		multi.exec (err, results)->
			loginCount = results[1]
			allow = loginCount <= ATTEMPT_LIMIT
			callback err, allow

	recordSuccessfulLogin: (email, callback = ->)->
		rclient.del buildKey(email), callback