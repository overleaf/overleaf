Settings = require('settings-sharelatex')
redis = require('redis')
rclient = redis.createClient(Settings.redis.web.port, Settings.redis.web.host)
rclient.auth(Settings.redis.web.password)
uuid = require("node-uuid")
logger = require("logger-sharelatex")

ONE_HOUR_IN_S = 60 * 60

buildKey = (token)-> return "password_token:#{token}"

module.exports =

	getNewToken: (user_id, callback)->
		logger.log user_id:user_id, "generating token for password reset"
		token = uuid.v4()
		multi = rclient.multi()
		multi.set buildKey(token), user_id
		multi.expire buildKey(token), ONE_HOUR_IN_S
		multi.exec (err)->
			callback(err, token)

	getUserIdFromTokenAndExpire: (token, callback)->
		logger.log token:token, "getting user id from password token"
		multi = rclient.multi()
		multi.get buildKey(token)
		multi.del buildKey(token)
		multi.exec (err, results)->
			callback err, results[0]

