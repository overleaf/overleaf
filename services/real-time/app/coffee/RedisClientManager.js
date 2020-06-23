redis = require("redis-sharelatex")
logger = require 'logger-sharelatex'

module.exports = RedisClientManager =
    createClientList: (configs...) ->
        # create a dynamic list of redis clients, excluding any configurations which are not defined
        clientList = for x in configs when x?
            redisType = if x.cluster?
                "cluster"
            else if x.sentinels?
                "sentinel"
            else if x.host?
                "single"
            else
                "unknown"
            logger.log {redis: redisType}, "creating redis client"
            redis.createClient(x)
        return clientList