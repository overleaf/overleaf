Settings = require('settings-sharelatex')
redis = require('redis-sharelatex')
logger = require("logger-sharelatex")
Async = require('async')

UserSessionsRedis = require('../../../../app/js/Features/User/UserSessionsRedis')

# rclient = redis.createClient(Settings.redis.web)
rclient = UserSessionsRedis.client()

module.exports =

	getUserSessions: (user, callback=(err, sessionsSet)->) ->
		rclient.smembers "UserSessions:{#{user._id}}", (err, result) ->
			return callback(err, result)

	clearUserSessions: (user, callback=(err)->) ->
		sessionSetKey = "UserSessions:{#{user._id}}"
		rclient.smembers sessionSetKey, (err, sessionKeys) ->
			if err
				return callback(err)
			if sessionKeys.length == 0
				return callback(null)
			actions = sessionKeys.map (k) ->
				(cb) ->
					rclient.del k, (err) ->
						cb(err)
			Async.series(
				actions, (err, results) ->
					rclient.srem sessionSetKey, sessionKeys, (err) ->
						if err
							return callback(err)
						callback(null)
			)
