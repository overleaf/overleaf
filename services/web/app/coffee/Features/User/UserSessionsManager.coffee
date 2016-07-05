Settings = require('settings-sharelatex')
redis = require('redis-sharelatex')
logger = require("logger-sharelatex")
Async = require('async')
_ = require('underscore')

rclient = redis.createClient(Settings.redis.web)

module.exports = UserSessionsManager =

	_sessionSetKey: (user) ->
		return "UserSessions:#{user._id}"

	# mimic the key used by the express sessions
	_sessionKey: (sessionId) ->
		return "sess:#{sessionId}"

	trackSession: (user, sessionId, callback=(err)-> ) ->
		if !user
			logger.log {sessionId}, "no user to track, returning"
			return callback(null)
		if !sessionId
			logger.log {user_id: user._id}, "no sessionId to track, returning"
			return callback(null)
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
				UserSessionsManager._checkSessions(user, () ->)
				callback()

	untrackSession: (user, sessionId, callback=(err)-> ) ->
		if !user
			logger.log {sessionId}, "no user to untrack, returning"
			return callback(null)
		if !sessionId
			logger.log {user_id: user._id}, "no sessionId to untrack, returning"
			return callback(null)
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
				UserSessionsManager._checkSessions(user, () ->)
				callback()

	revokeAllUserSessions: (user, retain, callback=(err)->) ->
		if !retain
			retain = []
		retain = retain.map((i) -> UserSessionsManager._sessionKey(i))
		if !user
			logger.log {}, "no user to revoke sessions for, returning"
			return callback(null)
		logger.log {user_id: user._id}, "revoking all existing sessions for user"
		sessionSetKey = UserSessionsManager._sessionSetKey(user)
		rclient.smembers sessionSetKey, (err, sessionKeys) ->
			if err
				logger.err {err, user_id: user._id, sessionSetKey}, "error getting contents of UserSessions set"
				return callback(err)
			keysToDelete = _.filter(sessionKeys, (k) -> k not in retain)
			logger.log {user_id: user._id, count: keysToDelete.length}, "deleting sessions for user"
			rclient.multi()
				.del(keysToDelete)
				.srem(sessionSetKey, keysToDelete)
				.exec (err, result) ->
					if err
						logger.err {err, user_id: user._id, sessionSetKey}, "error revoking all sessions for user"
						return callback(err)
					callback(null)

	touch: (user, callback=(err)->) ->
		if !user
			logger.log {}, "no user to touch sessions for, returning"
			return callback(null)
		sessionSetKey = UserSessionsManager._sessionSetKey(user)
		rclient.expire sessionSetKey, "#{Settings.cookieSessionLength}", (err, response) ->
			if err
				logger.err {err, user_id: user._id}, "error while updating ttl on UserSessions set"
				return callback(err)
			callback(null)

	_checkSessions: (user, callback=(err)->) ->
		if !user
			logger.log {}, "no user, returning"
			return callback(null)
		logger.log {user_id: user._id}, "checking sessions for user"
		sessionSetKey = UserSessionsManager._sessionSetKey(user)
		rclient.smembers sessionSetKey, (err, sessionKeys) ->
			if err
				logger.err {err, user_id: user._id, sessionSetKey}, "error getting contents of UserSessions set"
				return callback(err)
			logger.log {user_id: user._id, count: sessionKeys.length}, "checking sessions for user"
			Async.series(
				sessionKeys.map(
					(key) ->
						(next) ->
							rclient.get key, (err, val) ->
								if err
									return next(err)
								if val == null
									logger.log {user_id: user._id, key}, ">> removing key from UserSessions set"
									rclient.srem sessionSetKey, key, (err, result) ->
										if err
											return next(err)
										return next(null)
								else
									next()
				)
				, (err, results) ->
					logger.log {user_id: user._id}, "done checking sessions for user"
					return callback(err)
			)
