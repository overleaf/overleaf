Settings = require 'settings-sharelatex'
redis = require 'redis-sharelatex'
ioredis = require 'ioredis'
logger = require 'logger-sharelatex'


# A per-feature interface to Redis,
# looks up the feature in `settings.redis`
# and returns an appropriate client.
# Necessary because we don't want to migrate web over
# to redis-cluster all at once.

# TODO: consider merging into `redis-sharelatex`


module.exports = Redis =

	# feature = 'websessions' | 'ratelimiter' | ...
	client: (feature) ->
		redisFeatureSettings = Settings.redis[feature] or Settings.redis.web
		if redisFeatureSettings?.cluster?
			logger.log {feature}, "creating redis-cluster client"
			rclient = new ioredis.Cluster(redisFeatureSettings.cluster)
			rclient._is_redis_cluster = true
		else
			logger.log {feature}, "creating redis client"
			rclient = redis.createClient(redisFeatureSettings)
		return rclient
