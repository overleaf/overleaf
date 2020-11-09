# execute this script with a redis container running to test the health check
# starting and stopping redis with this script running is a good test

redis = require "../../index.coffee"

rclient = redis.createClient({host:"localhost",port:"6379"})
setInterval () ->
    rclient.healthCheck (err) ->
        if err?
            console.log "HEALTH CHECK FAILED", err
        else
            console.log "HEALTH CHECK OK"
, 1000