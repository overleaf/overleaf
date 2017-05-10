RedisWrapper = require('../../infrastructure/RedisWrapper')
rclient = RedisWrapper.client('sudomode')
logger = require('logger-sharelatex')


TIMEOUT_IN_SECONDS = 60 * 60


module.exports = SudoModeHandler =

	_buildKey: (userId) ->
		"SudoMode:{#{userId}}"

	activateSudoMode: (userId, callback=(err)->) ->
		if !userId?
			return callback(new Error('[SudoMode] user must be supplied'))
		duration = TIMEOUT_IN_SECONDS
		logger.log {userId, duration}, "[SudoMode] activating sudo mode for user"
		rclient.set SudoModeHandler._buildKey(userId), '1', 'EX', duration, callback

	isSudoModeActive: (userId, callback=(err, isActive)->) ->
		if !userId?
			return callback(new Error('[SudoMode] user must be supplied'))
		rclient.get SudoModeHandler._buildKey(userId), (err, result) ->
			if err?
				return callback(err)
			callback(null, result == '1')
