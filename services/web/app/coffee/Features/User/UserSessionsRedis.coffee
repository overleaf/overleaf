Settings = require 'settings-sharelatex'
redis = require 'redis-sharelatex'
ioredis = require 'ioredis'
logger = require 'logger-sharelatex'

module.exports = Redis =

	client: () ->

		redisSessionsSettings = Settings.redis.websessions or Settings.redis.web

		if redisSessionsSettings?.cluster?
			logger.log {}, "using redis cluster for web sessions"
			rclient = new ioredis.Cluster(redisSessionsSettings.cluster)
		else
			rclient = redis.createClient(redisSessionsSettings)

		return rclient
