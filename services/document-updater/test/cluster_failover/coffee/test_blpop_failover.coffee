redis = require "@overleaf/redis-wrapper"
rclient1 = redis.createClient(cluster: [{
	port: "7000"
	host: "localhost"
}])

rclient2 = redis.createClient(cluster: [{
	port: "7000"
	host: "localhost"
}])

counter = 0
sendPing = (cb = () ->) ->
	rclient1.rpush "test-blpop", counter, (error) ->
		console.error "[SENDING ERROR]", error.message if error?
		if !error?
			counter += 1
		cb()

previous = null
listenForPing = (cb) ->
	rclient2.blpop "test-blpop", 200, (error, result) ->
		return cb(error) if error?
		[key, value] = result
		value = parseInt(value, 10)
		if value % 10 == 0
			console.log "."
		if previous? and value != previous + 1
			error = new Error("Counter not in order. Got #{value}, expected #{previous + 1}")
		previous = value
		return cb(error, value)

PING_DELAY = 100
do sendPings = () ->
	sendPing () ->
		setTimeout sendPings, PING_DELAY

do listenInBackground = () ->
	listenForPing (error, value) ->
		console.error "[RECEIVING ERROR]", error.message if error
		setTimeout listenInBackground
