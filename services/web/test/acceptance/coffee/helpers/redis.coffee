Settings = require('settings-sharelatex')
redis = require('redis-sharelatex')
logger = require("logger-sharelatex")
Async = require('async')

rclient = redis.createClient(Settings.redis.web)

module.exports =

	getUserSessions: (user, callback=(err, sessionsSet)->) ->
		console.log ">> user, get sessions", user._id
		setTimeout(
			()->
				rclient.smembers "UserSessions:#{user._id}", (err, result) ->
					console.log ">>", result
					return callback(err, result)
			, 1000
		)

	clearUserSessions: (user, callback=(err)->) ->
		sessionSetKey = "UserSessions:#{user._id}"
		rclient.smembers sessionSetKey, (err, sessionKeys) ->
			if err
				return callback(err)
			if sessionKeys.length == 0
				return callback(null)
			rclient.multi()
				.del(sessionKeys)
				.srem(sessionSetKey, sessionKeys)
				.exec (err, result) ->
					if err
						return callback(err)
					callback(null)
