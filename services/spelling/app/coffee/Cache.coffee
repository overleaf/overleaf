redis = require('redis')
settings = require('settings-sharelatex')
rclient = redis.createClient(settings.redis.port, settings.redis.host)
rclient.auth(settings.redis.password)
logger = require('logger-sharelatex')

thirtyMinutes = (60 * 60 * 30)

module.exports =

	break: (key, callback)->
		rclient.del buildKey(key), callback

	set :(key, value, callback)->
		value = JSON.stringify value
		builtKey = buildKey(key)
		multi = rclient.multi()
		multi.set builtKey, value
		multi.expire builtKey, thirtyMinutes
		multi.exec callback

	get :(key, callback)->
		builtKey = buildKey(key)
		rclient.get builtKey, (err, result)->
			return callback(err) if err?
			if !result?
				logger.log key:key, "cache miss"
				callback()
			else
				result = JSON.parse result
				logger.log key:key, foundId:result._id, "cache hit"
				callback null, result

buildKey = (key)->
	return "user-learned-words:#{key}"
