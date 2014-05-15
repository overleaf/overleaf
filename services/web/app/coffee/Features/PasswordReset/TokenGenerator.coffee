Settings = require('settings-sharelatex')
redis = require('redis')
rclient = redis.createClient(Settings.redis.web.port, Settings.redis.web.host)
rclient.auth(Settings.redis.web.password)
uuid = require("node-uuid")

ONE_MIN = 60 * 1000
ONE_HOUR_IN_MS = ONE_MIN * 60

module.exports =

	getNewToken: (user_id, callback)->
		token = uuid.v4()
		multi = rclient.multi()
		multi.set token, user_id
		multi.expire token, ONE_HOUR_IN_MS
		multi.exec (err)->
			callback(err, token)

	getUserIdFromToken: (token, callback)->
		multi = rclient.multi()
		multi.get token
		multi.del token
		multi.exec (err, results)->
			callback err, results[0]

