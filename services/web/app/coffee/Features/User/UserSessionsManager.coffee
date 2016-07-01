Settings = require('settings-sharelatex')
redis = require('redis-sharelatex')
rclient = redis.createClient(Settings.redis.web)
logger = require("logger-sharelatex")

module.exports = UserSessionsManager =

	_sessionSetKey: (user) ->
		return "UserSessions:#{user._id}"

	# mimic the key used by the express sessions
	_sessionKey: (sessionId) ->
		return "sess:#{sessionId}"

	onLogin: (user, sessionId, callback=(err)-> ) ->
		logger.log {user_id: user._id, sessionId}, "onLogin handler"
		sessionSetKey = UserSessionsManager._sessionSetKey(user)
		value = UserSessionsManager._sessionKey sessionId
		rclient.multi()
			.sadd(sessionSetKey, value)
			.expire(sessionSetKey, "#{Settings.cookieSessionLength}")
			.exec (err, response) ->
				if err
					logger.err {err, user_id: user._id, sessionSetKey}, "error while adding session key to UserSessions set"
					return callback(err)
				callback()

	onLogout: (user, sessionId, callback=(err)-> ) ->
		logger.log {user_id: user._id, sessionId}, "onLogout handler"
		if !user
			logger.log {sessionId}, "no user, for some reason"
			return callback()
		sessionSetKey = UserSessionsManager._sessionSetKey(user)
		value = UserSessionsManager._sessionKey sessionId
		rclient.multi()
			.srem(sessionSetKey, value)
			.expire(sessionSetKey, "#{Settings.cookieSessionLength}")
			.exec (err, response) ->
				if err
					logger.err {err, user_id: user._id, sessionSetKey}, "error while removing session key from UserSessions set"
					return callback(err)
				callback()

	revokeAllSessions: (user, callback=(err)->) ->
		logger.log {user_id: user._id}, "revoking all existing sessions for user"
		callback(null)

	touch: (user, callback=(err)->) ->
		if !user
			return callback(null)
		sessionSetKey = UserSessionsManager._sessionSetKey(user)
		rclient.expire sessionSetKey, "#{Settings.cookieSessionLength}", (err, response) ->
			if err
				logger.err {err, user_id: user._id}, "error while updating ttl on UserSessions set"
				return callback(err)
