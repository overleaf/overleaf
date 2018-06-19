Settings = require('settings-sharelatex')
RedisWrapper = require("../../infrastructure/RedisWrapper")
rclient = RedisWrapper.client("one_time_token")
crypto = require("crypto")
logger = require("logger-sharelatex")

ONE_HOUR_IN_S = 60 * 60

buildKey = (use, token)-> return "#{use}_token:#{token}"

module.exports =

	getNewToken: (use, value, options = {}, callback)->
		# options is optional
		if typeof options == "function"
			callback = options
			options = {}
		expiresIn = options.expiresIn or ONE_HOUR_IN_S
		token = crypto.randomBytes(32).toString("hex")
		logger.log {value, expiresIn, token_start: token.slice(0,8)}, "generating token for #{use}"
		multi = rclient.multi()
		multi.set buildKey(use, token), value
		multi.expire buildKey(use, token), expiresIn
		multi.exec (err)->
			callback(err, token)

	getValueFromTokenAndExpire: (use, token, callback)->
		logger.log token_start: token.slice(0,8), "getting value from #{use} token"
		multi = rclient.multi()
		multi.get buildKey(use, token)
		multi.del buildKey(use, token)
		multi.exec (err, results)->
			callback err, results?[0]

