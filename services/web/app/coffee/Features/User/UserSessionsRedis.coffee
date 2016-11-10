Settings = require 'settings-sharelatex'
redis = require 'redis-sharelatex'
ioredis = require 'ioredis'
logger = require 'logger-sharelatex'

redisSessionsSettings = Settings.redis.websessions or Settings.redis.web

module.exports = Redis =
	client: () ->
		if redisSessionsSettings?.cluster?
			logger.log {}, "using redis cluster for web sessions"
			rclient = new ioredis.Cluster(redisSessionsSettings.cluster)
		else
			rclient = redis.createClient(redisSessionsSettings)
		return rclient

	sessionSetKey: (user) ->
		if redisSessionsSettings?.cluster?
			return "UserSessions:{#{user._id}}"
		else
			return "UserSessions:#{user._id}"
