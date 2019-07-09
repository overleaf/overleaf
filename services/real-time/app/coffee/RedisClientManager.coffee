redis = require("redis-sharelatex")

module.exports = RedisClientManager =
    createClientList: (configs...) ->
        # create a dynamic list of redis clients, excluding any configurations which are not defined
        clientList = (redis.createClient(x) for x in configs when x?)
        return clientList