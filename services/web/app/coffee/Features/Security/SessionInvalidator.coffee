Settings = require("settings-sharelatex")
redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.web)
crypto = require("crypto")
async = require("async")


module.exports = 

	_getEmailKey : (email)->
		hash = crypto.createHash("md5").update(email).digest("hex")
		return "e_sess:#{hash}"

	tracksession:(sessionId, email, callback = ->)->
		session_lookup_key = @_getEmailKey(email)
		rclient.set session_lookup_key, sessionId, callback

	invalidateSession:(email, callback = ->)->
		session_lookup_key = @_getEmailKey(email)
		rclient.get session_lookup_key, (err, sessionId)->
			async.series [
				(cb)-> rclient.del sessionId, cb
				(cb)-> rclient.del session_lookup_key, cb
			], callback


