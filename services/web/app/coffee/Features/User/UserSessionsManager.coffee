Settings = require('settings-sharelatex')
redis = require('redis-sharelatex')
rclient = redis.createClient(Settings.redis.web)
logger = require("logger-sharelatex")

module.exports = UserSessionsManager =

	_sessionSetKey: (user) ->
		console.log ">>", user
		return "UserSessions:#{user._id}"

	onLogin: (user, sessionId, callback=(err)-> ) ->
		logger.log {user_id: user._id, sessionId}, "onLogin handler"
		sessionSetKey = UserSessionsManager._sessionSetKey(user)
		rclient.sadd sessionSetKey, sessionId, (err, response) ->
			if err
				logger.err {err, user_id: user._id, sessionId}, "error while adding session key to UserSessions set"
				return callback(err)
			callback()

	onLogout: (user, sessionId, callback=(err)-> ) ->
		logger.log {user_id: user._id, sessionId}, "onLogout handler"
		if !user
			logger.log {sessionId}, "no user, for some reason"
			return callback()
		sessionSetKey = UserSessionsManager._sessionSetKey(user)
		rclient.srem sessionSetKey, sessionId, (err, response) ->
			if err
				logger.err {err, user_id: user._id, sessionId}, "error while removing session key from UserSessions set"
				return callback(err)
			callback()
