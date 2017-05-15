RedisWrapper = require('../../infrastructure/RedisWrapper')
rclient = RedisWrapper.client('cooldown')
logger = require('logger-sharelatex')


COOLDOWN_IN_SECONDS = 60 * 10


module.exports = CooldownManager =

	_buildKey: (projectId) ->
		"Cooldown:{#{projectId}}"

	putProjectOnCooldown: (projectId, callback=(err)->) ->
		logger.log {projectId}, "[Cooldown] putting project on cooldown for #{COOLDOWN_IN_SECONDS} seconds"
		rclient.set(CooldownManager._buildKey(projectId), '1', 'EX', COOLDOWN_IN_SECONDS, callback)

	isProjectOnCooldown: (projectId, callback=(err, isOnCooldown)->) ->
		rclient.get CooldownManager._buildKey(projectId), (err, result) ->
			if err?
				return callback(err)
			callback(null, result == "1")

