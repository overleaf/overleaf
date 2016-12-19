Settings = require('settings-sharelatex')
logger = require("logger-sharelatex")
Async = require('async')
_ = require('underscore')
UserSessionsRedis = require('./UserSessionsRedis')

rclient = UserSessionsRedis.client()

module.exports = UserSessionsManager =
	# mimic the key used by the express sessions
	_sessionKey: (sessionId) ->
		return "sess:#{sessionId}"

	trackSession: (user, sessionId, callback=(err)-> ) ->
		if !user?
			logger.log {sessionId}, "no user to track, returning"
			return callback(null)
		if !sessionId?
			logger.log {user_id: user._id}, "no sessionId to track, returning"
			return callback(null)
		logger.log {user_id: user._id, sessionId}, "onLogin handler"
		sessionSetKey = UserSessionsRedis.sessionSetKey(user)
		value = UserSessionsManager._sessionKey sessionId
		rclient.multi()
			.sadd(sessionSetKey, value)
			.expire(sessionSetKey, "#{Settings.cookieSessionLength}")
			.exec (err, response) ->
				if err?
					logger.err {err, user_id: user._id, sessionSetKey}, "error while adding session key to UserSessions set"
					return callback(err)
				UserSessionsManager._checkSessions(user, () ->)
				callback()

	untrackSession: (user, sessionId, callback=(err)-> ) ->
		if !user?
			logger.log {sessionId}, "no user to untrack, returning"
			return callback(null)
		if !sessionId?
			logger.log {user_id: user._id}, "no sessionId to untrack, returning"
			return callback(null)
		logger.log {user_id: user._id, sessionId}, "onLogout handler"
		sessionSetKey = UserSessionsRedis.sessionSetKey(user)
		value = UserSessionsManager._sessionKey sessionId
		rclient.multi()
			.srem(sessionSetKey, value)
			.expire(sessionSetKey, "#{Settings.cookieSessionLength}")
			.exec (err, response) ->
				if err?
					logger.err {err, user_id: user._id, sessionSetKey}, "error while removing session key from UserSessions set"
					return callback(err)
				UserSessionsManager._checkSessions(user, () ->)
				callback()

	getAllUserSessions: (user, exclude, callback=(err, sessionKeys)->) ->
		exclude = _.map(exclude, UserSessionsManager._sessionKey)
		sessionSetKey = UserSessionsRedis.sessionSetKey(user)
		rclient.smembers sessionSetKey, (err, sessionKeys) ->
			if err?
				logger.err user_id: user._id, "error getting all session keys for user from redis"
				return callback(err)
			sessionKeys = _.filter sessionKeys, (k) -> !(_.contains(exclude, k))
			if sessionKeys.length == 0
				logger.log {user_id: user._id}, "no other sessions found, returning"
				return callback(null, [])

			Async.mapSeries sessionKeys, ((k, cb) -> rclient.get(k, cb)), (err, sessions) ->
				if err?
					logger.err {user_id: user._id}, "error getting all sessions for user from redis"
					return callback(err)

				result = []
				for session in sessions
					if session is null
						continue
					session = JSON.parse(session)
					session_user = session?.user or session?.passport?.user
					result.push {
						ip_address: session_user.ip_address,
						session_created: session_user.session_created
					}

				return callback(null, result)

	revokeAllUserSessions: (user, retain, callback=(err)->) ->
		if !retain?
			retain = []
		retain = retain.map((i) -> UserSessionsManager._sessionKey(i))
		if !user?
			logger.log {}, "no user to revoke sessions for, returning"
			return callback(null)
		logger.log {user_id: user._id}, "revoking all existing sessions for user"
		sessionSetKey = UserSessionsRedis.sessionSetKey(user)
		rclient.smembers sessionSetKey, (err, sessionKeys) ->
			if err?
				logger.err {err, user_id: user._id, sessionSetKey}, "error getting contents of UserSessions set"
				return callback(err)
			keysToDelete = _.filter(sessionKeys, (k) -> k not in retain)
			if keysToDelete.length == 0
				logger.log {user_id: user._id}, "no sessions in UserSessions set to delete, returning"
				return callback(null)
			logger.log {user_id: user._id, count: keysToDelete.length}, "deleting sessions for user"

			deletions = keysToDelete.map (k) ->
				(cb) ->
					rclient.del k, cb

			Async.series deletions, (err, _result) ->
				if err?
					logger.err {err, user_id: user._id, sessionSetKey}, "errror revoking all sessions for user"
					return callback(err)
				rclient.srem sessionSetKey, keysToDelete, (err) ->
					if err?
						logger.err {err, user_id: user._id, sessionSetKey}, "error removing session set for user"
						return callback(err)
					callback(null)

	touch: (user, callback=(err)->) ->
		if !user
			logger.log {}, "no user to touch sessions for, returning"
			return callback(null)
		sessionSetKey = UserSessionsRedis.sessionSetKey(user)
		rclient.expire sessionSetKey, "#{Settings.cookieSessionLength}", (err, response) ->
			if err?
				logger.err {err, user_id: user._id}, "error while updating ttl on UserSessions set"
				return callback(err)
			callback(null)

	_checkSessions: (user, callback=(err)->) ->
		if !user
			logger.log {}, "no user, returning"
			return callback(null)
		logger.log {user_id: user._id}, "checking sessions for user"
		sessionSetKey = UserSessionsRedis.sessionSetKey(user)
		rclient.smembers sessionSetKey, (err, sessionKeys) ->
			if err?
				logger.err {err, user_id: user._id, sessionSetKey}, "error getting contents of UserSessions set"
				return callback(err)
			logger.log {user_id: user._id, count: sessionKeys.length}, "checking sessions for user"
			Async.series(
				sessionKeys.map(
					(key) ->
						(next) ->
							rclient.get key, (err, val) ->
								if err?
									return next(err)
								if !val?
									logger.log {user_id: user._id, key}, ">> removing key from UserSessions set"
									rclient.srem sessionSetKey, key, (err, result) ->
										if err?
											return next(err)
										return next(null)
								else
									next()
				)
				, (err, results) ->
					logger.log {user_id: user._id}, "done checking sessions for user"
					return callback(err)
			)
