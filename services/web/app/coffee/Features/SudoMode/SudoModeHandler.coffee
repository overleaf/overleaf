RedisWrapper = require('../../infrastructure/RedisWrapper')
rclient = RedisWrapper.client('sudomode')
logger = require('logger-sharelatex')
AuthenticationManager = require '../Authentication/AuthenticationManager'
Settings = require 'settings-sharelatex'
V1Handler = require '../V1/V1Handler'
UserGetter = require '../User/UserGetter'


TIMEOUT_IN_SECONDS = 60 * 60


module.exports = SudoModeHandler =

	_buildKey: (userId) ->
		"SudoMode:{#{userId}}"

	authenticate: (email, password, callback=(err, user)->) ->
		if Settings.overleaf?
			V1Handler.authWithV1 email, password, (err, isValid, v1Profile) ->
				if !isValid
					return callback(null, null)
				UserGetter.getUser {'overleaf.id': v1Profile.id}, callback
		else
			AuthenticationManager.authenticate {email}, password, callback

	activateSudoMode: (userId, callback=(err)->) ->
		if !userId?
			return callback(new Error('[SudoMode] user must be supplied'))
		duration = TIMEOUT_IN_SECONDS
		logger.log {userId, duration}, "[SudoMode] activating sudo mode for user"
		rclient.set SudoModeHandler._buildKey(userId), '1', 'EX', duration, callback

	clearSudoMode: (userId, callback=(err)->) ->
		if !userId?
			return callback(new Error('[SudoMode] user must be supplied'))
		logger.log {userId}, "[SudoMode] clearing sudo mode for user"
		rclient.del SudoModeHandler._buildKey(userId), callback

	isSudoModeActive: (userId, callback=(err, isActive)->) ->
		if !userId?
			return callback(new Error('[SudoMode] user must be supplied'))
		rclient.get SudoModeHandler._buildKey(userId), (err, result) ->
			if err?
				return callback(err)
			callback(null, result == '1')
