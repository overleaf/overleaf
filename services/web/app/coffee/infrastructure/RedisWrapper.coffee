Settings = require 'settings-sharelatex'
redis = require 'redis-sharelatex'

# A per-feature interface to Redis,
# looks up the feature in `settings.redis`
# and returns an appropriate client.
# Necessary because we don't want to migrate web over
# to redis-cluster all at once.
module.exports = Redis =
	# feature = 'websessions' | 'ratelimiter' | ...
	client: (feature) ->
		redisFeatureSettings = Settings.redis[feature] or Settings.redis.web
		rclient = redis.createClient(redisFeatureSettings)
		return rclient
