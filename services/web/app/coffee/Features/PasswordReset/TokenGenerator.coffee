Settings = require('settings-sharelatex')
redis = require('redis')
rclient = redis.createClient(Settings.redis.web.port, Settings.redis.web.host)
rclient.auth(Settings.redis.web.password)
uuid = require("node-uuid")

ONE_HOUR_IN_S = 60 * 60

buildKey = (token)-> return "password_token:#{token}"

module.exports =

	getNewToken: (user_id, callback)->
		token = uuid.v4()
		multi = rclient.multi()
		multi.set buildKey(token), user_id
		multi.expire buildKey(token), ONE_HOUR_IN_S
		multi.exec (err)->
			callback(err, token)

	getUserIdFromToken: (token, callback)->
		multi = rclient.multi()
		multi.get buildKey(token)
		multi.del buildKey(token)
		multi.exec (err, results)->
			callback err, results[0]

